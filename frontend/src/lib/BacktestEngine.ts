import { CandlestickData } from 'lightweight-charts';
import { IndicatorCalculator } from '../utils/IndicatorCalculator';
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
    totalTrades: number;
    profitFactor: number;
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
    type: 'sma-crossover' | 'ema-crossover' | 'rsi' | 'macd' | 'bollinger';
    direction: 'long' | 'short' | 'both';
    params: {
        fastPeriod?: number;
        slowPeriod?: number;
        rsiPeriod?: number;
        rsiBuyThreshold?: number;
        rsiSellThreshold?: number;
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

        // Simulate trades from signals
        const trades = this.simulateTrades(signals, strategyConfig, quantity);

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
     * Simulate trades from signals
     * Uses the BrokerageCalculator for accurate intraday trading costs
     */
    private simulateTrades(
        signals: { time: number; type: 'BUY' | 'SELL'; price: number; indicators: Record<string, number | boolean | string> }[],
        config: StrategyConfig,
        quantity: number
    ): BacktestTrade[] {
        const trades: BacktestTrade[] = [];
        let position: Position | null = null;
        let tradeCount = 0;

        for (const signal of signals) {
            if (signal.type === 'BUY' && position === null) {
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
     * Calculate all metrics for all timeframes
     * Daily to Yearly: Average metrics per period
     * Overall: Complete raw calculation
     */
    private calculateAllMetrics(trades: BacktestTrade[], ohlcData: CandlestickData[]): BacktestMetrics {
        if (trades.length === 0) {
            return this.getEmptyMetrics();
        }

        // Get date range from data
        const startDate = new Date((ohlcData[0].time as number) * 1000);
        const endDate = new Date((ohlcData[ohlcData.length - 1].time as number) * 1000);
        const tradingDays = this.calculateTradingDays(startDate, endDate);

        // Calculate number of each period type
        const numPeriods = {
            daily: tradingDays,
            weekly: Math.max(1, Math.floor(tradingDays / 5)),
            monthly: Math.max(1, Math.floor(tradingDays / 22)),
            quarterly: Math.max(1, Math.floor(tradingDays / 66)),
            yearly: Math.max(1, Math.floor(tradingDays / 252)),
        };

        return {
            daily: this.calculateAverageMetrics(trades, numPeriods.daily),
            weekly: this.calculateAverageMetrics(trades, numPeriods.weekly),
            monthly: this.calculateAverageMetrics(trades, numPeriods.monthly),
            quarterly: this.calculateAverageMetrics(trades, numPeriods.quarterly),
            yearly: this.calculateAverageMetrics(trades, numPeriods.yearly),
            overall: this.calculateOverallMetrics(trades), // Raw totals, no averaging
        };
    }

    /**
     * Calculate AVERAGE metrics for a timeframe (daily, weekly, monthly, etc.)
     * Returns metrics averaged over the number of periods
     */
    private calculateAverageMetrics(trades: BacktestTrade[], numPeriods: number): MetricData {
        if (trades.length === 0 || numPeriods === 0) {
            return this.getEmptyMetricData();
        }

        // Total PnL and return
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const initialCapital = trades[0].entryPrice * trades[0].quantity;
        const totalReturn = (totalPnl / initialCapital) * 100;

        // Average return per period
        const avgReturnPerPeriod = totalReturn / numPeriods;

        // Calculate win rate (same across all timeframes)
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);
        const winRate = (winningTrades.length / trades.length) * 100;

        // Calculate profit factor (same across all timeframes)
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        // Average max drawdown per period
        const maxDrawdown = this.calculateMaxDrawdown(trades, initialCapital);
        const avgMaxDrawdown = maxDrawdown / numPeriods;

        // Average trades per period
        const avgTradesPerPeriod = Math.round(trades.length / numPeriods);

        // Calculate Sharpe Ratio (averaged per period)
        const returns = trades.map(t => t.pnlPercent / 100);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        );
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
        const avgSharpePerPeriod = sharpeRatio / Math.sqrt(numPeriods);

        return {
            return: parseFloat(avgReturnPerPeriod.toFixed(2)),
            sharpeRatio: parseFloat(avgSharpePerPeriod.toFixed(2)),
            maxDrawdown: parseFloat(avgMaxDrawdown.toFixed(2)),
            winRate: parseFloat(winRate.toFixed(2)),
            totalTrades: avgTradesPerPeriod,
            profitFactor: parseFloat(Math.min(profitFactor, 99.99).toFixed(2)),
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

        return {
            return: parseFloat(totalReturn.toFixed(2)),
            sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
            maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
            winRate: parseFloat(winRate.toFixed(2)),
            totalTrades: trades.length,
            profitFactor: parseFloat(Math.min(profitFactor, 99.99).toFixed(2)),
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
            totalTrades: 0,
            profitFactor: 0,
        };
    }
}

// Singleton instance
export const backtestEngine = new BacktestEngine();
