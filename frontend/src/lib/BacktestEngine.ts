import { CandlestickData } from 'lightweight-charts';
import { IndicatorCalculator } from '../utils/IndicatorCalculator';
import { CandlestickPatterns, CandleData } from '../utils/CandlestickPatterns';
import { calculateIntradayTradeCosts, TradeCosts } from '../utils/BrokerageCalculator';
import { HTFAggregator } from '../utils/HTFAggregator';

/**
 * Backtest Engine
 * 
 * Runs trading strategies against historical OHLC data and calculates
 * performance metrics. Supports SMA and EMA crossover strategies.
 */

export interface BacktestTrade {
    id: string;
    entryDate: string;
    exitDate: string;
    direction: 'Long' | 'Short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    grossPnl: number;        // P&L before costs
    pnl: number;             // Net P&L after all costs
    pnlPercent: number;
    duration: string;
    signal: 'Buy' | 'Sell';
    slippage: number;
    // Detailed cost breakdown
    costs: TradeCosts;
    indicators: Record<string, number | boolean | string>;
    // Risk management
    exitReason: 'Signal' | 'StopLoss' | 'Target' | 'TrailingStop' | 'MarketClose';
}

export interface MetricData {
    return: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    lossRate: number;    // 100% - Win Rate
    totalTrades: number;
    profitFactor: number;
    expectancy: number;  // (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
    avgWin: number;      // Average winning trade (₹)
    avgLoss: number;     // Average losing trade (₹)
}

export interface BacktestMetrics {
    daily: MetricData;
    weekly: MetricData;
    monthly: MetricData;
    quarterly: MetricData;
    yearly: MetricData;
    overall: MetricData;
}

export interface StrategyConfig {
    name: string;
    type: 'sma-crossover' | 'ema-crossover' | 'ema-candlestick' | 'ema-scalping' | 'rsi' | 'macd' | 'bollinger';
    direction: 'long' | 'short' | 'both';
    params: {
        fastPeriod?: number;
        slowPeriod?: number;
        rsiPeriod?: number;
        rsiBuyThreshold?: number;
        rsiSellThreshold?: number;
        adxPeriod?: number;       // ADX period for trend strength filter
        adxThreshold?: number;    // ADX threshold (default 20)
        // Risk Management
        stopLossPercent?: number;     // Default 1%
        targetProfitPercent?: number; // Default 2% (1:2 ratio)
        trailingStopPercent?: number; // Default 1%
        useTrailingStop?: boolean;    // Enable trailing stop (default true)
    };
}

interface Position {
    entryTime: number;
    entryPrice: number;
    direction: 'Long' | 'Short';
    indicators: Record<string, number | boolean | string>;
    // Risk management levels
    stopLossPrice: number;
    targetPrice: number;
    highestPrice: number;  // For trailing stop
    lowestPrice: number;   // For short positions
}

export class BacktestEngine {
    private readonly RISK_FREE_RATE = 0.06; // 6% annual risk-free rate (Indian context)
    private readonly SLIPPAGE_PERCENT = 0.0001; // 0.01% slippage

    // Market hours (IST) - Intraday trading window
    private readonly MARKET_OPEN_HOUR = 9;
    private readonly MARKET_OPEN_MINUTE = 30;  // 9:30 AM
    private readonly MARKET_CLOSE_HOUR = 14;
    private readonly MARKET_CLOSE_MINUTE = 30; // 2:30 PM (forced close)

    private getISTTimeInMinutes(unixTimestamp: number): number {
        const date = new Date(unixTimestamp * 1000);
        const hours = date.getUTCHours() + 5;
        const minutes = date.getUTCMinutes() + 30;
        return (hours + Math.floor(minutes / 60)) * 60 + (minutes % 60);
    }

    private isWithinMarketHours(unixTimestamp: number): boolean {
        const time = this.getISTTimeInMinutes(unixTimestamp);
        return time >= 570 && time < 870; // 9:30 AM to 2:30 PM
    }

    private isForceCloseTime(unixTimestamp: number): boolean {
        return this.getISTTimeInMinutes(unixTimestamp) >= 870; // 2:30 PM
    }

    /**
     * Run a backtest on historical data with the given strategy
     */
    runBacktest(
        ohlcData: CandlestickData[],
        strategyConfig: StrategyConfig,
        quantity: number = 1
    ): { trades: BacktestTrade[]; metrics: BacktestMetrics } {
        console.log(`🧪 [Backtest] Running ${strategyConfig.name} on ${ohlcData.length} candles`);

        if (ohlcData.length === 0) {
            console.warn('⚠️ [Backtest] No data to backtest');
            return { trades: [], metrics: this.getEmptyMetrics() };
        }

        // Generate signals based on strategy type
        const signals = this.generateSignals(ohlcData, strategyConfig);

        // Simulate trades from signals (with OHLC for force close)
        const trades = this.simulateTrades(signals, strategyConfig, quantity, ohlcData);

        console.log(`✅ [Backtest] Generated ${trades.length} trades`);

        // Calculate metrics
        const metrics = this.calculateAllMetrics(trades, ohlcData);

        return { trades, metrics };
    }

    /**
     * Generate trading signals based on strategy configuration
     */
    private generateSignals(
        ohlcData: CandlestickData[],
        config: StrategyConfig
    ): { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] {
        const closePrices = ohlcData.map(bar => bar.close);

        switch (config.type) {
            case 'sma-crossover':
            case 'ema-crossover':
                return this.generateMACrossoverSignals(ohlcData, closePrices, config);
            case 'ema-candlestick':
                return this.generateCandlestickPatternSignals(ohlcData, config);
            case 'ema-scalping':
                return this.generateEmaScalpingSignals(ohlcData, config);
            default:
                console.warn(`⚠️ [Backtest] Strategy type ${config.type} not yet implemented`);
                return [];
        }
    }

