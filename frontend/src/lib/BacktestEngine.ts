import { CandlestickData } from 'lightweight-charts';
import { calculateIntradayTradeCosts, TradeCosts } from '../utils/BrokerageCalculator';

/**
 * Generic Backtest Engine
 * 
 * Core responsibilities ONLY:
 * - Trade simulation (entry on BUY, exit on SELL or market close)
 * - Metrics calculation (16 metrics across all timeframes)
 * - Market hours enforcement
 * 
 * Does NOT handle:
 * - Signal generation (delegated to Strategy)
 * - Indicator calculation (delegated to Strategy)
 * - Analytics (delegated to Strategy)
 * - Export formatting (delegated to Strategy)
 */

// ==================== TYPES ====================

export interface Signal {
    time: number;
    type: 'BUY' | 'SELL';
    price: number;
    indicators: Record<string, number | boolean | string>;
}

export interface Trade {
    id: string;
    entryDate: string;
    exitDate: string;
    entryTime: number;
    exitTime: number;
    direction: 'Long';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    grossPnl: number;
    pnl: number;
    pnlPercent: number;
    duration: string;
    signal: 'Buy';
    slippage: number;
    costs: TradeCosts;
    indicators: Record<string, number | boolean | string>;
    exitReason: 'Signal' | 'MarketClose';
}

export interface MetricData {
    return: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    lossRate: number;
    totalTrades: number;
    profitFactor: number;
    expectancy: number;
    avgWin: number;
    avgLoss: number;
    payoffRatio: number;
    recoveryFactor: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    riskRewardRatio: number;
    timeInMarket: number;
}

export interface Metrics {
    daily: MetricData;
    weekly: MetricData;
    monthly: MetricData;
    quarterly: MetricData;
    yearly: MetricData;
    overall: MetricData;
}

export interface BacktestConfig {
    initialCapital: number;  // Default: 100
    quantity: number;        // Default: 1
}

export interface BacktestResult {
    trades: Trade[];
    metrics: Metrics;
    equity: { time: number; value: number }[];
    totalBarsInPosition: number;
    totalMarketBars: number;
}

// ==================== ENGINE ====================

export class BacktestEngine {
    private readonly RISK_FREE_RATE = 0.06;
    private readonly SLIPPAGE_PERCENT = 0.0001;

    /**
     * Convert Unix timestamp to IST time in minutes from midnight
     */
    private getISTTimeInMinutes(unixTimestamp: number): number {
        const date = new Date(unixTimestamp * 1000);
        const istOffset = 5 * 60 + 30;
        const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
        return (utcMinutes + istOffset) % (24 * 60);
    }

    /**
     * Check if time is within trading hours (9:30 AM - 2:30 PM IST)
     */
    isWithinMarketHours(unixTimestamp: number): boolean {
        const istMinutes = this.getISTTimeInMinutes(unixTimestamp);
        return istMinutes >= 570 && istMinutes < 870;
    }

    /**
     * Check if time is at market close (2:30 PM IST)
     */
    private isForceCloseTime(unixTimestamp: number): boolean {
        const istMinutes = this.getISTTimeInMinutes(unixTimestamp);
        return istMinutes >= 870;
    }

