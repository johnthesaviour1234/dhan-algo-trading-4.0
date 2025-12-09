import { toast } from '../components/Toast';
import { IndicatorCalculator } from '../utils/IndicatorCalculator';
import { MarketHours } from '../utils/MarketHours';
import type { CalculationRow } from '../types/CalculationRow';
import type { OHLCCandle } from '../types/Strategy';

interface Trade {
    id: string;
    entryDate: string;
    exitDate: string;
    direction: 'Long' | 'Short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    duration: string;
    signal: 'Buy' | 'Sell';
    brokerage: number;
    slippage: number;
    indicators: Record<string, number | boolean | string>;
}

export class SmaLongStrategy {
    private isRunning = false;
    private currentPosition: { entryTime: Date; entryPrice: number; orderId?: string; correlationId?: string } | null = null;
    private onTradeCallback: (trade: Trade) => void;
    private placeOrderFn: (type: 'BUY' | 'SELL', qty: number) => Promise<{ price?: number; orderId?: string; correlationId?: string }>;
    private tradeCount = 0;

    // OHLC candle history for indicator calculation
    private closePrices: number[] = [];

    // SMA tracking
    private sma3: number | null = null;
    private sma15: number | null = null;
    private previousSma3: number | null = null;
    private previousSma15: number | null = null;

    // Calculation history for monitoring
    private calculationHistory: CalculationRow[] = [];

    // Lookback period: 500 candles (~8.3 hours of 1-min data)
    // Enough for stable SMA calculation without performance issues
    public readonly lookbackCandles = 500;

    // Symbol configuration
    private readonly symbolConfig = {
        symbol: 'IDEA',
        exchange: 'NSE',
        segment: 'E',
        secId: 14366,
        interval: '1', // 1 minute
    };

    constructor(
        placeOrderFn: (type: 'BUY' | 'SELL', qty: number) => Promise<{ price?: number; orderId?: string; correlationId?: string }>,
        onTradeCallback: (trade: Trade) => void
    ) {
        this.placeOrderFn = placeOrderFn;
        this.onTradeCallback = onTradeCallback;
    }

    async start(initialOHLCData: OHLCCandle[] = []) {
        console.log('🚀 [SMA 3/15 Long] Strategy started');
        this.isRunning = true;

        // Initialize with historical OHLC data
        if (initialOHLCData.length > 0) {
            this.updateWithOHLCData(initialOHLCData, false); // Don't check signals on init
            console.log(`✅ [SMA 3/15 Long] Initialized with ${initialOHLCData.length} historical candles`);
            console.log(`   Initial SMA(3): ${this.sma3?.toFixed(4)}`);
            console.log(`   Initial SMA(15): ${this.sma15?.toFixed(4)}`);
            toast.success(`SMA 3/15 Long: Loaded ${initialOHLCData.length} candles`);
        } else {
            console.warn('⚠️ [SMA 3/15 Long] No initial data - waiting for OHLC updates');
            toast.warning('SMA 3/15 Long: Waiting for OHLC data');
        }
    }

    /**
     * Update strategy with new OHLC data from ChartDataContext
     * Called whenever historical or live candle data changes
     */
    updateWithOHLCData(ohlcCandles: OHLCCandle[], checkSignals: boolean = true) {
        if (!this.isRunning || ohlcCandles.length === 0) return;

        // Extract close prices
        this.closePrices = ohlcCandles.map(c => c.close);

        // Store previous SMAs for crossover detection
        this.previousSma3 = this.sma3;
        this.previousSma15 = this.sma15;

        // Calculate new SMAs (using all available data)
        this.sma3 = IndicatorCalculator.calculateSMA(this.closePrices, 3);
        this.sma15 = IndicatorCalculator.calculateSMA(this.closePrices, 15);

        const latestCandle = ohlcCandles[ohlcCandles.length - 1];
        console.log(`📊 [SMA 3/15 Long] OHLC update: ${ohlcCandles.length} candles, Latest: ${new Date(latestCandle.time * 1000).toISOString()}`);
        console.log(`   SMA(3): ${this.sma3?.toFixed(4)}, SMA(15): ${this.sma15?.toFixed(4)}`);

        // Record calculation
        this.recordCalculation(latestCandle);

        // Check for signals if requested and SMAs are ready
        if (checkSignals && this.sma3 !== null && this.sma15 !== null) {
            this.checkForSignals(latestCandle);
        }
    }