    /**
     * Generate signals for SMA/EMA crossover strategies
     */
    private generateMACrossoverSignals(
        ohlcData: CandlestickData[],
        closePrices: number[],
        config: StrategyConfig
    ): { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] {
        const signals: { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] = [];

        const fastPeriod = config.params.fastPeriod || 3;
        const slowPeriod = config.params.slowPeriod || 15;
        const isEMA = config.type === 'ema-crossover';

        let prevFast: number | null = null;
        let prevSlow: number | null = null;

        // PRE-COMPUTE all indicators in O(n) single pass
        console.log(`📊 [MA Crossover] Pre-computing ${isEMA ? 'EMA' : 'SMA'} values for ${ohlcData.length} bars...`);
        const fastValues = isEMA
            ? IndicatorCalculator.calculateAllEMAs(closePrices, fastPeriod)
            : this.calculateAllSMAs(closePrices, fastPeriod);
        const slowValues = isEMA
            ? IndicatorCalculator.calculateAllEMAs(closePrices, slowPeriod)
            : this.calculateAllSMAs(closePrices, slowPeriod);
        console.log(`✅ Pre-computation complete`);

        for (let i = slowPeriod; i < ohlcData.length; i++) {
            const bar = ohlcData[i];

            // O(1) lookup instead of O(n) calculation
            const currentFast = fastValues[i];
            const currentSlow = slowValues[i];

            if (currentFast === null || currentSlow === null) continue;

            // Detect crossover
            if (prevFast !== null && prevSlow !== null) {
                const crossover = IndicatorCalculator.detectCrossover(
                    currentFast,
                    currentSlow,
                    prevFast,
                    prevSlow
                );

                const indicators: Record<string, number | boolean | string> = {
                    [`${isEMA ? 'EMA' : 'SMA'} ${fastPeriod}`]: parseFloat(currentFast.toFixed(4)),
                    [`${isEMA ? 'EMA' : 'SMA'} ${slowPeriod}`]: parseFloat(currentSlow.toFixed(4)),
                    'Fast > Slow': currentFast > currentSlow,
                };

                if (crossover === 'bullish' && (config.direction === 'long' || config.direction === 'both')) {
                    signals.push({
                        time: bar.time as number,
                        type: 'BUY',
                        price: bar.close,
                        indicators
                    });
                } else if (crossover === 'bearish' && (config.direction === 'long' || config.direction === 'both')) {
                    signals.push({
                        time: bar.time as number,
                        type: 'SELL',
                        price: bar.close,
                        indicators
                    });
                }
            }

            prevFast = currentFast;
            prevSlow = currentSlow;
        }

        return signals;
    }

