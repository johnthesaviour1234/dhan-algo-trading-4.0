/**
 * EMA 3/15 Simple Strategy - Main Implementation
 * 
 * v1.5.0 - Improved Filters & R:R
 * 
 * Entry: EMA 3 crosses above EMA 15, ADX > 40, EMA Gap >= 0.1%
 * Exit: Stop Loss (ATR×2) OR Target Profit (ATR×4) OR Market Close
 * 
 * v1.5.0 adds: EMA gap filter, time filter (skip 09:45-10:15), 1:2 R:R
 */

import { CandlestickData } from 'lightweight-charts';
import { BaseStrategy, Signal, BaseTrade, BasicMetrics } from '../BaseStrategy';
import { EMASimpleConfig, EMASimpleAnalytics, EMASimpleExport, DEFAULT_CONFIG } from './types';
import { IndicatorCalculator } from '../../utils/IndicatorCalculator';
import { backtestEngine, Trade, Metrics } from '../../lib/BacktestEngine';

export class EMASimpleStrategy implements BaseStrategy<EMASimpleConfig, EMASimpleAnalytics, EMASimpleExport> {
    readonly name = 'EMA 3/15 Simple';
    readonly version = '1.5.0';
    readonly description = 'EMA 3/15 + EMA gap filter + time filter + 1:2 R:R';

    // Indicators this strategy tracks
    getIndicatorNames(): string[] {
        return [
            'EMA 3',
            'EMA 15',
            'EMA Gap %',
            'ADX',
            'ATR',
            'RSI',
            'Price > EMA3',
            'Price Dist %',
            'Hour',
            'Day',
            'Bars Since Cross',
            'SL Price',
            'TP Price'
        ];
    }

