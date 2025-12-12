/**
 * EMA 3/15 Simple Strategy - Main Implementation
 * 
 * v1.0.0 - Pure baseline crossover strategy
 * 
 * Entry: EMA 3 crosses above EMA 15
 * Exit: EMA 3 crosses below EMA 15
 * 
 * No stop loss, no target, no filters.
 * Pure crossover to establish baseline for analysis.
 */

import { CandlestickData } from 'lightweight-charts';
import { BaseStrategy, Signal, BaseTrade, BasicMetrics } from '../BaseStrategy';
import { EMASimpleConfig, EMASimpleAnalytics, EMASimpleExport, DEFAULT_CONFIG } from './types';
import { IndicatorCalculator } from '../../utils/IndicatorCalculator';
import { backtestEngine, Trade, Metrics } from '../../lib/BacktestEngine';

export class EMASimpleStrategy implements BaseStrategy<EMASimpleConfig, EMASimpleAnalytics, EMASimpleExport> {
    readonly name = 'EMA 3/15 Simple';
    readonly version = '1.0.0';
    readonly description = 'Pure EMA 3/15 crossover baseline - no filters, no SL/TP';

    // Indicators this strategy tracks
    getIndicatorNames(): string[] {
        return [
            'EMA 3',
            'EMA 15',
            'EMA Gap %',
            'ADX',
            'RSI',
            'Price > EMA3',
            'Price Dist %',
            'Hour',
            'Day',
            'Bars Since Cross'
        ];
    }

    /**
     * Generate trading signals from OHLC data
     */
    generateSignals(ohlcData: CandlestickData[], config: EMASimpleConfig = DEFAULT_CONFIG): Signal[] {
        const signals: Signal[] = [];
        const fastPeriod = config.params.fastPeriod;
        const slowPeriod = config.params.slowPeriod;

        // Extract close prices
        const closePrices = ohlcData.map(bar => bar.close);
        const highs = ohlcData.map(bar => bar.high);
        const lows = ohlcData.map(bar => bar.low);

        // Minimum data required
        const minBars = Math.max(slowPeriod, 14) + 5;
        if (ohlcData.length < minBars) {
            console.warn(`⚠️ [EMA Simple] Not enough data: ${ohlcData.length} bars, need ${minBars}`);
            return signals;
        }

        // Pre-compute indicators
        console.log(`📊 [EMA Simple] Pre-computing indicators for ${ohlcData.length} bars...`);
        const emaFastValues = IndicatorCalculator.calculateAllEMAs(closePrices, fastPeriod);
        const emaSlowValues = IndicatorCalculator.calculateAllEMAs(closePrices, slowPeriod);
        const adxValues = IndicatorCalculator.calculateAllADX(highs, lows, closePrices, 14);
        const rsiValues = IndicatorCalculator.calculateAllRSIs(closePrices, 14);

        let prevFast: number | null = null;
        let prevSlow: number | null = null;
        let barsSinceCross = 0;

        for (let i = minBars; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;
            const barDate = new Date(barTime * 1000);

            const emaFast = emaFastValues[i];
            const emaSlow = emaSlowValues[i];
            const adx = adxValues[i];
            const rsi = rsiValues[i];

            if (emaFast === null || emaSlow === null) continue;

            // Calculate analytics indicators
            const emaGapPercent = ((emaFast - emaSlow) / emaSlow) * 100;
            const priceAboveEma3 = bar.close > emaFast;
            const priceDistFromEma3 = ((bar.close - emaFast) / emaFast) * 100;
            const entryHour = barDate.getHours();
            const entryMinute = barDate.getMinutes();
            const dayOfWeek = barDate.toLocaleDateString('en-US', { weekday: 'short' });

            const indicators: Record<string, number | boolean | string> = {
                'EMA 3': parseFloat(emaFast.toFixed(4)),
                'EMA 15': parseFloat(emaSlow.toFixed(4)),
                'EMA Gap %': parseFloat(emaGapPercent.toFixed(3)),
                'ADX': adx ? parseFloat(adx.toFixed(2)) : 0,
                'RSI': rsi ? parseFloat(rsi.toFixed(2)) : 50,
                'Price > EMA3': priceAboveEma3,
                'Price Dist %': parseFloat(priceDistFromEma3.toFixed(3)),
                'Hour': `${entryHour}:${entryMinute.toString().padStart(2, '0')}`,
                'Day': dayOfWeek,
                'Bars Since Cross': barsSinceCross,
            };

            // Detect crossover
            if (prevFast !== null && prevSlow !== null) {
                const crossover = IndicatorCalculator.detectCrossover(emaFast, emaSlow, prevFast, prevSlow);

                if (crossover === 'bullish') {
                    signals.push({ time: barTime, type: 'BUY', price: bar.close, indicators: { ...indicators, 'Signal': 'BUY' } });
                    barsSinceCross = 0;
                } else if (crossover === 'bearish') {
                    signals.push({ time: barTime, type: 'SELL', price: bar.close, indicators: { ...indicators, 'Signal': 'SELL' } });
                    barsSinceCross = 0;
                } else {
                    barsSinceCross++;
                }
            }

            prevFast = emaFast;
            prevSlow = emaSlow;
        }

        console.log(`📊 [EMA Simple] Generated ${signals.length} signals from ${ohlcData.length} bars`);
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
    ): { trades: Trade[]; metrics: Metrics; analytics: EMASimpleAnalytics } {
        console.log(`🧪 [${this.name}] Running backtest on ${ohlcData.length} candles with ₹${initialCapital} capital`);

        // Step 1: Strategy generates signals
        const signals = this.generateSignals(ohlcData, config);

        // Step 2: Engine simulates trades (generic) with capital tracking
        const backtestConfig = { initialCapital, quantity: 1 };
        const { trades, barsInPosition, totalMarketBars } = backtestEngine.simulateTrades(signals, ohlcData, backtestConfig);
        console.log(`✅ [${this.name}] ${trades.length} trades generated, Time in market: ${((barsInPosition / totalMarketBars) * 100).toFixed(1)}%`);

        // Step 3: Engine calculates metrics (generic) with capital and timeInMarket
        const metrics = backtestEngine.calculateMetrics(trades, initialCapital, barsInPosition, totalMarketBars);

        // Step 4: Strategy calculates analytics (strategy-specific)
        const analytics = this.calculateAnalytics(trades as unknown as BaseTrade[]);

        return { trades, metrics, analytics };
    }
}

// Export singleton instance
export const emaSimpleStrategy = new EMASimpleStrategy();

