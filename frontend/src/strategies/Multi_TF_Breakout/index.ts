/**
 * Multi-TF Breakout Strategy - Main Implementation
 * 
 * v1.0.0 - Initial Implementation
 * 
 * Entry: Close > ALL previous HTF highs (1H, Day, Week, Month) for LONG
 *        Close < ALL previous HTF lows (1H, Day, Week, Month) for SHORT
 * Exit: Stop Loss (prev 1H low/high) OR Target Profit (1:1 R:R) OR Market Close
 * 
 * Reset mechanism: After trade closes, need pullback before re-entry
 */

import { CandlestickData } from 'lightweight-charts';
import { BaseStrategy, Signal, BaseTrade, BasicMetrics } from '../BaseStrategy';
import { MultiTFBreakoutConfig, MultiTFBreakoutAnalytics, MultiTFBreakoutExport, HTFLevels, DEFAULT_CONFIG } from './types';
import { backtestEngine, Trade, Metrics } from '../../lib/BacktestEngine';

export class MultiTFBreakoutStrategy implements BaseStrategy<MultiTFBreakoutConfig, MultiTFBreakoutAnalytics, MultiTFBreakoutExport> {
    readonly name = 'Multi-TF Breakout';
    readonly version = '1.0.0';
    readonly description = 'Breakout when price exceeds all HTF levels (1H/D/W/M)';

    getIndicatorNames(): string[] {
        return [
            'Prev 1H High', 'Prev 1H Low',
            'Prev Day High', 'Prev Day Low',
            'Prev Week High', 'Prev Week Low',
            'Prev Month High', 'Prev Month Low',
            'SL Price', 'TP Price',
            'Long Reset', 'Short Reset',
            'All Levels Ready'
        ];
    }

    /**
     * Detect if a new hour/day/week/month has started
     * Note: Timestamps are UTC, JavaScript Date converts to local time automatically
     */
    private detectTimeframeBoundaries(prevDate: Date | null, currDate: Date): {
        new1H: boolean;
        newDay: boolean;
        newWeek: boolean;
        newMonth: boolean;
    } {
        if (!prevDate) {
            return { new1H: true, newDay: true, newWeek: true, newMonth: true };
        }

        // Use local time (already in IST if system is set to IST)
        // Don't double-convert!
        const new1H = currDate.getHours() !== prevDate.getHours();
        const newDay = currDate.getDate() !== prevDate.getDate() ||
            currDate.getMonth() !== prevDate.getMonth() ||
            currDate.getFullYear() !== prevDate.getFullYear();

        // Week change: Monday to Monday
        const getWeekNumber = (d: Date) => {
            const start = new Date(d.getFullYear(), 0, 1);
            const diff = d.getTime() - start.getTime();
            return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
        };
        const newWeek = getWeekNumber(currDate) !== getWeekNumber(prevDate) ||
            currDate.getFullYear() !== prevDate.getFullYear();

        const newMonth = currDate.getMonth() !== prevDate.getMonth() ||
            currDate.getFullYear() !== prevDate.getFullYear();

        return { new1H, newDay, newWeek, newMonth };
    }