    /**
     * Record calculation row for real-time monitoring
     */
    private recordCalculation(candle: OHLCCandle) {
        if (this.sma3 === null || this.sma15 === null) return;

        const fastAboveSlow = this.sma3 > this.sma15;
        const fastBelowSlow = this.sma3 < this.sma15;

        const row: CalculationRow = {
            timestamp: candle.time,
            time: new Date(candle.time * 1000).toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour12: false
            }),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            fastMA: this.sma3,
            slowMA: this.sma15,
            fastAboveSlow,
            fastBelowSlow,
            signal: 'NONE' // Will be updated if signal generated
        };

        this.calculationHistory.push(row);

        // Keep only last 100 rows
        if (this.calculationHistory.length > 100) {
            this.calculationHistory = this.calculationHistory.slice(-100);
        }
    }

    /**
     * Update last calculation row with signal
     */
    private updateLastSignal(signal: 'BUY' | 'SELL') {
        if (this.calculationHistory.length > 0) {
            this.calculationHistory[this.calculationHistory.length - 1].signal = signal;
        }
    }

    /**
     * Check for buy/sell signals based on SMA crossover
     */
    private checkForSignals(candle: OHLCCandle) {
        if (this.sma3 === null || this.sma15 === null) {
            console.log('   ⏳ Waiting for SMAs to initialize');
            return;
        }

        // Check for force close at 2:30 PM IST
        if (MarketHours.isForceCloseTime() && this.currentPosition !== null) {
            console.log('⏰ [SMA 3/15 Long] FORCE CLOSE at 2:30 PM IST');
            this.updateLastSignal('SELL');
            this.executeSell(candle.close);
            return;
        }

        // Only trade during market hours (9:30 AM - 2:30 PM IST)
        if (!MarketHours.isWithinTradingHours()) {
            console.log(`   ⏳ [SMA 3/15 Long] Outside market hours (${MarketHours.getCurrentISTTimeString()} IST)`);
            return;
        }

        // Detect crossover
        const crossover = IndicatorCalculator.detectCrossover(
            this.sma3,
            this.sma15,
            this.previousSma3 ?? undefined,
            this.previousSma15 ?? undefined
        );

        if (crossover === 'bullish' && this.currentPosition === null) {
            // SMA(3) crossed above SMA(15) - BUY signal
            console.log('🔔 [SMA 3/15 Long] BULLISH CROSSOVER - Generating BUY signal');
            this.updateLastSignal('BUY');
            this.executeBuy(candle.close);
        } else if (crossover === 'bearish' && this.currentPosition !== null) {
            // SMA(3) crossed below SMA(15) - SELL signal
            console.log('🔔 [SMA 3/15 Long] BEARISH CROSSOVER - Generating SELL signal');
            this.updateLastSignal('SELL');
            this.executeSell(candle.close);
        } else if (crossover) {
            console.log(`   ℹ️ Crossover detected (${crossover}) but position state prevents signal`);
        }
    }

    async executeBuy(price: number) {
        if (!this.isRunning) return;

        // Don't buy if already in position
        if (this.currentPosition !== null) {
            console.log('⚠️ [SMA 3/15 Long] Already in position, skipping BUY');
            return;
        }

        try {
            console.log('📈 [SMA 3/15 Long] Executing BUY signal...');

            // Place BUY order (validation happens in LiveTradingPanel wrapper)
            const result = await this.placeOrderFn('BUY', 1);

            const entryTime = new Date();
            const entryPrice = result.price || price;

            this.currentPosition = {
                entryTime,
                entryPrice,
                orderId: result.orderId,
                correlationId: result.correlationId
            };

            toast.success(`SMA 3/15 Long: BUY executed at ₹${entryPrice.toFixed(2)}`);
            console.log(`✅ [SMA 3/15 Long] BUY executed at ${entryTime.toISOString()}, price: ${entryPrice}`);
            console.log(`   SMA(3): ${this.sma3?.toFixed(4)}, SMA(15): ${this.sma15?.toFixed(4)}`);
        } catch (error: any) {
            console.error('❌ [SMA 3/15 Long] BUY execution failed:', error);
            toast.error(`SMA 3/15 Long: BUY failed - ${error.message}`);
            this.currentPosition = null;
        }
    }

    async executeSell(price: number) {
        if (!this.isRunning) return;

        // Only exit if we have a position
        if (!this.currentPosition) {
            console.log('⚠️ [SMA 3/15 Long] No position to exit, skipping SELL');
            return;
        }

        try {
            console.log('📉 [SMA 3/15 Long] Executing SELL signal...');

            // Place SELL order
            const result = await this.placeOrderFn('SELL', 1);

            const exitTime = new Date();
            const exitPrice = result.price || price;
            const { entryTime, entryPrice } = this.currentPosition;

            const pnl = (exitPrice - entryPrice) * 1;
            const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
            const durationMs = exitTime.getTime() - entryTime.getTime();
            const durationMin = Math.floor(durationMs / 60000);

            // Create trade record
            const trade: Trade = {
                id: `sma_3_15_long-${Date.now()}-${this.tradeCount++}`,
                entryDate: entryTime.toISOString().split('T')[0] + ' ' + entryTime.toTimeString().split(' ')[0],
                exitDate: exitTime.toISOString().split('T')[0] + ' ' + exitTime.toTimeString().split(' ')[0],
                direction: 'Long',
                entryPrice,
                exitPrice,
                quantity: 1,
                pnl: parseFloat(pnl.toFixed(2)),
                pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                duration: `${durationMin}min`,
                signal: 'Buy',
                brokerage: 0.05,
                slippage: 0.01,
                indicators: {
                    'SMA 3': this.sma3 ?? 0,
                    'SMA 15': this.sma15 ?? 0,
                    'Entry SMA3': this.previousSma3 ?? 0,
                    'Entry SMA15': this.previousSma15 ?? 0,
                    'Strategy': 'SMA 3/15 Long',
                    'Entry Time': entryTime.toTimeString().split(' ')[0],
                    'Exit Time': exitTime.toTimeString().split(' ')[0],
                }
            };

            toast.success(`SMA 3/15 Long: SELL executed at ₹${exitPrice.toFixed(2)}, P&L: ₹${pnl.toFixed(2)}`);
            console.log(`✅ [SMA 3/15 Long] SELL executed, P&L: ₹${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
            console.log(`   SMA(3): ${this.sma3?.toFixed(4)}, SMA(15): ${this.sma15?.toFixed(4)}`);

            // Notify callback with trade
            this.onTradeCallback(trade);

            // Clear position
            this.currentPosition = null;
        } catch (error: any) {
            console.error('❌ [SMA 3/15 Long] SELL execution failed:', error);
            toast.error(`SMA 3/15 Long: SELL failed - ${error.message}`);
            this.currentPosition = null;
        }
    }

    stop() {
        console.log('🛑 [SMA 3/15 Long] Strategy stopped');
        this.isRunning = false;
        this.currentPosition = null;
        toast.info('SMA 3/15 Long strategy stopped');
    }

    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get calculation history for monitoring
     */
    getCalculationHistory(): CalculationRow[] {
        return [...this.calculationHistory]; // Return copy
    }
}