    /**
     * Generate signals for EMA + Candlestick Pattern strategy
     * 
     * Logic:
     * - EMA crossover establishes trend zone (not for direct entry)
     * - ADX > threshold confirms trending market
     * - Volume > average confirms institutional participation
     * - Bullish candlestick pattern in bullish zone = BUY signal
     * - Exit: ADX < threshold + Bearish candlestick pattern = SELL signal
     * - Only one position at a time
     * - Max 3 trades per day to avoid overtrading
     */
    private generateCandlestickPatternSignals(
        ohlcData: CandlestickData[],
        config: StrategyConfig
    ): { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] {
        const signals: { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] = [];

        const fastPeriod = config.params.fastPeriod || 3;
        const slowPeriod = config.params.slowPeriod || 15;
        const adxPeriod = config.params.adxPeriod || 14;
        const adxThreshold = config.params.adxThreshold || 25;  // Increased from 20 to 25
        const volumePeriod = 20;  // Average volume lookback
        const volumeMultiplier = 1.2;  // Require 1.2x average volume
        const maxTradesPerDay = 3;  // Limit trades per day

        // Minimum data required
        const minBars = Math.max(slowPeriod, adxPeriod * 2, volumePeriod) + 5;
        if (ohlcData.length < minBars) {
            console.warn(`⚠️ [EMA+Candlestick] Not enough data: ${ohlcData.length} bars, need ${minBars}`);
            return signals;
        }

        // Extract OHLC arrays for indicator calculation
        const highs = ohlcData.map(bar => bar.high);
        const lows = ohlcData.map(bar => bar.low);
        const closes = ohlcData.map(bar => bar.close);
        const volumes = ohlcData.map(bar => (bar as any).volume || 0);

        // PRE-COMPUTE all indicators in O(n) SINGLE PASS (optimized)
        console.log(`📊 Pre-computing indicators for ${ohlcData.length} bars...`);
        const startTime = performance.now();

        // O(n) ADX calculation - replaces O(n²) loop
        const adxValues = IndicatorCalculator.calculateAllADX(highs, lows, closes, adxPeriod);

        // O(n) Smoothed EMA calculations
        const smoothedFastValues = IndicatorCalculator.calculateAllSmoothedEMAs(closes, fastPeriod, 9);
        const smoothedSlowValues = IndicatorCalculator.calculateAllSmoothedEMAs(closes, slowPeriod, 9);

        const elapsedMs = (performance.now() - startTime).toFixed(1);
        console.log(`✅ Pre-computation complete in ${elapsedMs}ms`);

        // Pre-compute volume averages using rolling window
        const volumeAvgs: number[] = new Array(ohlcData.length).fill(0);
        let volumeSum = 0;
        for (let i = 0; i < ohlcData.length; i++) {
            volumeSum += volumes[i];
            if (i >= volumePeriod) {
                volumeSum -= volumes[i - volumePeriod];
                volumeAvgs[i] = volumeSum / volumePeriod;
            } else if (i > 0) {
                volumeAvgs[i] = volumeSum / (i + 1);
            }
        }

        // ========== HTF TREND FILTER PRE-COMPUTATION ==========
        // Aggregate 1-min bars to higher timeframes
        const htfEMAPeriod = 21;  // EMA period for HTF trend

        // Hourly bars (60 minutes)
        const hourlyBars = HTFAggregator.aggregate(ohlcData, 60);
        const hourlyEmas = HTFAggregator.calculateHTFEMAs(hourlyBars, htfEMAPeriod);
        console.log(`📊 [HTF] Aggregated ${hourlyBars.length} hourly bars`);

        // Daily bars (300 minutes = 5 hours for 9:30-2:30 trading window)
        const dailyBars = HTFAggregator.aggregate(ohlcData, 300);
        const dailyEmas = HTFAggregator.calculateHTFEMAs(dailyBars, htfEMAPeriod);
        console.log(`📊 [HTF] Aggregated ${dailyBars.length} daily bars`);

        // Track EMA values for trend zone
        let emaFast: number | undefined;
        let emaSlow: number | undefined;

        // Track if we're in a position (to allow only one position at a time)
        let inPosition = false;

        // Track trades per day
        let currentDay = '';
        let todayTradeCount = 0;

        for (let i = minBars; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;

            // Track daily trade count
            const barDate = new Date(barTime * 1000).toISOString().split('T')[0];
            if (barDate !== currentDay) {
                currentDay = barDate;
                todayTradeCount = 0;  // Reset for new day
            }

            // O(1) LOOKUP from pre-computed arrays (was O(n) per bar = O(n²) total)
            const smoothedFast = smoothedFastValues[i];
            const smoothedSlow = smoothedSlowValues[i];

            if (smoothedFast === null || smoothedSlow === null) continue;

            // Update tracking variables for indicator display
            emaFast = smoothedFast;
            emaSlow = smoothedSlow;

            // Determine trend zone
            const bullishZone = emaFast > emaSlow;
            const bearishZone = emaFast < emaSlow;

            // Use PRE-COMPUTED ADX value (O(1) lookup instead of O(n) calculation)
            const adx = adxValues[i];
            if (adx === null) continue;

            const trendStrong = adx >= adxThreshold;
            const trendWeak = adx < adxThreshold;

            // Use PRE-COMPUTED volume average (O(1) lookup)
            const currentVolume = volumes[i];
            const avgVolume = volumeAvgs[i];
            const volumeAboveAvg = currentVolume > avgVolume * volumeMultiplier;
            const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

            // ========== HTF TREND CHECK (LOOK-AHEAD BIAS PREVENTION) ==========
            // Get LAST COMPLETED HTF candles - never use in-progress candles
            const lastHourlyIdx = HTFAggregator.getLastCompletedBarIndex(hourlyBars, barTime);
            const lastDailyIdx = HTFAggregator.getLastCompletedBarIndex(dailyBars, barTime);

            // Check hourly trend: close > EMA(21)
            let hourlyTrendUp = false;
            let hourlyInfo = 'N/A';
            if (lastHourlyIdx >= 0 && hourlyEmas[lastHourlyIdx] !== null) {
                const hourlyBar = hourlyBars[lastHourlyIdx];
                hourlyTrendUp = hourlyBar.close > hourlyEmas[lastHourlyIdx]!;
                hourlyInfo = hourlyTrendUp ? 'Bullish' : 'Bearish';
            }

            // Check daily trend: close > EMA(21)
            let dailyTrendUp = false;
            let dailyInfo = 'N/A';
            if (lastDailyIdx >= 0 && dailyEmas[lastDailyIdx] !== null) {
                const dailyBar = dailyBars[lastDailyIdx];
                dailyTrendUp = dailyBar.close > dailyEmas[lastDailyIdx]!;
                dailyInfo = dailyTrendUp ? 'Bullish' : 'Bearish';
            }

            // Combined HTF filter: both hourly and daily must be bullish
            const htfTrendUp = hourlyTrendUp && dailyTrendUp;

            // Get last 3 candles for pattern detection
            const recentCandles: CandleData[] = [];
            for (let j = Math.max(0, i - 2); j <= i; j++) {
                recentCandles.push({
                    open: ohlcData[j].open,
                    high: ohlcData[j].high,
                    low: ohlcData[j].low,
                    close: ohlcData[j].close
                });
            }

            // Base indicators for logging
            const indicators: Record<string, number | boolean | string> = {
                [`EMA ${fastPeriod}`]: parseFloat(emaFast.toFixed(4)),
                [`EMA ${slowPeriod}`]: parseFloat(emaSlow.toFixed(4)),
                'ADX': parseFloat(adx.toFixed(2)),
                'Volume Ratio': parseFloat(volumeRatio.toFixed(2)),
                'Trend Zone': bullishZone ? 'Bullish' : 'Bearish',
                'Trend Strong': trendStrong,
                'Volume OK': volumeAboveAvg,
                'Day Trades': todayTradeCount,
                'Hourly Trend': hourlyInfo,
                'Daily Trend': dailyInfo,
                'HTF OK': htfTrendUp,
            };

            // === ENTRY LOGIC ===
            // Only enter if: 
            // 1) Not in position
            // 2) Bullish zone (EMA fast > slow)
            // 3) ADX >= threshold (strong trend)
            // 4) Bullish candlestick pattern
            // 5) Haven't exceeded max trades per day
            // 6) HTF trend is bullish (hourly + daily)
            if (!inPosition && bullishZone && trendStrong && htfTrendUp &&
                todayTradeCount < maxTradesPerDay && config.direction !== 'short') {
                const bullishPattern = CandlestickPatterns.detectBullishPattern(recentCandles);

                if (bullishPattern) {
                    signals.push({
                        time: bar.time as number,
                        type: 'BUY',
                        price: bar.close,
                        indicators: {
                            ...indicators,
                            'Entry Pattern': bullishPattern.pattern,
                            'Pattern Strength': bullishPattern.strength,
                            'Signal': 'BUY'
                        }
                    });
                    inPosition = true;
                    todayTradeCount++;
                }
            }

            // === EXIT LOGIC ===
            // Only exit if: 1) In position, 2) (Bearish zone OR ADX < threshold), 3) Bearish pattern
            // Note: Exit logic does NOT check volume or trade limit - we always want to exit when signal triggers
            if (inPosition && (bearishZone || trendWeak)) {
                const bearishPattern = CandlestickPatterns.detectBearishPattern(recentCandles);

                if (bearishPattern) {
                    signals.push({
                        time: bar.time as number,
                        type: 'SELL',
                        price: bar.close,
                        indicators: {
                            ...indicators,
                            'Exit Pattern': bearishPattern.pattern,
                            'Pattern Strength': bearishPattern.strength,
                            'Signal': 'SELL'
                        }
                    });
                    inPosition = false;
                }
            }
        }

        console.log(`📊 [EMA+Candlestick] Generated ${signals.length} signals from ${ohlcData.length} bars (ADX>=${adxThreshold}, Vol>${volumeMultiplier}x, Max ${maxTradesPerDay}/day)`);
        return signals;
    }