    /**
     * Simulate trades from signals
     * Generic: BUY opens position, SELL or market close exits
     * Returns trades + tracking data for metrics
     */
    simulateTrades(
        signals: Signal[],
        ohlcData: CandlestickData[],
        config: BacktestConfig = { initialCapital: 100, quantity: 1 }
    ): { trades: Trade[]; barsInPosition: number; totalMarketBars: number; equity: { time: number; value: number }[] } {
        const trades: Trade[] = [];
        const equity: { time: number; value: number }[] = [];
        let position: { entryTime: number; entryPrice: number; indicators: Record<string, number | boolean | string> } | null = null;
        let tradeCount = 0;
        let barsInPosition = 0;
        let totalMarketBars = 0;
        let currentEquity = config.initialCapital;

        const signalMap = new Map<number, Signal>();
        for (const signal of signals) {
            signalMap.set(signal.time, signal);
        }

        const { quantity } = config;

        const createTrade = (
            exitTime: number,
            exitPrice: number,
            exitReason: 'Signal' | 'MarketClose',
            exitIndicators: Record<string, number | boolean | string> = {}
        ): Trade => {
            const pos = position!;
            tradeCount++;

            const grossPnl = (exitPrice - pos.entryPrice) * quantity;
            const costs = calculateIntradayTradeCosts({
                buyPrice: pos.entryPrice,
                sellPrice: exitPrice,
                quantity,
                exchange: 'NSE'
            });
            const netPnl = grossPnl - costs.totalCost;
            const pnlPercent = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;

            const entryDate = new Date(pos.entryTime * 1000);
            const exitDate = new Date(exitTime * 1000);
            const durationMins = Math.round((exitTime - pos.entryTime) / 60);
            const duration = durationMins < 60 ? `${durationMins}min` : `${Math.floor(durationMins / 60)}h ${durationMins % 60}min`;

            // Update equity after trade closes
            currentEquity += netPnl;

            return {
                id: `trade-${tradeCount}`,
                entryDate: this.formatDateTime(entryDate),
                exitDate: this.formatDateTime(exitDate),
                entryTime: pos.entryTime,
                exitTime: exitTime,
                direction: 'Long',
                entryPrice: parseFloat(pos.entryPrice.toFixed(2)),
                exitPrice: parseFloat(exitPrice.toFixed(2)),
                quantity,
                grossPnl: parseFloat(grossPnl.toFixed(2)),
                pnl: parseFloat(netPnl.toFixed(2)),
                pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                duration,
                signal: 'Buy',
                slippage: 0,
                costs,
                indicators: { ...pos.indicators, ...exitIndicators },
                exitReason
            };
        };

        for (let i = 0; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;

            // Count market bars within trading hours
            if (this.isWithinMarketHours(barTime)) {
                totalMarketBars++;
            }

            // Track bars in position
            if (position !== null) {
                barsInPosition++;

                if (this.isForceCloseTime(barTime)) {
                    const exitPrice = bar.close * (1 - this.SLIPPAGE_PERCENT);
                    const trade = createTrade(barTime, exitPrice, 'MarketClose');
                    trades.push(trade);
                    equity.push({ time: barTime, value: currentEquity });
                    position = null;
                    continue;
                }

                const signal = signalMap.get(barTime);
                if (signal && signal.type === 'SELL') {
                    const exitPrice = signal.price * (1 - this.SLIPPAGE_PERCENT);
                    const trade = createTrade(barTime, exitPrice, 'Signal', signal.indicators);
                    trades.push(trade);
                    equity.push({ time: barTime, value: currentEquity });
                    position = null;
                    continue;
                }
            }

            const signal = signalMap.get(barTime);
            if (signal && signal.type === 'BUY' && position === null && this.isWithinMarketHours(barTime)) {
                const entryPrice = signal.price * (1 + this.SLIPPAGE_PERCENT);
                position = {
                    entryTime: barTime,
                    entryPrice: entryPrice,
                    indicators: signal.indicators
                };
            }
        }

        if (position !== null) {
            const lastBar = ohlcData[ohlcData.length - 1];
            const exitPrice = lastBar.close * (1 - this.SLIPPAGE_PERCENT);
            const trade = createTrade(lastBar.time as number, exitPrice, 'MarketClose');
            trades.push(trade);
            equity.push({ time: lastBar.time as number, value: currentEquity });
        }

        return { trades, barsInPosition, totalMarketBars, equity };
    }

