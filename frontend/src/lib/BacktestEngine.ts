import { CandlestickData } from 'lightweight-charts';
import { IndicatorCalculator } from '../utils/IndicatorCalculator';
import { CandlestickPatterns, CandleData } from '../utils/CandlestickPatterns';
import { calculateIntradayTradeCosts, TradeCosts } from '../utils/BrokerageCalculator';

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
    type: 'sma-crossover' | 'ema-crossover' | 'ema-candlestick' | 'rsi' | 'macd' | 'bollinger';
    direction: 'long' | 'short' | 'both';
    params: {
        fastPeriod?: number;
        slowPeriod?: number;
        rsiPeriod?: number;
        rsiBuyThreshold?: number;
        rsiSellThreshold?: number;
        adxPeriod?: number;       // ADX period for trend strength filter
        adxThreshold?: number;    // ADX threshold (default 20)
    };
}

interface Position {
    entryTime: number;
    entryPrice: number;
    direction: 'Long' | 'Short';
    indicators: Record<string, number | boolean | string>;
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

        // For EMA we need to track previous values
        let emaFast: number | undefined;
        let emaSlow: number | undefined;

        for (let i = slowPeriod; i < ohlcData.length; i++) {
            const pricesUpToNow = closePrices.slice(0, i + 1);
            const bar = ohlcData[i];

            let currentFast: number | null;
            let currentSlow: number | null;

            if (isEMA) {
                emaFast = IndicatorCalculator.calculateEMA(pricesUpToNow, fastPeriod, emaFast) ?? undefined;
                emaSlow = IndicatorCalculator.calculateEMA(pricesUpToNow, slowPeriod, emaSlow) ?? undefined;
                currentFast = emaFast ?? null;
                currentSlow = emaSlow ?? null;
            } else {
                currentFast = IndicatorCalculator.calculateSMA(pricesUpToNow, fastPeriod);
                currentSlow = IndicatorCalculator.calculateSMA(pricesUpToNow, slowPeriod);
            }

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
     * - Bullish candlestick pattern in bullish zone = BUY signal
     * - Exit: ADX < threshold + Bearish candlestick pattern = SELL signal
     * - Only one position at a time
     */
    private generateCandlestickPatternSignals(
        ohlcData: CandlestickData[],
        config: StrategyConfig
    ): { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] {
        const signals: { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[] = [];

        const fastPeriod = config.params.fastPeriod || 3;
        const slowPeriod = config.params.slowPeriod || 15;
        const adxPeriod = config.params.adxPeriod || 14;
        const adxThreshold = config.params.adxThreshold || 20;

        // Minimum data required
        const minBars = Math.max(slowPeriod, adxPeriod * 2) + 5;
        if (ohlcData.length < minBars) {
            console.warn(`⚠️ [EMA+Candlestick] Not enough data: ${ohlcData.length} bars, need ${minBars}`);
            return signals;
        }

        // Extract OHLC arrays for indicator calculation
        const highs = ohlcData.map(bar => bar.high);
        const lows = ohlcData.map(bar => bar.low);
        const closes = ohlcData.map(bar => bar.close);

        // Track EMA values for trend zone
        let emaFast: number | undefined;
        let emaSlow: number | undefined;

        // Track if we're in a position (to allow only one position at a time)
        let inPosition = false;

        for (let i = minBars; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const pricesUpToNow = closes.slice(0, i + 1);
            const highsUpToNow = highs.slice(0, i + 1);
            const lowsUpToNow = lows.slice(0, i + 1);

            // Calculate EMAs
            emaFast = IndicatorCalculator.calculateEMA(pricesUpToNow, fastPeriod, emaFast) ?? undefined;
            emaSlow = IndicatorCalculator.calculateEMA(pricesUpToNow, slowPeriod, emaSlow) ?? undefined;

            if (emaFast === undefined || emaSlow === undefined) continue;

            // Determine trend zone
            const bullishZone = emaFast > emaSlow;
            const bearishZone = emaFast < emaSlow;

            // Calculate ADX for trend strength
            const adx = IndicatorCalculator.calculateADX(highsUpToNow, lowsUpToNow, pricesUpToNow, adxPeriod);
            if (adx === null) continue;

            const trendStrong = adx >= adxThreshold;
            const trendWeak = adx < adxThreshold;

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
                'Trend Zone': bullishZone ? 'Bullish' : 'Bearish',
                'Trend Strong': trendStrong,
            };

            // === ENTRY LOGIC ===
            // Only enter if: 1) Not in position, 2) Bullish zone, 3) ADX >= threshold, 4) Bullish pattern
            if (!inPosition && bullishZone && trendStrong && config.direction !== 'short') {
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
                }
            }

            // === EXIT LOGIC ===
            // Only exit if: 1) In position, 2) (Bearish zone OR ADX < threshold), 3) Bearish pattern
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

        console.log(`📊 [EMA+Candlestick] Generated ${signals.length} signals from ${ohlcData.length} bars`);
        return signals;
    }


    /**
     * Simulate trades from signals
     * Uses the BrokerageCalculator for accurate intraday trading costs
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

        for (const signal of signals) {
            // Only open new positions during market hours (9:30 AM - 2:30 PM IST)
            if (signal.type === 'BUY' && position === null && this.isWithinMarketHours(signal.time)) {
                // Open long position
                position = {
                    entryTime: signal.time,
                    entryPrice: signal.price * (1 + this.SLIPPAGE_PERCENT), // Slippage on entry
                    direction: 'Long',
                    indicators: signal.indicators
                };
            } else if (signal.type === 'SELL' && position !== null && position.direction === 'Long') {
                // Close long position
                const exitPrice = signal.price * (1 - this.SLIPPAGE_PERCENT); // Slippage on exit
                const grossPnl = (exitPrice - position.entryPrice) * quantity;

                // Calculate all trading costs using the BrokerageCalculator
                const costs = calculateIntradayTradeCosts({
                    buyPrice: position.entryPrice,
                    sellPrice: exitPrice,
                    quantity,
                    exchange: 'NSE'
                });

                const netPnl = grossPnl - costs.totalCost;
                const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
                const slippage = position.entryPrice * this.SLIPPAGE_PERCENT + exitPrice * this.SLIPPAGE_PERCENT;

                const entryDate = new Date(position.entryTime * 1000);
                const exitDate = new Date(signal.time * 1000);
                const durationMs = exitDate.getTime() - entryDate.getTime();
                const durationMinutes = Math.floor(durationMs / 60000);

                let duration: string;
                if (durationMinutes < 60) {
                    duration = `${durationMinutes}min`;
                } else if (durationMinutes < 1440) {
                    duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}min`;
                } else {
                    const days = Math.floor(durationMinutes / 1440);
                    duration = `${days} day${days > 1 ? 's' : ''}`;
                }

                trades.push({
                    id: `${config.name.replace(/\s+/g, '-').toLowerCase()}-${tradeCount++}`,
                    entryDate: this.formatDateTime(entryDate),
                    exitDate: this.formatDateTime(exitDate),
                    direction: position.direction,
                    entryPrice: parseFloat(position.entryPrice.toFixed(2)),
                    exitPrice: parseFloat(exitPrice.toFixed(2)),
                    quantity,
                    grossPnl: parseFloat(grossPnl.toFixed(2)),
                    pnl: parseFloat(netPnl.toFixed(2)),
                    pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                    duration,
                    signal: 'Buy',
                    slippage: parseFloat(slippage.toFixed(2)),
                    costs,
                    indicators: {
                        ...position.indicators,
                        'Exit Indicators': JSON.stringify(signal.indicators)
                    }
                });

                position = null;
            }
        }

        // Force close any open position at 2:30 PM (market close)
        if (position !== null) {
            for (const bar of ohlcData) {
                const barTime = bar.time as number;
                if (barTime > position.entryTime && this.isForceCloseTime(barTime)) {
                    const exitPrice = bar.close * (1 - this.SLIPPAGE_PERCENT);
                    const grossPnl = (exitPrice - position.entryPrice) * quantity;
                    const costs = calculateIntradayTradeCosts({ buyPrice: position.entryPrice, sellPrice: exitPrice, quantity, exchange: 'NSE' });
                    const netPnl = grossPnl - costs.totalCost;
                    const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
                    const slippage = position.entryPrice * this.SLIPPAGE_PERCENT + exitPrice * this.SLIPPAGE_PERCENT;
                    const entryDate = new Date(position.entryTime * 1000);
                    const exitDate = new Date(barTime * 1000);
                    const durationMinutes = Math.floor((exitDate.getTime() - entryDate.getTime()) / 60000);
                    const duration = durationMinutes < 60 ? `${durationMinutes}min` : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}min`;
                    trades.push({
                        id: `${config.name.replace(/\s+/g, '-').toLowerCase()}-${tradeCount++}`,
                        entryDate: this.formatDateTime(entryDate),
                        exitDate: this.formatDateTime(exitDate) + ' (Force Close)',
                        direction: position.direction,
                        entryPrice: parseFloat(position.entryPrice.toFixed(2)),
                        exitPrice: parseFloat(exitPrice.toFixed(2)),
                        quantity,
                        grossPnl: parseFloat(grossPnl.toFixed(2)),
                        pnl: parseFloat(netPnl.toFixed(2)),
                        pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                        duration,
                        signal: 'Sell',
                        slippage: parseFloat(slippage.toFixed(2)),
                        costs,
                        indicators: { ...position.indicators, 'Exit Reason': 'Market Close (2:30 PM)' }
                    });
                    position = null;
                    break;
                }
            }
        }

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
}

// Singleton instance
export const backtestEngine = new BacktestEngine();