    /**
     * Generate trading signals from OHLC data
     * v1.5.0: BUY signals with EMA gap filter, time filter, improved R:R
     */
    generateSignals(ohlcData: CandlestickData[], config: EMASimpleConfig = DEFAULT_CONFIG): Signal[] {
        const signals: Signal[] = [];
        const fastPeriod = config.params.fastPeriod;
        const slowPeriod = config.params.slowPeriod;
        const atrPeriod = config.params.atrPeriod || 14;
        const atrMultiplierSL = config.params.atrMultiplierSL || 2;  // v1.5.0: tighter SL
        const atrMultiplierTP = config.params.atrMultiplierTP || 4;  // v1.5.0: wider TP (1:2 R:R)

        // v1.5.0: New filters
        const minEmaGap = config.params.minEmaGap || 0;
        const skipTimeStart = config.params.skipTimeStart || '';
        const skipTimeEnd = config.params.skipTimeEnd || '';

        // Extract prices
        const closePrices = ohlcData.map(bar => bar.close);
        const highs = ohlcData.map(bar => bar.high);
        const lows = ohlcData.map(bar => bar.low);

        // Minimum data required
        const minBars = Math.max(slowPeriod, atrPeriod, 14) + 5;
        if (ohlcData.length < minBars) {
            console.warn(`⚠️ [EMA Simple v1.5.0] Not enough data: ${ohlcData.length} bars, need ${minBars}`);
            return signals;
        }

        // Pre-compute indicators
        console.log(`📊 [EMA Simple v1.5.0] Pre-computing indicators for ${ohlcData.length} bars...`);
        const emaFastValues = IndicatorCalculator.calculateAllEMAs(closePrices, fastPeriod);
        const emaSlowValues = IndicatorCalculator.calculateAllEMAs(closePrices, slowPeriod);
        const adxValues = IndicatorCalculator.calculateAllADX(highs, lows, closePrices, 14);
        const atrValues = IndicatorCalculator.calculateAllATR(highs, lows, closePrices, atrPeriod);
        const rsiValues = IndicatorCalculator.calculateAllRSIs(closePrices, 14);

        // v1.5.0: Parse skip time window
        const parseTime = (timeStr: string): number => {
            if (!timeStr) return -1;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        const skipStart = parseTime(skipTimeStart);
        const skipEnd = parseTime(skipTimeEnd);

        let prevFast: number | null = null;
        let prevSlow: number | null = null;
        let barsSinceCross = 0;
        let isInPosition = false;
        let skippedEmaGap = 0;
        let skippedTime = 0;

        for (let i = minBars; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;
            const barDate = new Date(barTime * 1000);

            const emaFast = emaFastValues[i];
            const emaSlow = emaSlowValues[i];
            const adx = adxValues[i];
            const atr = atrValues[i];
            const rsi = rsiValues[i];

            if (emaFast === null || emaSlow === null || atr === null) continue;

            // Calculate analytics indicators
            const emaGapPercent = ((emaFast - emaSlow) / emaSlow) * 100;
            const priceAboveEma3 = bar.close > emaFast;
            const priceDistFromEma3 = ((bar.close - emaFast) / emaFast) * 100;
            const entryHour = barDate.getHours();
            const entryMinute = barDate.getMinutes();
            const dayOfWeek = barDate.toLocaleDateString('en-US', { weekday: 'short' });
            const currentTimeMinutes = entryHour * 60 + entryMinute;

            // Calculate SL/TP levels for potential entry
            const stopLoss = bar.close - (atr * atrMultiplierSL);
            const takeProfit = bar.close + (atr * atrMultiplierTP);

            // v1.5.0: Get max hold time from config
            const maxHoldMinutes = config.params.maxHoldMinutes || 0;

            const indicators: Record<string, number | boolean | string> = {
                'EMA 3': parseFloat(emaFast.toFixed(4)),
                'EMA 15': parseFloat(emaSlow.toFixed(4)),
                'EMA Gap %': parseFloat(emaGapPercent.toFixed(3)),
                'ADX': adx ? parseFloat(adx.toFixed(2)) : 0,
                'ATR': parseFloat(atr.toFixed(4)),
                'RSI': rsi ? parseFloat(rsi.toFixed(2)) : 50,
                'Price > EMA3': priceAboveEma3,
                'Price Dist %': parseFloat(priceDistFromEma3.toFixed(3)),
                'Hour': `${entryHour}:${entryMinute.toString().padStart(2, '0')}`,
                'Day': dayOfWeek,
                'Bars Since Cross': barsSinceCross,
                'SL Price': parseFloat(stopLoss.toFixed(2)),
                'TP Price': parseFloat(takeProfit.toFixed(2)),
                'Max Hold Min': maxHoldMinutes,  // v1.5.0: Max hold time in minutes
            };

            // Detect crossover
            if (prevFast !== null && prevSlow !== null) {
                const crossover = IndicatorCalculator.detectCrossover(emaFast, emaSlow, prevFast, prevSlow);

                if (crossover === 'bullish' && !isInPosition) {
                    const adxThreshold = config.params.adxThreshold || 0;
                    const currentAdx = adx || 0;

                    // v1.5.0: EMA gap filter - skip sideways markets
                    if (minEmaGap > 0 && Math.abs(emaGapPercent) < minEmaGap) {
                        skippedEmaGap++;
                        barsSinceCross = 0;
                        prevFast = emaFast;
                        prevSlow = emaSlow;
                        continue;
                    }

                    // v1.5.0: Time filter - skip gap reversal zone
                    if (skipStart >= 0 && skipEnd >= 0 && currentTimeMinutes >= skipStart && currentTimeMinutes <= skipEnd) {
                        skippedTime++;
                        barsSinceCross = 0;
                        prevFast = emaFast;
                        prevSlow = emaSlow;
                        continue;
                    }

                    if (adxThreshold === 0 || currentAdx > adxThreshold) {
                        signals.push({
                            time: barTime,
                            type: 'BUY',
                            price: bar.close,
                            indicators: { ...indicators, 'Signal': 'BUY' }
                        });
                        isInPosition = true;
                    }
                    barsSinceCross = 0;
                } else if (crossover === 'bearish') {
                    isInPosition = false;
                    barsSinceCross = 0;
                } else {
                    barsSinceCross++;
                }
            }

            prevFast = emaFast;
            prevSlow = emaSlow;
        }

        console.log(`📊 [EMA Simple v1.5.0] Generated ${signals.length} BUY signals`);
        console.log(`   Skipped: ${skippedEmaGap} (EMA gap < ${minEmaGap}%), ${skippedTime} (time filter)`);
        return signals;
    }

    /**
     * Calculate strategy-specific analytics
     */
    calculateAnalytics(trades: BaseTrade[]): EMASimpleAnalytics {
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);

        // Hourly performance
        const hourlyMap = new Map<string, { trades: number; wins: number; pnl: number }>();
        trades.forEach(t => {
            const hour = (t.indicators['Hour'] as string)?.split(':')[0] + ':00' || 'Unknown';
            const existing = hourlyMap.get(hour) || { trades: 0, wins: 0, pnl: 0 };
            hourlyMap.set(hour, {
                trades: existing.trades + 1,
                wins: existing.wins + (t.pnl > 0 ? 1 : 0),
                pnl: existing.pnl + t.pnl
            });
        });
        const hourlyPerformance = Array.from(hourlyMap.entries())
            .map(([hour, data]) => ({
                hour,
                trades: data.trades,
                winRate: (data.wins / data.trades) * 100,
                avgPnl: data.pnl / data.trades,
                totalPnl: data.pnl
            }))
            .sort((a, b) => a.hour.localeCompare(b.hour));

        // Day of week performance
        const dayMap = new Map<string, { trades: number; wins: number; pnl: number }>();
        trades.forEach(t => {
            const day = (t.indicators['Day'] as string) || 'Unknown';
            const existing = dayMap.get(day) || { trades: 0, wins: 0, pnl: 0 };
            dayMap.set(day, {
                trades: existing.trades + 1,
                wins: existing.wins + (t.pnl > 0 ? 1 : 0),
                pnl: existing.pnl + t.pnl
            });
        });
        const dayOfWeekPerformance = Array.from(dayMap.entries())
            .map(([day, data]) => ({
                day,
                trades: data.trades,
                winRate: (data.wins / data.trades) * 100,
                avgPnl: data.pnl / data.trades,
                totalPnl: data.pnl
            }));

        // EMA Gap analysis
        const avgGapOnWinners = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + ((t.indicators['EMA Gap %'] as number) || 0), 0) / winningTrades.length
            : 0;
        const avgGapOnLosers = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + ((t.indicators['EMA Gap %'] as number) || 0), 0) / losingTrades.length
            : 0;

        // RSI analysis
        const avgRsiOnWinners = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + ((t.indicators['RSI'] as number) || 50), 0) / winningTrades.length
            : 50;
        const avgRsiOnLosers = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + ((t.indicators['RSI'] as number) || 50), 0) / losingTrades.length
            : 50;

        // NEW v1.3.0: Duration analysis - parse duration strings like "1min", "5min", etc.
        const parseDuration = (d: string): number => {
            const match = d.match(/(\d+)min/);
            return match ? parseInt(match[1]) : 0;
        };
        const under1minTrades = trades.filter(t => parseDuration(t.duration) <= 1);
        const between1and5minTrades = trades.filter(t => {
            const d = parseDuration(t.duration);
            return d > 1 && d <= 5;
        });
        const over5minTrades = trades.filter(t => parseDuration(t.duration) > 5);

        const calcDurationStats = (arr: BaseTrade[]) => ({
            trades: arr.length,
            winRate: arr.length > 0 ? (arr.filter(t => t.pnl > 0).length / arr.length) * 100 : 0,
            avgPnl: arr.length > 0 ? arr.reduce((s, t) => s + t.pnl, 0) / arr.length : 0
        });

        // NEW v1.3.0: Gross vs Net analysis
        const totalGrossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
        const totalNetPnl = trades.reduce((s, t) => s + t.pnl, 0);
        const totalCosts = trades.reduce((s, t) => s + (t.costs?.totalCost || 0), 0);
        const grossWinners = trades.filter(t => t.grossPnl > 0);
        const netWinners = trades.filter(t => t.pnl > 0);

        // NEW v1.3.0: Market condition analysis - EMA Gap distribution
        const emaGapThreshold = 0.1;  // 0.1% gap threshold
        const tradesUnderGap = trades.filter(t => Math.abs((t.indicators['EMA Gap %'] as number) || 0) < emaGapThreshold);
        const tradesOverGap = trades.filter(t => Math.abs((t.indicators['EMA Gap %'] as number) || 0) >= emaGapThreshold);
        const winnersUnderGap = tradesUnderGap.filter(t => t.pnl > 0);
        const winnersOverGap = tradesOverGap.filter(t => t.pnl > 0);

        return {
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            hourlyPerformance,
            dayOfWeekPerformance,
            emaGapAnalysis: {
                avgGapOnWinners: parseFloat(avgGapOnWinners.toFixed(3)),
                avgGapOnLosers: parseFloat(avgGapOnLosers.toFixed(3))
            },
            rsiAnalysis: {
                avgRsiOnWinners: parseFloat(avgRsiOnWinners.toFixed(2)),
                avgRsiOnLosers: parseFloat(avgRsiOnLosers.toFixed(2))
            },
            durationAnalysis: {
                under1min: calcDurationStats(under1minTrades),
                between1and5min: calcDurationStats(between1and5minTrades),
                over5min: calcDurationStats(over5minTrades)
            },
            grossVsNetAnalysis: {
                totalGrossPnl: parseFloat(totalGrossPnl.toFixed(2)),
                totalNetPnl: parseFloat(totalNetPnl.toFixed(2)),
                totalCosts: parseFloat(totalCosts.toFixed(2)),
                grossWinRate: trades.length > 0 ? parseFloat(((grossWinners.length / trades.length) * 100).toFixed(2)) : 0,
                netWinRate: trades.length > 0 ? parseFloat(((netWinners.length / trades.length) * 100).toFixed(2)) : 0
            },
            marketConditionAnalysis: {
                avgEmaGapOnWinners: parseFloat(avgGapOnWinners.toFixed(3)),
                avgEmaGapOnLosers: parseFloat(avgGapOnLosers.toFixed(3)),
                tradesWithEmaGapUnder0_1: tradesUnderGap.length,
                tradesWithEmaGapOver0_1: tradesOverGap.length,
                winRateWithEmaGapUnder0_1: tradesUnderGap.length > 0 ? parseFloat(((winnersUnderGap.length / tradesUnderGap.length) * 100).toFixed(2)) : 0,
                winRateWithEmaGapOver0_1: tradesOverGap.length > 0 ? parseFloat(((winnersOverGap.length / tradesOverGap.length) * 100).toFixed(2)) : 0
            }
        };
    }

    /**
     * Format data for export (clean, strategy-specific format)
     */
    formatExport(
        trades: BaseTrade[],
        metrics: BasicMetrics,
        analytics: EMASimpleAnalytics,
        dateRange: { start: string; end: string }
    ): EMASimpleExport {
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

        return {
            exportDate: new Date().toISOString(),
            strategy: {
                name: this.name,
                version: this.version,
                description: this.description
            },
            backtestPeriod: dateRange,
            summary: {
                totalTrades: analytics.totalTrades,
                winningTrades: analytics.winningTrades,
                losingTrades: analytics.losingTrades,
                winRate: metrics.winRate,
                profitFactor: metrics.profitFactor,
                expectancy: metrics.expectancy,
                avgWin: metrics.avgWin,
                avgLoss: metrics.avgLoss,
                totalPnl: parseFloat(totalPnl.toFixed(2))
            },
            analytics,
            trades: trades.map((t, idx) => ({
                tradeNumber: idx + 1,
                entryDate: t.entryDate,
                exitDate: t.exitDate,
                direction: t.direction,
                entryPrice: t.entryPrice,
                exitPrice: t.exitPrice,
                grossPnl: t.grossPnl,
                netPnl: t.pnl,
                pnlPercent: t.pnlPercent,
                duration: t.duration,
                indicators: {
                    ema3: (t.indicators['EMA 3'] as number) || 0,
                    ema15: (t.indicators['EMA 15'] as number) || 0,
                    emaGapPercent: (t.indicators['EMA Gap %'] as number) || 0,
                    adx: (t.indicators['ADX'] as number) || 0,
                    rsi: (t.indicators['RSI'] as number) || 50,
                    priceAboveEma3: (t.indicators['Price > EMA3'] as boolean) || false,
                    priceDistPercent: (t.indicators['Price Dist %'] as number) || 0,
                    hour: (t.indicators['Hour'] as string) || '',
                    day: (t.indicators['Day'] as string) || '',
                    barsSinceCross: (t.indicators['Bars Since Cross'] as number) || 0
                }
            }))
        };
    }

    /**
     * Run complete backtest - orchestrates all layers
     * 
     * Flow:
     * 1. Strategy generates signals (with indicators)
     * 2. Engine simulates trades
     * 3. Engine calculates metrics
     * 4. Strategy calculates analytics
     */
    runBacktest(
        ohlcData: CandlestickData[],
        config: EMASimpleConfig = DEFAULT_CONFIG,
        initialCapital: number = 100
    ): { trades: Trade[]; metrics: Metrics; analytics: EMASimpleAnalytics; equity: { time: number; value: number }[] } {
        console.log(`🧪 [${this.name}] Running backtest on ${ohlcData.length} candles with ₹${initialCapital} capital`);

        // Step 1: Strategy generates signals
        const signals = this.generateSignals(ohlcData, config);

        // Step 2: Engine simulates trades (generic) with capital tracking
        const backtestConfig = { initialCapital, quantity: 1 };
        const { trades, barsInPosition, totalMarketBars, equity } = backtestEngine.simulateTrades(signals, ohlcData, backtestConfig);
        console.log(`✅ [${this.name}] ${trades.length} trades generated, Time in market: ${((barsInPosition / totalMarketBars) * 100).toFixed(1)}%`);

        // Step 3: Engine calculates metrics (generic) with capital and timeInMarket
        const metrics = backtestEngine.calculateMetrics(trades, initialCapital, barsInPosition, totalMarketBars);

        // Step 4: Strategy calculates analytics (strategy-specific)
        const analytics = this.calculateAnalytics(trades as unknown as BaseTrade[]);

        return { trades, metrics, analytics, equity };
    }
}

// Export singleton instance
export const emaSimpleStrategy = new EMASimpleStrategy();