    /**
     * Calculate all metrics for all timeframes
     * @param trades - List of executed trades
     * @param initialCapital - Starting capital (default ₹100)
     * @param barsInPosition - Total bars where position was held
     * @param totalMarketBars - Total market bars in the backtest period
     */
    calculateMetrics(
        trades: Trade[],
        initialCapital: number = 100,
        barsInPosition: number = 0,
        totalMarketBars: number = 1
    ): Metrics {
        if (trades.length === 0) {
            return this.getEmptyMetrics();
        }

        const timeInMarket = totalMarketBars > 0 ? (barsInPosition / totalMarketBars) * 100 : 0;

        return {
            daily: this.calculatePeriodMetrics(trades, 'daily', initialCapital, timeInMarket),
            weekly: this.calculatePeriodMetrics(trades, 'weekly', initialCapital, timeInMarket),
            monthly: this.calculatePeriodMetrics(trades, 'monthly', initialCapital, timeInMarket),
            quarterly: this.calculatePeriodMetrics(trades, 'quarterly', initialCapital, timeInMarket),
            yearly: this.calculatePeriodMetrics(trades, 'yearly', initialCapital, timeInMarket),
            overall: this.calculateOverallMetrics(trades, initialCapital, timeInMarket),
        };
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
     * Group trades by period
     */
    private groupTradesByPeriod(trades: Trade[], periodType: string): Map<string, Trade[]> {
        const groups = new Map<string, Trade[]>();

        for (const trade of trades) {
            const dateStr = trade.entryDate;
            const dateParts = dateStr.match(/(\d+)\s+(\w+)\s+(\d+)/);
            if (!dateParts) continue;

            const day = parseInt(dateParts[1]);
            const month = dateParts[2];
            const year = parseInt(dateParts[3]);

            let key: string;
            switch (periodType) {
                case 'daily':
                    key = `${day}-${month}-${year}`;
                    break;
                case 'weekly':
                    const weekNum = Math.ceil(day / 7);
                    key = `W${weekNum}-${month}-${year}`;
                    break;
                case 'monthly':
                    key = `${month}-${year}`;
                    break;
                case 'quarterly':
                    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
                    const quarter = Math.floor(monthIndex / 3) + 1;
                    key = `Q${quarter}-${year}`;
                    break;
                case 'yearly':
                    key = `${year}`;
                    break;
                default:
                    key = 'all';
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(trade);
        }

        return groups;
    }

    /**
     * Calculate metrics for a period (averaged)
     */
    private calculatePeriodMetrics(trades: Trade[], periodType: string, initialCapital: number, timeInMarket: number): MetricData {
        if (trades.length === 0) return this.getEmptyMetricData();

        const groups = this.groupTradesByPeriod(trades, periodType);
        if (groups.size === 0) return this.getEmptyMetricData();

        const periodMetrics: MetricData[] = [];
        for (const [, periodTrades] of groups) {
            const metrics = this.calculateSinglePeriodMetrics(periodTrades, initialCapital);
            if (metrics) periodMetrics.push(metrics);
        }

        if (periodMetrics.length === 0) return this.getEmptyMetricData();

        const n = periodMetrics.length;
        return {
            return: parseFloat((periodMetrics.reduce((s, m) => s + m.return, 0) / n).toFixed(2)),
            sharpeRatio: parseFloat((periodMetrics.reduce((s, m) => s + m.sharpeRatio, 0) / n).toFixed(2)),
            maxDrawdown: parseFloat((periodMetrics.reduce((s, m) => s + m.maxDrawdown, 0) / n).toFixed(2)),
            winRate: parseFloat((periodMetrics.reduce((s, m) => s + m.winRate, 0) / n).toFixed(2)),
            lossRate: parseFloat((periodMetrics.reduce((s, m) => s + m.lossRate, 0) / n).toFixed(2)),
            totalTrades: Math.round(periodMetrics.reduce((s, m) => s + m.totalTrades, 0) / n),
            profitFactor: parseFloat(Math.min(periodMetrics.reduce((s, m) => s + m.profitFactor, 0) / n, 99.99).toFixed(2)),
            expectancy: parseFloat((periodMetrics.reduce((s, m) => s + m.expectancy, 0) / n).toFixed(2)),
            avgWin: parseFloat((periodMetrics.reduce((s, m) => s + m.avgWin, 0) / n).toFixed(2)),
            avgLoss: parseFloat((periodMetrics.reduce((s, m) => s + m.avgLoss, 0) / n).toFixed(2)),
            payoffRatio: parseFloat((periodMetrics.reduce((s, m) => s + m.payoffRatio, 0) / n).toFixed(2)),
            recoveryFactor: parseFloat((periodMetrics.reduce((s, m) => s + m.recoveryFactor, 0) / n).toFixed(2)),
            maxConsecutiveWins: Math.max(...periodMetrics.map(m => m.maxConsecutiveWins)),
            maxConsecutiveLosses: Math.max(...periodMetrics.map(m => m.maxConsecutiveLosses)),
            riskRewardRatio: parseFloat((periodMetrics.reduce((s, m) => s + m.riskRewardRatio, 0) / n).toFixed(2)),
            timeInMarket: parseFloat(timeInMarket.toFixed(2)),
        };
    }

    /**
     * Calculate metrics for a single period
     */
    private calculateSinglePeriodMetrics(trades: Trade[], initialCapital: number = 100): MetricData | null {
        if (trades.length === 0) return null;

        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const totalReturn = (totalPnl / initialCapital) * 100;

        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);
        const winRate = (winningTrades.length / trades.length) * 100;

        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

        const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

        const maxDrawdown = this.calculateMaxDrawdown(trades, initialCapital);

        const returns = trades.map(t => t.pnlPercent / 100);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
        const sharpeRatio = stdDev > 0 ? (avgReturn - this.RISK_FREE_RATE / 252) / stdDev : 0;

        const winRateDecimal = winningTrades.length / trades.length;
        const expectancy = (winRateDecimal * avgWin) - ((1 - winRateDecimal) * avgLoss);

        const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateConsecutiveStreaks(trades);

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
            payoffRatio: parseFloat((avgLoss > 0 ? avgWin / avgLoss : 0).toFixed(2)),
            recoveryFactor: parseFloat((maxDrawdown !== 0 ? Math.abs(totalReturn / maxDrawdown) : 0).toFixed(2)),
            maxConsecutiveWins,
            maxConsecutiveLosses,
            riskRewardRatio: parseFloat((avgLoss > 0 ? avgWin / avgLoss : 0).toFixed(2)),
            timeInMarket: 0,
        };
    }

