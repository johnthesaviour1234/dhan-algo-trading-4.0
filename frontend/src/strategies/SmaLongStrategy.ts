import { toast } from '../components/Toast';
import { CandleAggregator, Candle } from '../utils/CandleAggregator';
import { IndicatorCalculator } from '../utils/IndicatorCalculator';
import { ChartDataFetcher } from '../lib/ChartDataFetcher';
import type { LTPData } from '../components/WebSocketDataPanel';
import type { CalculationRow } from '../types/CalculationRow';

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

    // Real-time data infrastructure
    private candleAggregator: CandleAggregator;
    private dataFetcher: ChartDataFetcher;
    private closePrices: number[] = [];

    // SMA tracking
    private sma3: number | null = null;
    private sma15: number | null = null;
    private previousSma3: number | null = null;
    private previousSma15: number | null = null;

    // Calculation history for monitoring
    private calculationHistory: CalculationRow[] = [];

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
        this.candleAggregator = new CandleAggregator();
        this.dataFetcher = new ChartDataFetcher();
    }

    async start() {
        console.log('🚀 [SMA 3/15 Long] Strategy started');
        this.isRunning = true;

        // 1. Load historical data for indicator warmup
        await this.loadHistoricalData();

        // 2. Subscribe to candle aggregator for real-time updates
        this.candleAggregator.subscribe(this.onNewCandle.bind(this));

        toast.info('SMA 3/15 Long strategy started - waiting for real-time data');
    }

    /**
     * Load historical 1-min candles and calculate initial SMAs
     */
    private async loadHistoricalData() {
        try {
            const now = Math.floor(Date.now() / 1000);
            const oneDayAgo = now - (24 * 60 * 60); // Fetch 1 day of data

            console.log('📥 [SMA 3/15 Long] Fetching historical data...');

            const bars = await this.dataFetcher.getBars(
                this.symbolConfig.symbol,
                this.symbolConfig.exchange,
                this.symbolConfig.segment,
                this.symbolConfig.secId,
                oneDayAgo,
                now,
                this.symbolConfig.interval
            );

            if (bars.length > 0) {
                // Extract close prices
                this.closePrices = bars.map(bar => bar.close);

                // Calculate initial SMAs
                this.sma3 = IndicatorCalculator.calculateSMA(this.closePrices, 3);
                this.sma15 = IndicatorCalculator.calculateSMA(this.closePrices, 15);

                console.log(`✅ [SMA 3/15 Long] Loaded ${bars.length} historical candles`);
                console.log(`   Initial SMA(3): ${this.sma3?.toFixed(4)}`);
                console.log(`   Initial SMA(15): ${this.sma15?.toFixed(4)}`);

                toast.success(`SMA 3/15 Long: Loaded ${bars.length} historical candles`);
            } else {
                console.warn('⚠️ [SMA 3/15 Long] No historical data available');
                toast.warning('SMA 3/15 Long: No historical data - will start from first real-time candle');
            }
        } catch (error) {
            console.error('❌ [SMA 3/15 Long] Error loading historical data:', error);
            toast.error('SMA 3/15 Long: Failed to load historical data');
        }
    }

    /**
     * Process incoming LTP update (called from external source)
     */
    onLTPUpdate(ltpData: LTPData) {
        if (!this.isRunning) return;

        // Feed to candle aggregator
        this.candleAggregator.onTick(
            ltpData.ltp,
            ltpData.volume || 0,
            new Date()
        );
    }

    /**
     * Called when a new 1-min candle completes
     */
    private onNewCandle(candle: Candle) {
        if (!this.isRunning) return;

        console.log(`📊 [SMA 3/15 Long] New candle: ${new Date(candle.time * 1000).toISOString()}, Close: ${candle.close}`);

        // Add to price history
        this.closePrices.push(candle.close);

        // Keep only last 100 candles to avoid memory bloat
        if (this.closePrices.length > 100) {
            this.closePrices = this.closePrices.slice(-100);
        }

        // Store previous SMAs for crossover detection
        this.previousSma3 = this.sma3;
        this.previousSma15 = this.sma15;

        // Calculate new SMAs
        this.sma3 = IndicatorCalculator.calculateSMA(this.closePrices, 3);
        this.sma15 = IndicatorCalculator.calculateSMA(this.closePrices, 15);

        console.log(`   SMA(3): ${this.sma3?.toFixed(4)}, SMA(15): ${this.sma15?.toFixed(4)}`);

        // Record calculation for monitoring
        this.recordCalculation(candle);

        // Check for crossover and generate signals
        this.checkForSignals(candle);
    }

    /**
     * Record calculation row for real-time monitoring
     */
    private recordCalculation(candle: Candle) {
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
    private checkForSignals(candle: Candle) {
        if (this.sma3 === null || this.sma15 === null) {
            console.log('   ⏳ Waiting for SMAs to initialize');
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

        // Unsubscribe from candle aggregator
        this.candleAggregator.unsubscribe(this.onNewCandle.bind(this));

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