    /**
     * Generate signals for EMA Scalping Strategy (8/13/21/34 EMAs + RSI + Volume)
     * 
     * Entry Conditions (BUY):
     * 1. EMA Stacking: EMA8 > EMA13 > EMA21 > EMA34 (bullish trend)
     * 2. Price pulls back to EMA13 or EMA21 (within 0.5%)
     * 3. Bullish candle closes (close > open)
     * 4. RSI(7) between 40-60 (not overbought/oversold)
     * 5. Volume above 10-period average
     * 
     * Exit Conditions:
     * - Price closes below EMA8 (trend break)
     * - Target/Stop hit in simulateTrades
     */
    private generateEmaScalpingSignals(
        ohlcData: CandlestickData[],
        config: StrategyConfig
    ): { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] {
        const signals: { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] = [];

        // Strategy parameters (with defaults)
        const ema8Period = 8;
        const ema13Period = 13;
        const ema21Period = 21;
        const ema34Period = 34;
        const rsiPeriod = config.params.rsiPeriod || 7;
        const rsiLow = 40;
        const rsiHigh = 60;
        const volumePeriod = 10;
        const pullbackThreshold = 0.005;  // 0.5% - how close price must be to EMA13/21
        const maxTradesPerDay = 5;

        // Minimum data required
        const minBars = Math.max(ema34Period, rsiPeriod) + 10;
        if (ohlcData.length < minBars) {
            console.warn(`⚠️ [EMA Scalping] Not enough data: ${ohlcData.length} bars, need ${minBars}`);
            return signals;
        }

        // Extract arrays for indicator calculation
        const closes = ohlcData.map(bar => bar.close);
        const volumes = ohlcData.map(bar => (bar as any).volume || 0);

        // ========== PRE-COMPUTE ALL INDICATORS IN O(n) SINGLE PASS ==========
        console.log(`📊 [EMA Scalping] Pre-computing indicators for ${ohlcData.length} bars...`);
        const startTime = performance.now();

        // O(n) EMA calculations
        const ema8Values = IndicatorCalculator.calculateAllEMAs(closes, ema8Period);
        const ema13Values = IndicatorCalculator.calculateAllEMAs(closes, ema13Period);
        const ema21Values = IndicatorCalculator.calculateAllEMAs(closes, ema21Period);
        const ema34Values = IndicatorCalculator.calculateAllEMAs(closes, ema34Period);

        // O(n) RSI calculation
        const rsiValues = IndicatorCalculator.calculateAllRSIs(closes, rsiPeriod);

        // O(n) Volume average using rolling window
        const volumeAvgs: number[] = new Array(ohlcData.length).fill(0);
        let volumeSum = 0;
        for (let i = 0; i < ohlcData.length; i++) {
            volumeSum += volumes[i];
            if (i >= volumePeriod) {
                volumeSum -= volumes[i - volumePeriod];
                volumeAvgs[i] = volumeSum / volumePeriod;
            } else if (i > 0) {
                volumeAvgs[i] = volumeSum / (i + 1);
            }
        }

        const elapsedMs = (performance.now() - startTime).toFixed(1);
        console.log(`✅ [EMA Scalping] Pre-computation complete in ${elapsedMs}ms`);

        // Track position state
        let inPosition = false;
        let currentDay = '';
        let todayTradeCount = 0;

        // ========== MAIN SIGNAL GENERATION LOOP ==========
        for (let i = minBars; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;

            // Track daily trade count
            const barDate = new Date(barTime * 1000).toISOString().split('T')[0];
            if (barDate !== currentDay) {
                currentDay = barDate;
                todayTradeCount = 0;
            }

            // O(1) lookup of pre-computed values
            const ema8 = ema8Values[i];
            const ema13 = ema13Values[i];
            const ema21 = ema21Values[i];
            const ema34 = ema34Values[i];
            const rsi = rsiValues[i];
            const currentVolume = volumes[i];
            const avgVolume = volumeAvgs[i];

            // Skip if any indicator is null
            if (ema8 === null || ema13 === null || ema21 === null || ema34 === null || rsi === null) {
                continue;
            }

            // Check conditions
            const emaStacking = ema8 > ema13 && ema13 > ema21 && ema21 > ema34;  // Bullish stacking
            const bearishStacking = ema8 < ema13 && ema13 < ema21 && ema21 < ema34;  // For exit

            // Pullback: price is within 0.5% of EMA13 or EMA21
            const distanceToEma13 = Math.abs(bar.close - ema13) / ema13;
            const distanceToEma21 = Math.abs(bar.close - ema21) / ema21;
            const isPullback = distanceToEma13 <= pullbackThreshold || distanceToEma21 <= pullbackThreshold;

            const isBullishCandle = bar.close > bar.open;
            const rsiInRange = rsi >= rsiLow && rsi <= rsiHigh;
            // Volume check: if avgVolume is 0, skip volume filter (data not available)
            const hasVolumeData = avgVolume > 0;
            const volumeAboveAvg = !hasVolumeData || currentVolume > avgVolume;
            const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

            // Base indicators for logging
            const indicators: Record<string, number | boolean | string> = {
                'EMA 8': parseFloat(ema8.toFixed(4)),
                'EMA 13': parseFloat(ema13.toFixed(4)),
                'EMA 21': parseFloat(ema21.toFixed(4)),
                'EMA 34': parseFloat(ema34.toFixed(4)),
                'RSI': parseFloat(rsi.toFixed(2)),
                'Volume Ratio': parseFloat(volumeRatio.toFixed(2)),
                'EMA Stacking': emaStacking ? 'Bullish' : (bearishStacking ? 'Bearish' : 'Mixed'),
                'Pullback': isPullback,
                'Bullish Candle': isBullishCandle,
                'RSI OK': rsiInRange,
                'Volume OK': volumeAboveAvg,
                'Has Volume': hasVolumeData,
            };

            // === ENTRY LOGIC ===
            // Enter if: Not in position + EMA stacking + Pullback + Bullish candle + RSI in range + (Volume OK or no volume data)
            if (!inPosition && emaStacking && isPullback && isBullishCandle &&
                rsiInRange && volumeAboveAvg && todayTradeCount < maxTradesPerDay &&
                config.direction !== 'short') {
                signals.push({
                    time: barTime,
                    type: 'BUY',
                    price: bar.close,
                    indicators: {
                        ...indicators,
                        'Signal': 'BUY - Pullback Entry',
                        'Day Trades': todayTradeCount + 1,
                    }
                });
                inPosition = true;
                todayTradeCount++;
            }

            // === EXIT LOGIC ===
            // Exit if: In position + Price closes below EMA8 (trend break)
            if (inPosition && bar.close < ema8) {
                signals.push({
                    time: barTime,
                    type: 'SELL',
                    price: bar.close,
                    indicators: {
                        ...indicators,
                        'Signal': 'SELL - EMA8 Break',
                        'Exit Reason': 'Price closed below EMA8',
                    }
                });
                inPosition = false;
            }
        }

        console.log(`📊 [EMA Scalping] Generated ${signals.length} signals from ${ohlcData.length} bars`);
        return signals;
    }

