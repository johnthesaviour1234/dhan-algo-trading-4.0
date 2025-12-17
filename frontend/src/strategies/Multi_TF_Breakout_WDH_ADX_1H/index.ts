/**
 * Multi-TF Breakout WDH ADX 1H Strategy - Main Implementation
 * 
 * v1.0.0 - Multi-TF Breakout (W/D/H only, NO Monthly) with Hourly ADX Filter
 * 
 * Entry: Close > ALL previous HTF highs (1H, Day, Week - NO Month) for LONG
 *        Close < ALL previous HTF lows (1H, Day, Week - NO Month) for SHORT
 *        AND Hourly ADX > threshold (calculated from COMPLETED hourly candles only)
 * Exit: Stop Loss (prev 1H low/high) OR Target Profit (1:1 R:R) OR Market Close
 * 
 * This variant removes the Monthly condition for faster entries.
 */

import { CandlestickData } from 'lightweight-charts';
import { BaseStrategy, Signal, BaseTrade, BasicMetrics } from '../BaseStrategy';
import { MultiTFBreakoutWDHADX1HConfig, MultiTFBreakoutWDHADX1HAnalytics, MultiTFBreakoutWDHADX1HExport, HTFLevels, DEFAULT_CONFIG } from './types';
import { backtestEngine, Trade, Metrics } from '../../lib/BacktestEngine';
import { IndicatorCalculator } from '../../utils/IndicatorCalculator';
import type { HTFADX1HCalculationRow } from '../../types/HTFADX1HCalculationRow';

export class MultiTFBreakoutWDHADX1HStrategy implements BaseStrategy<MultiTFBreakoutWDHADX1HConfig, MultiTFBreakoutWDHADX1HAnalytics, MultiTFBreakoutWDHADX1HExport> {
    readonly name = 'Multi-TF Breakout WDH ADX 1H';
    readonly version = '1.0.0';
    readonly description = 'Breakout W/D/H (no Monthly) + Hourly ADX > 25 with 1:1 R:R';

    getIndicatorNames(): string[] {
        return [
            'Prev 1H High', 'Prev 1H Low',
            'Prev Day High', 'Prev Day Low',
            'Prev Week High', 'Prev Week Low',
            'Prev Month High', 'Prev Month Low',
            'SL Price', 'TP Price',
            'Long Reset', 'Short Reset',
            'All Levels Ready',
            'Hourly ADX', 'ADX Condition Met'
        ];
    }