    /**
     * Check if time is within trading window
     * Note: Date is already in local time
     */
    private isWithinTradingWindow(date: Date, config: MultiTFBreakoutConfig): boolean {
        // Use local time directly (already in IST if system timezone is IST)
        const currentMinutes = date.getHours() * 60 + date.getMinutes();
        const startMinutes = config.params.startHour * 60 + config.params.startMinute;
        const endMinutes = config.params.endHour * 60 + config.params.endMinute;

        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    /**
     * Generate trading signals from OHLC data
     */
    generateSignals(ohlcData: CandlestickData[], config: MultiTFBreakoutConfig = DEFAULT_CONFIG): Signal[] {
        const signals: Signal[] = [];

        if (ohlcData.length < 100) {
            console.warn(`⚠️ [Multi-TF Breakout v1.0.0] Not enough data: ${ohlcData.length} bars`);
            return signals;
        }

        console.log(`📊 [Multi-TF Breakout v1.0.0] Processing ${ohlcData.length} bars...`);

        // Initialize HTF level tracking
        let levels: HTFLevels = {
            curr1HHigh: null, curr1HLow: null,
            currDayHigh: null, currDayLow: null,
            currWeekHigh: null, currWeekLow: null,
            currMonthHigh: null, currMonthLow: null,
            prev1HHigh: null, prev1HLow: null,
            prevDayHigh: null, prevDayLow: null,
            prevWeekHigh: null, prevWeekLow: null,
            prevMonthHigh: null, prevMonthLow: null,
            prev1HReady: false,
            prevDayReady: false,
            prevWeekReady: false,
            prevMonthReady: false,
        };

        // Reset mechanism tracking
        let longIsReset = true;
        let shortIsReset = true;
        let isInLongPosition = false;
        let isInShortPosition = false;

        let prevDate: Date | null = null;
        let debugCount = 0;
        let conditionsMet = 0;
        let withinWindowCount = 0;

        for (let i = 0; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;
            const barDate = new Date(barTime * 1000);
            const high = bar.high;
            const low = bar.low;
            const close = bar.close;

            // Detect timeframe boundaries
            const boundaries = this.detectTimeframeBoundaries(prevDate, barDate);

            // ============= 1H TRACKING =============
            if (boundaries.new1H) {
                levels.prev1HHigh = levels.curr1HHigh;
                levels.prev1HLow = levels.curr1HLow;
                levels.prev1HReady = levels.curr1HHigh !== null;
                levels.curr1HHigh = high;
                levels.curr1HLow = low;
            } else {
                if (levels.curr1HHigh === null || high > levels.curr1HHigh) levels.curr1HHigh = high;
                if (levels.curr1HLow === null || low < levels.curr1HLow) levels.curr1HLow = low;
            }

            // ============= DAILY TRACKING =============
            if (boundaries.newDay) {
                levels.prevDayHigh = levels.currDayHigh;
                levels.prevDayLow = levels.currDayLow;
                levels.prevDayReady = levels.currDayHigh !== null;
                levels.currDayHigh = high;
                levels.currDayLow = low;
            } else {
                if (levels.currDayHigh === null || high > levels.currDayHigh) levels.currDayHigh = high;
                if (levels.currDayLow === null || low < levels.currDayLow) levels.currDayLow = low;
            }

            // ============= WEEKLY TRACKING =============
            if (boundaries.newWeek) {
                levels.prevWeekHigh = levels.currWeekHigh;
                levels.prevWeekLow = levels.currWeekLow;
                levels.prevWeekReady = levels.currWeekHigh !== null;
                levels.currWeekHigh = high;
                levels.currWeekLow = low;
            } else {
                if (levels.currWeekHigh === null || high > levels.currWeekHigh) levels.currWeekHigh = high;
                if (levels.currWeekLow === null || low < levels.currWeekLow) levels.currWeekLow = low;
            }

            // ============= MONTHLY TRACKING =============
            if (boundaries.newMonth) {
                levels.prevMonthHigh = levels.currMonthHigh;
                levels.prevMonthLow = levels.currMonthLow;
                levels.prevMonthReady = levels.currMonthHigh !== null;
                levels.currMonthHigh = high;
                levels.currMonthLow = low;
            } else {
                if (levels.currMonthHigh === null || high > levels.currMonthHigh) levels.currMonthHigh = high;
                if (levels.currMonthLow === null || low < levels.currMonthLow) levels.currMonthLow = low;
            }

            // ============= CHECK ALL LEVELS READY =============
            const allLevelsReady = levels.prev1HReady && levels.prevDayReady &&
                levels.prevWeekReady && levels.prevMonthReady;

            if (!allLevelsReady) {
                prevDate = barDate;
                continue;
            }

            // ============= LONG ENTRY CONDITIONS =============
            const closeAboveAll = close > levels.prev1HHigh! &&
                close > levels.prevDayHigh! &&
                close > levels.prevWeekHigh! &&
                close > levels.prevMonthHigh!;

            // ============= SHORT ENTRY CONDITIONS =============
            const closeBelowAll = close < levels.prev1HLow! &&
                close < levels.prevDayLow! &&
                close < levels.prevWeekLow! &&
                close < levels.prevMonthLow!;

            // Debug: Count how many times conditions are met
            if (closeAboveAll || closeBelowAll) {
                conditionsMet++;
            }

            // ============= RESET MECHANISM =============
            // Long reset: Price breaks below ANY level
            const longResetTrigger = close < levels.prev1HHigh! || close < levels.prevDayHigh! ||
                close < levels.prevWeekHigh! || close < levels.prevMonthHigh! ||
                close < levels.prev1HLow! || close < levels.prevDayLow! ||
                close < levels.prevWeekLow! || close < levels.prevMonthLow!;

            // Short reset: Price breaks above ANY level  
            const shortResetTrigger = close > levels.prev1HHigh! || close > levels.prevDayHigh! ||
                close > levels.prevWeekHigh! || close > levels.prevMonthHigh! ||
                close > levels.prev1HLow! || close > levels.prevDayLow! ||
                close > levels.prevWeekLow! || close > levels.prevMonthLow!;

            // Update reset status
            if (!isInLongPosition && !longIsReset && longResetTrigger) {
                longIsReset = true;
            }
            if (!isInShortPosition && !shortIsReset && shortResetTrigger) {
                shortIsReset = true;
            }

            // ============= CALCULATE SL/TP =============
            const longStopLoss = levels.prev1HLow!;
            const longRisk = close - longStopLoss;
            const longTargetPrice = close + (longRisk * config.params.riskRewardRatio);

            const shortStopLoss = levels.prev1HHigh!;
            const shortRisk = shortStopLoss - close;
            const shortTargetPrice = close - (shortRisk * config.params.riskRewardRatio);

            // Build indicators
            const indicators: Record<string, number | boolean | string> = {
                'Prev 1H High': levels.prev1HHigh!,
                'Prev 1H Low': levels.prev1HLow!,
                'Prev Day High': levels.prevDayHigh!,
                'Prev Day Low': levels.prevDayLow!,
                'Prev Week High': levels.prevWeekHigh!,
                'Prev Week Low': levels.prevWeekLow!,
                'Prev Month High': levels.prevMonthHigh!,
                'Prev Month Low': levels.prevMonthLow!,
                'Long Reset': longIsReset,
                'Short Reset': shortIsReset,
                'All Levels Ready': allLevelsReady,
            };

            // Check if within trading window
            const withinWindow = this.isWithinTradingWindow(barDate, config);
            if (withinWindow) withinWindowCount++;

            // ============= GENERATE SIGNALS =============
            if (withinWindow && !isInLongPosition && !isInShortPosition) {
                // LONG entry
                if ((config.direction === 'long' || config.direction === 'both') &&
                    closeAboveAll && longRisk > 0 && longIsReset) {

                    // Debug first signal
                    if (signals.length === 0) {
                        console.log(`🎯 [Multi-TF Breakout] First LONG signal at ${barDate.toISOString()}`);
                        console.log(`   Close=${close}, 1H=${levels.prev1HHigh}, Day=${levels.prevDayHigh}, Week=${levels.prevWeekHigh}, Month=${levels.prevMonthHigh}`);
                    }

                    signals.push({
                        time: barTime,
                        type: 'BUY',
                        price: close,
                        indicators: {
                            ...indicators,
                            'SL Price': parseFloat(longStopLoss.toFixed(2)),
                            'TP Price': parseFloat(longTargetPrice.toFixed(2)),
                            'Signal': 'BUY',
                        }
                    });
                    isInLongPosition = true;
                    longIsReset = false;
                }
                // SHORT entry (only if direction allows)
                else if ((config.direction === 'short' || config.direction === 'both') &&
                    closeBelowAll && shortRisk > 0 && shortIsReset) {
                    signals.push({
                        time: barTime,
                        type: 'SELL',
                        price: close,
                        indicators: {
                            ...indicators,
                            'SL Price': parseFloat(shortStopLoss.toFixed(2)),
                            'TP Price': parseFloat(shortTargetPrice.toFixed(2)),
                            'Signal': 'SELL (Short Entry)',
                        }
                    });
                    isInShortPosition = true;
                    shortIsReset = false;
                }
            }

            // Reset position tracking on SL hit (for signal generation purposes)
            if (isInLongPosition && close < levels.prev1HLow!) {
                isInLongPosition = false;
            }
            if (isInShortPosition && close > levels.prev1HHigh!) {
                isInShortPosition = false;
            }

            prevDate = barDate;
        }

        // Debug: Log level readiness status
        console.log(`📊 [Multi-TF Breakout] Level Readiness: 1H=${levels.prev1HReady}, Day=${levels.prevDayReady}, Week=${levels.prevWeekReady}, Month=${levels.prevMonthReady}`);
        console.log(`📊 [Multi-TF Breakout] Bars in trading window: ${withinWindowCount}`);
        console.log(`📊 [Multi-TF Breakout] Entry conditions met: ${conditionsMet} times`);
        if (levels.prev1HReady && levels.prevDayReady && levels.prevWeekReady && levels.prevMonthReady) {
            console.log(`📊 [Multi-TF Breakout] Final Levels: 1H High=${levels.prev1HHigh?.toFixed(2)}, Day High=${levels.prevDayHigh?.toFixed(2)}, Week High=${levels.prevWeekHigh?.toFixed(2)}, Month High=${levels.prevMonthHigh?.toFixed(2)}`);
        }

        console.log(`📊 [Multi-TF Breakout v1.0.0] Generated ${signals.length} signals`);
        return signals;
    }

    /**
     * Calculate strategy-specific analytics
     */
    calculateAnalytics(trades: BaseTrade[]): MultiTFBreakoutAnalytics {
        const winningTrades = trades.filter(t => t.pnl > 0).length;
        const losingTrades = trades.filter(t => t.pnl <= 0).length;

        // Count exit reasons
        const exitReasons = {
            stopLoss: trades.filter(t => t.exitReason === 'StopLoss').length,
            takeProfit: trades.filter(t => t.exitReason === 'TakeProfit').length,
            marketClose: trades.filter(t => t.exitReason === 'MarketClose').length,
        };

        // Calculate average risk/reward
        let totalRisk = 0;
        let totalReward = 0;
        trades.forEach(t => {
            const sl = t.indicators['SL Price'] as number;
            const tp = t.indicators['TP Price'] as number;
            if (sl && tp) {
                totalRisk += Math.abs(t.entryPrice - sl);
                totalReward += Math.abs(tp - t.entryPrice);
            }
        });

        return {
            totalTrades: trades.length,
            winningTrades,
            losingTrades,
            winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
            exitReasons,
            levelBreakdowns: {
                avgRiskAmount: trades.length > 0 ? totalRisk / trades.length : 0,
                avgRewardAmount: trades.length > 0 ? totalReward / trades.length : 0,
            },
            resetStats: {
                tradesAfterReset: trades.length,  // All trades should be after reset
                tradesSkippedNoReset: 0,  // We don't track skipped signals
            }
        };
    }

    /**
     * Format data for export
     */
    formatExport(
        trades: BaseTrade[],
        metrics: BasicMetrics,
        analytics: MultiTFBreakoutAnalytics,
        dateRange: { start: string; end: string }
    ): MultiTFBreakoutExport {
        return {
            exportDate: new Date().toISOString(),
            backtestPeriod: dateRange,
            strategyInfo: {
                name: `${this.name} v${this.version}`,
                version: this.version,
                type: 'breakout',
                totalTrades: trades.length,
            },
            config: {
                direction: DEFAULT_CONFIG.direction,
                tradingWindow: `${DEFAULT_CONFIG.params.startHour}:${DEFAULT_CONFIG.params.startMinute.toString().padStart(2, '0')} - ${DEFAULT_CONFIG.params.endHour}:${DEFAULT_CONFIG.params.endMinute.toString().padStart(2, '0')}`,
                riskRewardRatio: DEFAULT_CONFIG.params.riskRewardRatio,
            },
            analytics,
            trades: trades.map((t, i) => ({
                tradeNumber: i + 1,
                entryDate: t.entryDate,
                exitDate: t.exitDate,
                direction: t.direction,
                entryPrice: t.entryPrice,
                exitPrice: t.exitPrice,
                stopLoss: t.indicators['SL Price'] as number || 0,
                takeProfit: t.indicators['TP Price'] as number || 0,
                grossPnl: t.grossPnl,
                netPnl: t.pnl,
                exitReason: t.exitReason,
                htfLevels: {
                    prev1HHigh: t.indicators['Prev 1H High'] as number || 0,
                    prev1HLow: t.indicators['Prev 1H Low'] as number || 0,
                    prevDayHigh: t.indicators['Prev Day High'] as number || 0,
                    prevDayLow: t.indicators['Prev Day Low'] as number || 0,
                    prevWeekHigh: t.indicators['Prev Week High'] as number || 0,
                    prevWeekLow: t.indicators['Prev Week Low'] as number || 0,
                    prevMonthHigh: t.indicators['Prev Month High'] as number || 0,
                    prevMonthLow: t.indicators['Prev Month Low'] as number || 0,
                }
            }))
        };
    }

    /**
     * Run backtest using BacktestEngine
     * Strategy orchestrates: signals → engine simulates → engine calculates → strategy analytics
     */
    runBacktest(
        ohlcData: CandlestickData[],
        config: MultiTFBreakoutConfig = DEFAULT_CONFIG,
        initialCapital: number = 100
    ): {
        trades: Trade[];
        metrics: Metrics;
        analytics: MultiTFBreakoutAnalytics;
    } {
        console.log(`🚀 [Multi-TF Breakout] Running backtest with ${ohlcData.length} bars, ₹${initialCapital} capital`);

        // Step 1: Strategy generates signals
        const signals = this.generateSignals(ohlcData, config);
        console.log(`📊 [Multi-TF Breakout] Generated ${signals.length} signals`);

        // Step 2: Engine simulates trades
        const backtestConfig = { initialCapital, quantity: 1 };
        const { trades, barsInPosition, totalMarketBars } = backtestEngine.simulateTrades(signals, ohlcData, backtestConfig);
        console.log(`✅ [Multi-TF Breakout] ${trades.length} trades generated, Time in market: ${((barsInPosition / totalMarketBars) * 100).toFixed(1)}%`);

        // Step 3: Engine calculates metrics
        const metrics = backtestEngine.calculateMetrics(trades, initialCapital, barsInPosition, totalMarketBars);

        // Step 4: Strategy calculates analytics
        const baseTrades: BaseTrade[] = trades.map(t => ({
            id: t.id,
            entryDate: t.entryDate,
            exitDate: t.exitDate,
            direction: t.direction,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            grossPnl: t.grossPnl,
            pnl: t.pnl,
            pnlPercent: t.pnlPercent,
            duration: t.duration,
            signal: t.signal,
            slippage: t.slippage,
            costs: t.costs,
            indicators: t.indicators,
            exitReason: t.exitReason,
        }));

        const analytics = this.calculateAnalytics(baseTrades);

        return { trades, metrics, analytics };
    }
}

// Singleton instance
export const multiTFBreakoutStrategy = new MultiTFBreakoutStrategy();