    /**
     * Simulate trades from signals with Stop Loss, Target Profit, and Trailing Stop
     * 
     * Logic:
     * 1. On BUY signal: Open position with SL at -1%, TP at +2% (1:2 ratio)
     * 2. For each subsequent bar: Check if SL/TP hit, update trailing stop
     * 3. Trailing stop: When price makes new high, trail SL at 1% below it
     * 4. Exit on: SL hit, TP hit, SELL signal, or Market Close
     */
    private simulateTrades(
        signals: { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[],
        config: StrategyConfig,
        quantity: number,
        ohlcData: CandlestickData[]
    ): BacktestTrade[] {
        const trades: BacktestTrade[] = [];
        let position: Position | null = null;
        let tradeCount = 0;

        // Risk management parameters (defaults: 1% SL, 2% TP, 1% trailing)
        const stopLossPercent = config.params.stopLossPercent ?? 0.01;
        const targetProfitPercent = config.params.targetProfitPercent ?? 0.005;
        const trailingStopPercent = config.params.trailingStopPercent ?? 0.01;
        const useTrailingStop = config.params.useTrailingStop ?? true;

        // Create a map of signals by time for quick lookup
        const signalMap = new Map<number, { type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }>();
        for (const signal of signals) {
            signalMap.set(signal.time, signal);
        }

        // Helper to create trade record
        const createTrade = (
            exitTime: number,
            exitPrice: number,
            exitReason: BacktestTrade['exitReason'],
            exitIndicators: Record<string, number | boolean | string> = {}
        ): BacktestTrade => {
            const pos = position!;
            const grossPnl = pos.direction === 'Long'
                ? (exitPrice - pos.entryPrice) * quantity
                : (pos.entryPrice - exitPrice) * quantity;

            const costs = calculateIntradayTradeCosts({
                buyPrice: pos.direction === 'Long' ? pos.entryPrice : exitPrice,
                sellPrice: pos.direction === 'Long' ? exitPrice : pos.entryPrice,
                quantity,
                exchange: 'NSE'
            });

            const netPnl = grossPnl - costs.totalCost;
            const pnlPercent = pos.direction === 'Long'
                ? ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100
                : ((pos.entryPrice - exitPrice) / pos.entryPrice) * 100;
            const slippage = pos.entryPrice * this.SLIPPAGE_PERCENT + exitPrice * this.SLIPPAGE_PERCENT;

            const entryDate = new Date(pos.entryTime * 1000);
            const exitDate = new Date(exitTime * 1000);
            const durationMinutes = Math.floor((exitDate.getTime() - entryDate.getTime()) / 60000);

            let duration: string;
            if (durationMinutes < 60) {
                duration = `${durationMinutes}min`;
            } else if (durationMinutes < 1440) {
                duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}min`;
            } else {
                const days = Math.floor(durationMinutes / 1440);
                duration = `${days} day${days > 1 ? 's' : ''}`;
            }

            return {
                id: `${config.name.replace(/\s+/g, '-').toLowerCase()}-${tradeCount++}`,
                entryDate: this.formatDateTime(entryDate),
                exitDate: this.formatDateTime(exitDate) + (exitReason !== 'Signal' ? ` (${exitReason})` : ''),
                direction: pos.direction,
                entryPrice: parseFloat(pos.entryPrice.toFixed(2)),
                exitPrice: parseFloat(exitPrice.toFixed(2)),
                quantity,
                grossPnl: parseFloat(grossPnl.toFixed(2)),
                pnl: parseFloat(netPnl.toFixed(2)),
                pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                duration,
                signal: pos.direction === 'Long' ? 'Buy' : 'Sell',
                slippage: parseFloat(slippage.toFixed(2)),
                costs,
                indicators: {
                    ...pos.indicators,
                    'Stop Loss': parseFloat(pos.stopLossPrice.toFixed(2)),
                    'Target': parseFloat(pos.targetPrice.toFixed(2)),
                    'Highest Price': parseFloat(pos.highestPrice.toFixed(2)),
                    ...exitIndicators
                },
                exitReason
            };
        };

        // Iterate through all bars
        for (let i = 0; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;

            // Check if there's an open position to manage
            if (position !== null) {
                // === CHECK STOP LOSS / TARGET / TRAILING STOP ===

                if (position.direction === 'Long') {
                    // Check Stop Loss (hit if LOW <= SL price)
                    if (bar.low <= position.stopLossPrice) {
                        const exitPrice = position.stopLossPrice * (1 - this.SLIPPAGE_PERCENT);
                        const reason: BacktestTrade['exitReason'] =
                            position.highestPrice > position.entryPrice ? 'TrailingStop' : 'StopLoss';
                        trades.push(createTrade(barTime, exitPrice, reason, { 'Exit Price': exitPrice }));
                        position = null;
                        continue;
                    }

                    // Check Target Profit (hit if HIGH >= Target price)
                    if (bar.high >= position.targetPrice) {
                        const exitPrice = position.targetPrice * (1 - this.SLIPPAGE_PERCENT);
                        trades.push(createTrade(barTime, exitPrice, 'Target', { 'Exit Price': exitPrice }));
                        position = null;
                        continue;
                    }

                    // Update Trailing Stop (if enabled and new high)
                    if (useTrailingStop && bar.high > position.highestPrice) {
                        position.highestPrice = bar.high;
                        const newTrailingSL = position.highestPrice * (1 - trailingStopPercent);
                        // Only trail UP, never down
                        if (newTrailingSL > position.stopLossPrice) {
                            position.stopLossPrice = newTrailingSL;
                        }
                    }
                }

                // Check for Market Close (force close at 2:30 PM)
                if (this.isForceCloseTime(barTime)) {
                    const exitPrice = bar.close * (1 - this.SLIPPAGE_PERCENT);
                    trades.push(createTrade(barTime, exitPrice, 'MarketClose', { 'Exit Reason': 'Market Close (2:30 PM)' }));
                    position = null;
                    continue;
                }

                // Check for SELL signal
                const signal = signalMap.get(barTime);
                if (signal && signal.type === 'SELL' && position.direction === 'Long') {
                    const exitPrice = signal.price * (1 - this.SLIPPAGE_PERCENT);
                    trades.push(createTrade(barTime, exitPrice, 'Signal', signal.indicators));
                    position = null;
                    continue;
                }
            }

            // === CHECK FOR NEW ENTRY ===
            const signal = signalMap.get(barTime);
            if (signal && signal.type === 'BUY' && position === null && this.isWithinMarketHours(barTime)) {
                const entryPrice = signal.price * (1 + this.SLIPPAGE_PERCENT);

                // Set SL at -stopLossPercent and TP at +targetProfitPercent
                position = {
                    entryTime: barTime,
                    entryPrice: entryPrice,
                    direction: 'Long',
                    indicators: signal.indicators,
                    stopLossPrice: entryPrice * (1 - stopLossPercent),
                    targetPrice: entryPrice * (1 + targetProfitPercent),
                    highestPrice: entryPrice,
                    lowestPrice: entryPrice
                };

                console.log(`📈 [Trade] Entry at ${entryPrice.toFixed(2)} | SL: ${position.stopLossPrice.toFixed(2)} | TP: ${position.targetPrice.toFixed(2)}`);
            }
        }

        // Force close any remaining open position at end of data
        if (position !== null) {
            const lastBar = ohlcData[ohlcData.length - 1];
            const exitPrice = lastBar.close * (1 - this.SLIPPAGE_PERCENT);
            trades.push(createTrade(lastBar.time as number, exitPrice, 'MarketClose', { 'Exit Reason': 'End of Data' }));
        }

        console.log(`✅ [Backtest] Generated ${trades.length} trades with SL/TP/Trailing Stop`);
        return trades;
    }

    /**
     * Format date/time for display
     */
    private formatDateTime(date: Date): string {
        return date.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    /**
     * Group trades by time period
     */
    private groupTradesByPeriod(trades: BacktestTrade[], periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Map<string, BacktestTrade[]> {
        const groups = new Map<string, BacktestTrade[]>();

        for (const trade of trades) {
            // Parse entry date to get the period key
            const dateMatch = trade.entryDate.match(/(\d+)\s+(\w+)\s+(\d+)/);
            if (!dateMatch) continue;

            const day = parseInt(dateMatch[1]);
            const monthStr = dateMatch[2];
            const year = parseInt(dateMatch[3]);

            const monthMap: Record<string, number> = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            const month = monthMap[monthStr] ?? 0;
            const date = new Date(year, month, day);

            let periodKey: string;
            switch (periodType) {
                case 'daily':
                    periodKey = `${year}-${month}-${day}`;
                    break;
                case 'weekly':
                    // Get week number
                    const startOfYear = new Date(year, 0, 1);
                    const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
                    periodKey = `${year}-W${weekNum}`;
                    break;
                case 'monthly':
                    periodKey = `${year}-${month}`;
                    break;
                case 'quarterly':
                    const quarter = Math.floor(month / 3) + 1;
                    periodKey = `${year}-Q${quarter}`;
                    break;
                case 'yearly':
                    periodKey = `${year}`;
                    break;
            }

            if (!groups.has(periodKey)) {
                groups.set(periodKey, []);
            }
            groups.get(periodKey)!.push(trade);
        }

        return groups;
    }

    /**
     * Calculate metrics for a single period's trades
     */
    private calculateSinglePeriodMetrics(trades: BacktestTrade[]): MetricData | null {
        if (trades.length === 0) return null;

        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);

        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const initialCapital = trades[0].entryPrice * trades[0].quantity;
        const totalReturn = initialCapital > 0 ? (totalPnl / initialCapital) * 100 : 0;

        const winRate = (winningTrades.length / trades.length) * 100;
        const lossRate = 100 - winRate;

        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

        const winRateDecimal = winningTrades.length / trades.length;
        const lossRateDecimal = 1 - winRateDecimal;
        const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);

        const maxDrawdown = this.calculateMaxDrawdown(trades, initialCapital);

        // Sharpe ratio for this period
        const returns = trades.map(t => t.pnlPercent / 100);
        const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
        const stdDev = returns.length > 1 ? Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        ) : 0;
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

        return {
            return: totalReturn,
            sharpeRatio: sharpeRatio,
            maxDrawdown: maxDrawdown,
            winRate: winRate,
            lossRate: lossRate,
            totalTrades: trades.length,
            profitFactor: Math.min(profitFactor, 99.99),
            expectancy: expectancy,
            avgWin: avgWin,
            avgLoss: avgLoss,
        };
    }

    /**
     * Calculate all metrics for all timeframes
     * Daily to Yearly: Group trades by period, calculate per-period metrics, then average
     * Overall: Complete raw calculation
     */
    private calculateAllMetrics(trades: BacktestTrade[], _ohlcData: CandlestickData[]): BacktestMetrics {
        if (trades.length === 0) {
            return this.getEmptyMetrics();
        }

        return {
            daily: this.calculatePeriodAveragedMetrics(trades, 'daily'),
            weekly: this.calculatePeriodAveragedMetrics(trades, 'weekly'),
            monthly: this.calculatePeriodAveragedMetrics(trades, 'monthly'),
            quarterly: this.calculatePeriodAveragedMetrics(trades, 'quarterly'),
            yearly: this.calculatePeriodAveragedMetrics(trades, 'yearly'),
            overall: this.calculateOverallMetrics(trades), // Raw totals, no averaging
        };
    }

    /**
     * Calculate metrics by grouping trades into periods and averaging the period metrics
     */
    private calculatePeriodAveragedMetrics(trades: BacktestTrade[], periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): MetricData {
        if (trades.length === 0) {
            return this.getEmptyMetricData();
        }

        // Group trades by period
        const periodGroups = this.groupTradesByPeriod(trades, periodType);

        if (periodGroups.size === 0) {
            return this.getEmptyMetricData();
        }

        // Calculate metrics for each period
        const periodMetrics: MetricData[] = [];
        for (const [, periodTrades] of periodGroups) {
            const metrics = this.calculateSinglePeriodMetrics(periodTrades);
            if (metrics) {
                periodMetrics.push(metrics);
            }
        }

        if (periodMetrics.length === 0) {
            return this.getEmptyMetricData();
        }

        // Average all the period metrics
        const numPeriods = periodMetrics.length;
        const avgMetrics: MetricData = {
            return: periodMetrics.reduce((sum, m) => sum + m.return, 0) / numPeriods,
            sharpeRatio: periodMetrics.reduce((sum, m) => sum + m.sharpeRatio, 0) / numPeriods,
            maxDrawdown: periodMetrics.reduce((sum, m) => sum + m.maxDrawdown, 0) / numPeriods,
            winRate: periodMetrics.reduce((sum, m) => sum + m.winRate, 0) / numPeriods,
            lossRate: periodMetrics.reduce((sum, m) => sum + m.lossRate, 0) / numPeriods,
            totalTrades: Math.round(periodMetrics.reduce((sum, m) => sum + m.totalTrades, 0) / numPeriods),
            profitFactor: periodMetrics.reduce((sum, m) => sum + m.profitFactor, 0) / numPeriods,
            expectancy: periodMetrics.reduce((sum, m) => sum + m.expectancy, 0) / numPeriods,
            avgWin: periodMetrics.reduce((sum, m) => sum + m.avgWin, 0) / numPeriods,
            avgLoss: periodMetrics.reduce((sum, m) => sum + m.avgLoss, 0) / numPeriods,
        };

        return {
            return: parseFloat(avgMetrics.return.toFixed(2)),
            sharpeRatio: parseFloat(avgMetrics.sharpeRatio.toFixed(2)),
            maxDrawdown: parseFloat(avgMetrics.maxDrawdown.toFixed(2)),
            winRate: parseFloat(avgMetrics.winRate.toFixed(2)),
            lossRate: parseFloat(avgMetrics.lossRate.toFixed(2)),
            totalTrades: avgMetrics.totalTrades,
            profitFactor: parseFloat(Math.min(avgMetrics.profitFactor, 99.99).toFixed(2)),
            expectancy: parseFloat(avgMetrics.expectancy.toFixed(2)),
            avgWin: parseFloat(avgMetrics.avgWin.toFixed(2)),
            avgLoss: parseFloat(avgMetrics.avgLoss.toFixed(2)),
        };
    }

    /**
     * Calculate OVERALL metrics (raw totals, no averaging)
     * This is the complete calculation for the entire backtest period
     */
    private calculateOverallMetrics(trades: BacktestTrade[]): MetricData {
        if (trades.length === 0) {
            return this.getEmptyMetricData();
        }

        // Total PnL and return
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const initialCapital = trades[0].entryPrice * trades[0].quantity;
        const totalReturn = (totalPnl / initialCapital) * 100;

        // Calculate win rate
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);
        const winRate = (winningTrades.length / trades.length) * 100;

        // Calculate profit factor
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        // Calculate max drawdown (complete)
        const maxDrawdown = this.calculateMaxDrawdown(trades, initialCapital);

        // Calculate Sharpe Ratio (overall)
        const returns = trades.map(t => t.pnlPercent / 100);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        );

        // Annualized Sharpe Ratio for overall
        const annualizedAvgReturn = avgReturn * Math.sqrt(252);
        const annualizedStdDev = stdDev * Math.sqrt(252);
        const sharpeRatio = annualizedStdDev > 0
            ? (annualizedAvgReturn - this.RISK_FREE_RATE) / annualizedStdDev
            : 0;

        // Calculate expectancy using full formula: (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
        const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
        const winRateDecimal = winningTrades.length / trades.length;
        const lossRateDecimal = 1 - winRateDecimal;
        const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);

        return {
            return: parseFloat(totalReturn.toFixed(2)),
            sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
            maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
            winRate: parseFloat(winRate.toFixed(2)),
            lossRate: parseFloat((100 - winRate).toFixed(2)),
            totalTrades: trades.length,
            profitFactor: parseFloat(Math.min(profitFactor, 99.99).toFixed(2)),
            expectancy: parseFloat(expectancy.toFixed(2)),
            avgWin: parseFloat(avgWin.toFixed(2)),
            avgLoss: parseFloat(avgLoss.toFixed(2)),
        };
    }

    /**
     * Calculate maximum drawdown from peak
     */
    private calculateMaxDrawdown(trades: BacktestTrade[], initialCapital: number): number {
        let peak = initialCapital;
        let maxDrawdown = 0;
        let runningCapital = initialCapital;

        for (const trade of trades) {
            runningCapital += trade.pnl;

            if (runningCapital > peak) {
                peak = runningCapital;
            }

            const drawdown = ((peak - runningCapital) / peak) * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return -maxDrawdown; // Return as negative percentage
    }

    /**
     * Calculate approximate trading days between two dates
     */
    private calculateTradingDays(startDate: Date, endDate: Date): number {
        const msPerDay = 24 * 60 * 60 * 1000;
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);

        // Approximate: ~5/7 of calendar days are trading days (excluding weekends)
        // Further reduced for holidays (~250 trading days per 365 calendar days)
        return Math.max(1, Math.floor(totalDays * (250 / 365)));
    }

    /**
     * Get empty metrics structure
     */
    private getEmptyMetrics(): BacktestMetrics {
        return {
            daily: this.getEmptyMetricData(),
            weekly: this.getEmptyMetricData(),
            monthly: this.getEmptyMetricData(),
            quarterly: this.getEmptyMetricData(),
            yearly: this.getEmptyMetricData(),
            overall: this.getEmptyMetricData(),
        };
    }

    /**
     * Get empty metric data
     */
    private getEmptyMetricData(): MetricData {
        return {
            return: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            winRate: 0,
            lossRate: 0,
            totalTrades: 0,
            profitFactor: 0,
            expectancy: 0,
            avgWin: 0,
            avgLoss: 0,
        };
    }

    /**
     * Calculate all SMAs for entire dataset in a single pass - O(n)
     * Uses rolling window to avoid repeated array slicing
     */
    private calculateAllSMAs(prices: number[], period: number): (number | null)[] {
        const result: (number | null)[] = new Array(prices.length).fill(null);
        if (prices.length < period) return result;

        // Initialize rolling sum
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        result[period - 1] = sum / period;

        // Rolling window - O(1) per update
        for (let i = period; i < prices.length; i++) {
            sum = sum - prices[i - period] + prices[i];
            result[i] = sum / period;
        }

        return result;
    }
}

// Singleton instance
export const backtestEngine = new BacktestEngine();