    /**
     * Detect if a new hour/day/week/month has started
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

        const MARKET_OPEN_MINUTE = 15;

        const getMarketHour = (d: Date) => {
            const hour = d.getHours();
            const minute = d.getMinutes();
            if (minute < MARKET_OPEN_MINUTE) {
                return hour - 1;
            }
            return hour;
        };

        const prevMarketHour = getMarketHour(prevDate);
        const currMarketHour = getMarketHour(currDate);
        const new1H = currMarketHour !== prevMarketHour;

        const newDay = currDate.getDate() !== prevDate.getDate() ||
            currDate.getMonth() !== prevDate.getMonth() ||
            currDate.getFullYear() !== prevDate.getFullYear();

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
     */
    private isWithinTradingWindow(date: Date, config: MultiTFBreakoutWDHADX1HConfig): boolean {
        const currentMinutes = date.getHours() * 60 + date.getMinutes();
        const startMinutes = config.params.startHour * 60 + config.params.startMinute;
        const endMinutes = config.params.endHour * 60 + config.params.endMinute;
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    /**
     * Generate trading signals from OHLC data
     */
    generateSignals(ohlcData: CandlestickData[], config: MultiTFBreakoutWDHADX1HConfig = DEFAULT_CONFIG): Signal[] {
        const { signals } = this.generateSignalsWithCalculations(ohlcData, config);
        return signals;
    }

    /**
     * Generate trading signals AND calculation rows from OHLC data
     */
    generateSignalsWithCalculations(
        ohlcData: CandlestickData[],
        config: MultiTFBreakoutWDHADX1HConfig = DEFAULT_CONFIG
    ): {
        signals: Signal[];
        calculations: HTFADX1HCalculationRow[];
        hodLodStats: {
            maxHODCount: number;
            maxLODCount: number;
            avgHODCount: number;
            avgLODCount: number;
            totalDays: number;
        };
        adxStats: {
            avgHourlyADXOnEntry: number;
            tradesBlockedByADX: number;
            hoursWithADXAboveThreshold: number;
            hoursWithADXBelowThreshold: number;
        };
    } {
        const signals: Signal[] = [];
        const calculations: HTFADX1HCalculationRow[] = [];

        // HOD/LOD tracking per day
        const dailyHODCounts: number[] = [];
        const dailyLODCounts: number[] = [];
        let currentDayHOD = 0;
        let currentDayLOD = Infinity;
        let currentDayHODCount = 0;
        let currentDayLODCount = 0;
        let currentDayDateStr = '';

        // ============= HOURLY CANDLE AGGREGATION FOR ADX =============
        // Track completed hourly candles for ADX calculation
        const completedHourlyHighs: number[] = [];
        const completedHourlyLows: number[] = [];
        const completedHourlyCloses: number[] = [];

        // Current hour's building candle (NOT used in ADX until hour completes)
        let buildingHourHigh = 0;
        let buildingHourLow = Infinity;
        let buildingHourClose = 0;
        let isFirstBarOfHour = true;

        // ADX tracking
        let currentHourlyADX: number | null = null;
        let tradesBlockedByADX = 0;
        let adxValuesOnEntry: number[] = [];
        let hoursWithADXAbove = 0;
        let hoursWithADXBelow = 0;

        if (ohlcData.length < 100) {
            console.warn(`⚠️ [Multi-TF Breakout ADX 1H v1.0.0] Not enough data: ${ohlcData.length} bars`);
            return {
                signals,
                calculations,
                hodLodStats: { maxHODCount: 0, maxLODCount: 0, avgHODCount: 0, avgLODCount: 0, totalDays: 0 },
                adxStats: { avgHourlyADXOnEntry: 0, tradesBlockedByADX: 0, hoursWithADXAboveThreshold: 0, hoursWithADXBelowThreshold: 0 }
            };
        }

        console.log(`📊 [Multi-TF Breakout ADX 1H v1.0.0] Processing ${ohlcData.length} bars with ADX threshold ${config.params.adxThreshold}...`);

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

        let longIsReset = true;
        let shortIsReset = true;

        let prevDate: Date | null = null;
        let debugCount = 0;
        let conditionsMet = 0;
        let withinWindowCount = 0;

        const formatDateTime = (d: Date) => {
            const day = d.getDate();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[d.getMonth()];
            const year = d.getFullYear();
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            return `${day} ${month} ${year}, ${hours}:${mins}`;
        };

        const getDateStr = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

        for (let i = 0; i < ohlcData.length; i++) {
            const bar = ohlcData[i];
            const barTime = bar.time as number;
            const barDate = new Date(barTime * 1000);
            const open = bar.open;
            const high = bar.high;
            const low = bar.low;
            const close = bar.close;
            const barDateStr = getDateStr(barDate);

            // Detect timeframe boundaries FIRST
            const boundaries = this.detectTimeframeBoundaries(prevDate, barDate);

            // ============= HOURLY CANDLE AGGREGATION FOR ADX =============
            if (boundaries.new1H && !isFirstBarOfHour) {
                // Previous hour's candle is now complete - add to completed arrays
                if (buildingHourHigh > 0 && buildingHourLow < Infinity) {
                    completedHourlyHighs.push(buildingHourHigh);
                    completedHourlyLows.push(buildingHourLow);
                    completedHourlyCloses.push(buildingHourClose);

                    // Recalculate ADX with the newly completed hourly candle
                    currentHourlyADX = IndicatorCalculator.calculateADX(
                        completedHourlyHighs,
                        completedHourlyLows,
                        completedHourlyCloses,
                        config.params.adxPeriod
                    );

                    // Track ADX distribution
                    if (currentHourlyADX !== null) {
                        if (currentHourlyADX >= config.params.adxThreshold) {
                            hoursWithADXAbove++;
                        } else {
                            hoursWithADXBelow++;
                        }
                    }

                    if (completedHourlyHighs.length <= 20 || completedHourlyHighs.length % 50 === 0) {
                        console.log(`📈 [ADX 1H] Hour ${completedHourlyHighs.length} complete. Hourly ADX: ${currentHourlyADX?.toFixed(2) ?? 'N/A'}`);
                    }
                }

                // Start new hour's building candle
                buildingHourHigh = high;
                buildingHourLow = low;
                buildingHourClose = close;
            } else {
                // Update building hour candle
                if (isFirstBarOfHour) {
                    buildingHourHigh = high;
                    buildingHourLow = low;
                    isFirstBarOfHour = false;
                } else {
                    buildingHourHigh = Math.max(buildingHourHigh, high);
                    buildingHourLow = Math.min(buildingHourLow, low);
                }
                buildingHourClose = close;
            }

            // ============= HOD/LOD TRACKING =============
            if (currentDayDateStr !== '' && barDateStr !== currentDayDateStr) {
                dailyHODCounts.push(currentDayHODCount);
                dailyLODCounts.push(currentDayLODCount);
                currentDayHOD = high;
                currentDayLOD = low;
                currentDayHODCount = 1;
                currentDayLODCount = 1;
            } else if (currentDayDateStr === '') {
                currentDayHOD = high;
                currentDayLOD = low;
                currentDayHODCount = 1;
                currentDayLODCount = 1;
            } else {
                if (high > currentDayHOD) {
                    currentDayHOD = high;
                    currentDayHODCount++;
                }
                if (low < currentDayLOD) {
                    currentDayLOD = low;
                    currentDayLODCount++;
                }
            }
            currentDayDateStr = barDateStr;

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

            // ============= CHECK ALL LEVELS READY (W/D/H only - NO Monthly) =============
            const allLevelsReady = levels.prev1HReady && levels.prevDayReady && levels.prevWeekReady;

            // Conditions (W/D/H only - NO Monthly condition)
            const closeAbove1HHigh = allLevelsReady && close > levels.prev1HHigh!;
            const closeAboveDayHigh = allLevelsReady && close > levels.prevDayHigh!;
            const closeAboveWeekHigh = allLevelsReady && close > levels.prevWeekHigh!;
            const closeAboveAllHighs = closeAbove1HHigh && closeAboveDayHigh && closeAboveWeekHigh;  // NO Monthly

            const closeBelow1HLow = allLevelsReady && close < levels.prev1HLow!;
            const closeBelowDayLow = allLevelsReady && close < levels.prevDayLow!;
            const closeBelowWeekLow = allLevelsReady && close < levels.prevWeekLow!;
            const closeBelowAllLows = closeBelow1HLow && closeBelowDayLow && closeBelowWeekLow;  // NO Monthly

            if (closeAboveAllHighs || closeBelowAllLows) {
                conditionsMet++;
            }

            // ============= ADX CONDITION (HOURLY) =============
            const adxConditionMet = currentHourlyADX !== null && currentHourlyADX >= config.params.adxThreshold;

            // ============= RESET MECHANISM =============
            const longPullbackOccurred = allLevelsReady && (
                close < levels.prev1HHigh! || close < levels.prevDayHigh! ||
                close < levels.prevWeekHigh! || close < levels.prevMonthHigh! ||
                close < levels.prev1HLow! || close < levels.prevDayLow! ||
                close < levels.prevWeekLow! || close < levels.prevMonthLow!
            );

            const shortPullbackOccurred = allLevelsReady && (
                close > levels.prev1HHigh! || close > levels.prevDayHigh! ||
                close > levels.prevWeekHigh! || close > levels.prevMonthHigh! ||
                close > levels.prev1HLow! || close > levels.prevDayLow! ||
                close > levels.prevWeekLow! || close > levels.prevMonthLow!
            );

            if (!longIsReset && longPullbackOccurred) {
                longIsReset = true;
            }
            if (!shortIsReset && shortPullbackOccurred) {
                shortIsReset = true;
            }

            // ============= CALCULATE SL/TP =============
            const longStopLoss = allLevelsReady ? levels.prev1HLow! : null;
            const longRisk = allLevelsReady ? close - levels.prev1HLow! : 0;
            const longTargetPrice = allLevelsReady && longRisk > 0
                ? close + (longRisk * config.params.riskRewardRatio)
                : null;

            const shortStopLoss = allLevelsReady ? levels.prev1HHigh! : null;
            const shortRisk = allLevelsReady ? levels.prev1HHigh! - close : 0;
            const shortTargetPrice = allLevelsReady && shortRisk > 0
                ? close - (shortRisk * config.params.riskRewardRatio)
                : null;

            const withinWindow = this.isWithinTradingWindow(barDate, config);
            if (withinWindow) withinWindowCount++;

            let signal: 'BUY' | 'SELL' | 'NONE' = 'NONE';
            let signalBlocked = false;
            let blockedReason: string | undefined;

            if (withinWindow && allLevelsReady) {
                // LONG entry check
                if ((config.direction === 'long' || config.direction === 'both') &&
                    closeAboveAllHighs && longRisk > 0) {

                    // Check ADX condition FIRST
                    if (!adxConditionMet) {
                        signalBlocked = true;
                        blockedReason = `ADX ${currentHourlyADX?.toFixed(1) ?? 'N/A'} < ${config.params.adxThreshold}`;
                        tradesBlockedByADX++;
                        if (debugCount < 5) {
                            debugCount++;
                            console.log(`🚫 [ADX 1H Filter] Entry BLOCKED - Hourly ADX: ${currentHourlyADX?.toFixed(2) ?? 'N/A'} < threshold ${config.params.adxThreshold}`);
                        }
                    } else if (!longIsReset) {
                        signalBlocked = true;
                        blockedReason = 'Waiting for pullback';
                    } else {
                        signal = 'BUY';
                        longIsReset = false;

                        if (currentHourlyADX !== null) {
                            adxValuesOnEntry.push(currentHourlyADX);
                        }

                        if (signals.length < 5) {
                            console.log(`🎯 [Multi-TF Breakout ADX 1H] Signal #${signals.length + 1} at ${barDate.toISOString()}, Hourly ADX: ${currentHourlyADX?.toFixed(2)}`);
                        }

                        signals.push({
                            time: barTime,
                            type: 'BUY',
                            price: close,
                            indicators: {
                                'Prev 1H High': levels.prev1HHigh!,
                                'Prev 1H Low': levels.prev1HLow!,
                                'Prev Day High': levels.prevDayHigh!,
                                'Prev Day Low': levels.prevDayLow!,
                                'Prev Week High': levels.prevWeekHigh!,
                                'Prev Week Low': levels.prevWeekLow!,
                                'Prev Month High': levels.prevMonthHigh!,
                                'Prev Month Low': levels.prevMonthLow!,
                                'Long Reset': true,
                                'Short Reset': shortIsReset,
                                'All Levels Ready': true,
                                'SL Price': parseFloat(longStopLoss!.toFixed(2)),
                                'TP Price': parseFloat(longTargetPrice!.toFixed(2)),
                                'Hourly ADX': parseFloat((currentHourlyADX ?? 0).toFixed(2)),
                                'ADX Condition Met': true,
                                'Signal': 'BUY',
                            }
                        });
                    }
                }
                // SHORT entry check
                else if ((config.direction === 'short' || config.direction === 'both') &&
                    closeBelowAllLows && shortRisk > 0) {

                    if (!adxConditionMet) {
                        signalBlocked = true;
                        blockedReason = `ADX ${currentHourlyADX?.toFixed(1) ?? 'N/A'} < ${config.params.adxThreshold}`;
                        tradesBlockedByADX++;
                    } else if (!shortIsReset) {
                        signalBlocked = true;
                        blockedReason = 'Waiting for pullback';
                    } else {
                        signal = 'SELL';
                        shortIsReset = false;

                        if (currentHourlyADX !== null) {
                            adxValuesOnEntry.push(currentHourlyADX);
                        }

                        signals.push({
                            time: barTime,
                            type: 'SELL',
                            price: close,
                            indicators: {
                                'Prev 1H High': levels.prev1HHigh!,
                                'Prev 1H Low': levels.prev1HLow!,
                                'Prev Day High': levels.prevDayHigh!,
                                'Prev Day Low': levels.prevDayLow!,
                                'Prev Week High': levels.prevWeekHigh!,
                                'Prev Week Low': levels.prevWeekLow!,
                                'Prev Month High': levels.prevMonthHigh!,
                                'Prev Month Low': levels.prevMonthLow!,
                                'Long Reset': longIsReset,
                                'Short Reset': true,
                                'All Levels Ready': true,
                                'SL Price': parseFloat(shortStopLoss!.toFixed(2)),
                                'TP Price': parseFloat(shortTargetPrice!.toFixed(2)),
                                'Hourly ADX': parseFloat((currentHourlyADX ?? 0).toFixed(2)),
                                'ADX Condition Met': true,
                                'Signal': 'SELL',
                            }
                        });
                    }
                }
            }

            // ============= BUILD CALCULATION ROW =============
            const calcRow: HTFADX1HCalculationRow = {
                timestamp: barTime,
                time: formatDateTime(barDate),
                open, high, low, close,

                prev1HHigh: levels.prev1HHigh,
                prev1HLow: levels.prev1HLow,
                prevDayHigh: levels.prevDayHigh,
                prevDayLow: levels.prevDayLow,
                prevWeekHigh: levels.prevWeekHigh,
                prevWeekLow: levels.prevWeekLow,
                prevMonthHigh: levels.prevMonthHigh,
                prevMonthLow: levels.prevMonthLow,

                curr1HHigh: levels.curr1HHigh,
                curr1HLow: levels.curr1HLow,

                closeAbove1HHigh,
                closeAboveDayHigh,
                closeAboveWeekHigh,
                closeAboveMonthHigh: false,  // Not used in WDH strategy
                closeAboveAllHighs,

                closeBelow1HLow,
                closeBelowDayLow,
                closeBelowWeekLow,
                closeBelowMonthLow: false,  // Not used in WDH strategy
                closeBelowAllLows,

                new1H: boundaries.new1H,
                newDay: boundaries.newDay,
                newWeek: boundaries.newWeek,
                newMonth: boundaries.newMonth,

                allLevelsReady,
                longIsReset,
                shortIsReset,
                withinTradingWindow: withinWindow,

                // ADX fields (Hourly)
                hourlyADX: currentHourlyADX,
                adxConditionMet,
                completedHourlyCandles: completedHourlyHighs.length,

                slPrice: longStopLoss,
                tpPrice: longTargetPrice,

                signal,
                signalBlocked,
                blockedReason,
            };

            calculations.push(calcRow);
            prevDate = barDate;
        }

        // Debug logs
        console.log(`📊 [Multi-TF Breakout ADX 1H] Level Readiness: 1H=${levels.prev1HReady}, Day=${levels.prevDayReady}, Week=${levels.prevWeekReady}, Month=${levels.prevMonthReady}`);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Bars in trading window: ${withinWindowCount}`);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Entry conditions met (before ADX filter): ${conditionsMet} times`);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Entries blocked by ADX: ${tradesBlockedByADX}`);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Completed hourly candles for ADX: ${completedHourlyHighs.length}`);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Final Hourly ADX: ${currentHourlyADX?.toFixed(2) ?? 'N/A'}`);

        // Save last day's counts
        if (currentDayHODCount > 0) {
            dailyHODCounts.push(currentDayHODCount);
            dailyLODCounts.push(currentDayLODCount);
        }

        // Calculate stats
        const totalDays = dailyHODCounts.length;
        const maxHODCount = totalDays > 0 ? Math.max(...dailyHODCounts) : 0;
        const maxLODCount = totalDays > 0 ? Math.max(...dailyLODCounts) : 0;
        const avgHODCount = totalDays > 0 ? dailyHODCounts.reduce((a, b) => a + b, 0) / totalDays : 0;
        const avgLODCount = totalDays > 0 ? dailyLODCounts.reduce((a, b) => a + b, 0) / totalDays : 0;

        const avgADXOnEntry = adxValuesOnEntry.length > 0
            ? adxValuesOnEntry.reduce((a, b) => a + b, 0) / adxValuesOnEntry.length
            : 0;

        console.log(`📊 [Multi-TF Breakout ADX 1H v1.0.0] Generated ${signals.length} signals, ${calculations.length} calculation rows`);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Avg ADX on entry: ${avgADXOnEntry.toFixed(2)}, Hours with ADX > ${config.params.adxThreshold}: ${hoursWithADXAbove}/${hoursWithADXAbove + hoursWithADXBelow}`);

        return {
            signals,
            calculations,
            hodLodStats: {
                maxHODCount,
                maxLODCount,
                avgHODCount: parseFloat(avgHODCount.toFixed(2)),
                avgLODCount: parseFloat(avgLODCount.toFixed(2)),
                totalDays
            },
            adxStats: {
                avgHourlyADXOnEntry: parseFloat(avgADXOnEntry.toFixed(2)),
                tradesBlockedByADX,
                hoursWithADXAboveThreshold: hoursWithADXAbove,
                hoursWithADXBelowThreshold: hoursWithADXBelow
            }
        };
    }

    /**
     * Calculate strategy-specific analytics
     */
    calculateAnalytics(
        trades: BaseTrade[],
        hodLodStats: { maxHODCount: number; maxLODCount: number; avgHODCount: number; avgLODCount: number; totalDays: number } = { maxHODCount: 0, maxLODCount: 0, avgHODCount: 0, avgLODCount: 0, totalDays: 0 },
        adxStats: { avgHourlyADXOnEntry: number; tradesBlockedByADX: number; hoursWithADXAboveThreshold: number; hoursWithADXBelowThreshold: number } = { avgHourlyADXOnEntry: 0, tradesBlockedByADX: 0, hoursWithADXAboveThreshold: 0, hoursWithADXBelowThreshold: 0 }
    ): MultiTFBreakoutWDHADX1HAnalytics {
        const winningTrades = trades.filter(t => t.pnl > 0).length;
        const losingTrades = trades.filter(t => t.pnl <= 0).length;

        const marketCloseTrades = trades.filter(t => t.exitReason === 'MarketClose');
        const exitReasons = {
            stopLoss: trades.filter(t => t.exitReason === 'StopLoss').length,
            takeProfit: trades.filter(t => t.exitReason === 'TakeProfit').length,
            marketClose: marketCloseTrades.length,
            marketCloseProfit: marketCloseTrades.filter(t => t.pnl > 0).length,
            marketCloseLoss: marketCloseTrades.filter(t => t.pnl <= 0).length,
        };

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
                tradesAfterReset: trades.length,
                tradesSkippedNoReset: 0,
            },
            hodLodStats,
            adxStats,
        };
    }

    /**
     * Format data for export
     */
    formatExport(
        trades: BaseTrade[],
        _metrics: BasicMetrics,
        analytics: MultiTFBreakoutWDHADX1HAnalytics,
        dateRange: { start: string; end: string }
    ): MultiTFBreakoutWDHADX1HExport {
        return {
            exportDate: new Date().toISOString(),
            backtestPeriod: dateRange,
            strategyInfo: {
                name: `${this.name} v${this.version}`,
                version: this.version,
                type: 'breakout-wdh-adx-1h',
                totalTrades: trades.length,
            },
            config: {
                direction: DEFAULT_CONFIG.direction,
                tradingWindow: `${DEFAULT_CONFIG.params.startHour}:${DEFAULT_CONFIG.params.startMinute.toString().padStart(2, '0')} - ${DEFAULT_CONFIG.params.endHour}:${DEFAULT_CONFIG.params.endMinute.toString().padStart(2, '0')}`,
                riskRewardRatio: DEFAULT_CONFIG.params.riskRewardRatio,
                adxThreshold: DEFAULT_CONFIG.params.adxThreshold,
                adxPeriod: DEFAULT_CONFIG.params.adxPeriod,
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
                hourlyADX: t.indicators['Hourly ADX'] as number || 0,
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
     */
    runBacktest(
        ohlcData: CandlestickData[],
        config: MultiTFBreakoutWDHADX1HConfig = DEFAULT_CONFIG,
        initialCapital: number = 100
    ): {
        trades: Trade[];
        metrics: Metrics;
        analytics: MultiTFBreakoutWDHADX1HAnalytics;
        calculations: HTFADX1HCalculationRow[];
    } {
        console.log(`🚀 [Multi-TF Breakout ADX 1H] Running backtest with ${ohlcData.length} bars, ₹${initialCapital} capital, ADX threshold: ${config.params.adxThreshold}`);

        const { signals, calculations: allCalculations, hodLodStats, adxStats } = this.generateSignalsWithCalculations(ohlcData, config);
        console.log(`📊 [Multi-TF Breakout ADX 1H] Generated ${signals.length} signals, ${allCalculations.length} calculation rows`);

        const calculations = allCalculations.slice(-500);

        const backtestConfig = { initialCapital, quantity: 1 };
        const { trades, barsInPosition, totalMarketBars, equity } = backtestEngine.simulateTrades(signals, ohlcData, backtestConfig);
        console.log(`✅ [Multi-TF Breakout ADX 1H] ${trades.length} trades generated, Time in market: ${((barsInPosition / totalMarketBars) * 100).toFixed(1)}%`);

        const metrics = backtestEngine.calculateMetrics(trades, initialCapital, barsInPosition, totalMarketBars);

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

        const analytics = this.calculateAnalytics(baseTrades, hodLodStats, adxStats);

        return { trades, metrics, analytics, calculations, equity };
    }
}

// Singleton instance
export const multiTFBreakoutWDHADX1HStrategy = new MultiTFBreakoutWDHADX1HStrategy();