    /**
     * Calculate overall metrics
     */
    private calculateOverallMetrics(trades: Trade[], initialCapital: number, timeInMarket: number): MetricData {
        const metrics = this.calculateSinglePeriodMetrics(trades, initialCapital);
        if (!metrics) return this.getEmptyMetricData();

        const returns = trades.map(t => t.pnlPercent / 100);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
        const annualizedSharpe = stdDev > 0
            ? (avgReturn * Math.sqrt(252) - this.RISK_FREE_RATE) / (stdDev * Math.sqrt(252))
            : 0;

        return {
            ...metrics,
            sharpeRatio: parseFloat(annualizedSharpe.toFixed(2)),
            timeInMarket: parseFloat(timeInMarket.toFixed(2)),
        };
    }

    /**
     * Calculate max drawdown
     */
    private calculateMaxDrawdown(trades: Trade[], initialCapital: number): number {
        let peak = initialCapital;
        let maxDrawdown = 0;
        let equity = initialCapital;

        for (const trade of trades) {
            equity += trade.pnl;
            if (equity > peak) peak = equity;
            const drawdown = ((peak - equity) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        return -maxDrawdown;
    }

    /**
     * Calculate consecutive streaks
     */
    private calculateConsecutiveStreaks(trades: Trade[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
        let maxWins = 0, maxLosses = 0, currentWins = 0, currentLosses = 0;

        for (const trade of trades) {
            if (trade.pnl > 0) {
                currentWins++;
                currentLosses = 0;
                if (currentWins > maxWins) maxWins = currentWins;
            } else {
                currentLosses++;
                currentWins = 0;
                if (currentLosses > maxLosses) maxLosses = currentLosses;
            }
        }

        return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
    }

    /**
     * Get empty metrics structure
     */
    private getEmptyMetrics(): Metrics {
        const empty = this.getEmptyMetricData();
        return { daily: empty, weekly: empty, monthly: empty, quarterly: empty, yearly: empty, overall: empty };
    }

    /**
     * Get empty metric data
     */
    private getEmptyMetricData(): MetricData {
        return {
            return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0,
            totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0,
            payoffRatio: 0, recoveryFactor: 0, maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
            riskRewardRatio: 0, timeInMarket: 0,
        };
    }
}

// Export singleton instance
export const backtestEngine = new BacktestEngine();
