/**
 * Multi-TF Breakout WDH ADX 0.5 Strategy - Main Implementation
 * 
 * v1.0.0 - Multi-TF Breakout (Weekly/Daily/Hourly) with Daily ADX Filter
 *          and 1:0.5 Risk:Reward ratio (conservative target)
 * 
 * Entry: Close > ALL previous HTF highs (1H, Day, Week - NO Monthly) for LONG
 *        Close < ALL previous HTF lows (1H, Day, Week - NO Monthly) for SHORT
 *        AND Daily ADX > threshold (calculated from COMPLETED daily candles only)
 * Exit: Stop Loss (prev 1H low/high) OR Target Profit (1:0.5 R:R) OR Market Close
 * 
 * This is a variant of Multi_TF_Breakout_WDH_ADX with conservative target (0.5x risk).
 */

import { CandlestickData } from 'lightweight-charts';
import { BaseStrategy, Signal, BaseTrade, BasicMetrics } from '../BaseStrategy';
import { MultiTFBreakoutWDHADX05Config, MultiTFBreakoutWDHADX05Analytics, MultiTFBreakoutWDHADX05Export, HTFLevels, DEFAULT_CONFIG } from './types';
import { backtestEngine, Trade, Metrics } from '../../lib/BacktestEngine';
import { IndicatorCalculator } from '../../utils/IndicatorCalculator';
import type { HTFWDHADXCalculationRow } from '../../types/HTFWDHADXCalculationRow';

export class MultiTFBreakoutWDHADX05Strategy implements BaseStrategy<MultiTFBreakoutWDHADX05Config, MultiTFBreakoutWDHADX05Analytics, MultiTFBreakoutWDHADX05Export> {
    readonly name = 'Multi-TF Breakout WDH ADX 0.5';
    readonly version = '1.0.0';
    readonly description = 'Breakout W/D/H + Daily ADX > 25 with 1:0.5 R:R (conservative TP)';

    getIndicatorNames(): string[] {
        return [
            'Prev 1H High', 'Prev 1H Low',
            'Prev Day High', 'Prev Day Low',
            'Prev Week High', 'Prev Week Low',
            'SL Price', 'TP Price',
            'Long Reset', 'Short Reset',
            'All Levels Ready',
            'Daily ADX', 'ADX Condition Met'
        ];
    }

    private detectTimeframeBoundaries(prevDate: Date | null, currDate: Date): {
        new1H: boolean;
        newDay: boolean;
        newWeek: boolean;
    } {
        if (!prevDate) {
            return { new1H: true, newDay: true, newWeek: true };
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

        return { new1H, newDay, newWeek };
    }

    private isWithinTradingWindow(date: Date, config: MultiTFBreakoutWDHADX05Config): boolean {
        const currentMinutes = date.getHours() * 60 + date.getMinutes();
        const startMinutes = config.params.startHour * 60 + config.params.startMinute;
        const endMinutes = config.params.endHour * 60 + config.params.endMinute;
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    generateSignals(ohlcData: CandlestickData[], config: MultiTFBreakoutWDHADX05Config = DEFAULT_CONFIG): Signal[] {
        const { signals } = this.generateSignalsWithCalculations(ohlcData, config);
        return signals;
    }

    generateSignalsWithCalculations(
        ohlcData: CandlestickData[],
        config: MultiTFBreakoutWDHADX05Config = DEFAULT_CONFIG
    ): {
        signals: Signal[];
        calculations: HTFWDHADXCalculationRow[];
        hodLodStats: {
            maxHODCount: number;
            maxLODCount: number;
            avgHODCount: number;
            avgLODCount: number;
            totalDays: number;
        };
        adxStats: {
            avgDailyADXOnEntry: number;
            tradesBlockedByADX: number;
            daysWithADXAboveThreshold: number;
            daysWithADXBelowThreshold: number;
        };
    } {
        const signals: Signal[] = [];
        const calculations: HTFWDHADXCalculationRow[] = [];

        const dailyHODCounts: number[] = [];
        const dailyLODCounts: number[] = [];
        let currentDayHOD = 0;
        let currentDayLOD = Infinity;
        let currentDayHODCount = 0;
        let currentDayLODCount = 0;
        let currentDayDateStr = '';

        const completedDailyHighs: number[] = [];
        const completedDailyLows: number[] = [];
        const completedDailyCloses: number[] = [];

        let buildingDayHigh = 0;
        let buildingDayLow = Infinity;
        let buildingDayClose = 0;
        let isFirstBarOfDay = true;

        let currentDailyADX: number | null = null;
        let tradesBlockedByADX = 0;
        let adxValuesOnEntry: number[] = [];
        let daysWithADXAbove = 0;
        let daysWithADXBelow = 0;

        if (ohlcData.length < 100) {
            console.warn(`⚠️ [WDH ADX 0.5 v1.0.0] Not enough data: ${ohlcData.length} bars`);
            return {
                signals,
                calculations,
                hodLodStats: { maxHODCount: 0, maxLODCount: 0, avgHODCount: 0, avgLODCount: 0, totalDays: 0 },
                adxStats: { avgDailyADXOnEntry: 0, tradesBlockedByADX: 0, daysWithADXAboveThreshold: 0, daysWithADXBelowThreshold: 0 }
            };
        }

        console.log(`📊 [WDH ADX 0.5 v1.0.0] Processing ${ohlcData.length} bars with R:R ${config.params.riskRewardRatio} (NO Monthly)...`);

        let levels: HTFLevels = {
            curr1HHigh: null, curr1HLow: null,
            currDayHigh: null, currDayLow: null,
            currWeekHigh: null, currWeekLow: null,
            prev1HHigh: null, prev1HLow: null,
            prevDayHigh: null, prevDayLow: null,
            prevWeekHigh: null, prevWeekLow: null,
            prev1HReady: false,
            prevDayReady: false,
            prevWeekReady: false,
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

            const boundaries = this.detectTimeframeBoundaries(prevDate, barDate);

            // Daily candle aggregation for ADX
            if (boundaries.newDay && !isFirstBarOfDay) {
                if (buildingDayHigh > 0 && buildingDayLow < Infinity) {
                    completedDailyHighs.push(buildingDayHigh);
                    completedDailyLows.push(buildingDayLow);
                    completedDailyCloses.push(buildingDayClose);

                    currentDailyADX = IndicatorCalculator.calculateADX(
                        completedDailyHighs,
                        completedDailyLows,
                        completedDailyCloses,
                        config.params.adxPeriod
                    );

                    if (currentDailyADX !== null) {
                        if (currentDailyADX >= config.params.adxThreshold) {
                            daysWithADXAbove++;
                        } else {
                            daysWithADXBelow++;
                        }
                    }
                }

                buildingDayHigh = high;
                buildingDayLow = low;
                buildingDayClose = close;
            } else {
                if (isFirstBarOfDay) {
                    buildingDayHigh = high;
                    buildingDayLow = low;
                    isFirstBarOfDay = false;
                } else {
                    buildingDayHigh = Math.max(buildingDayHigh, high);
                    buildingDayLow = Math.min(buildingDayLow, low);
                }
                buildingDayClose = close;
            }

            // HOD/LOD tracking
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

            // 1H tracking
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

            // Daily tracking
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

            // Weekly tracking
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

            const allLevelsReady = levels.prev1HReady && levels.prevDayReady && levels.prevWeekReady;

            const closeAbove1HHigh = allLevelsReady && close > levels.prev1HHigh!;
            const closeAboveDayHigh = allLevelsReady && close > levels.prevDayHigh!;
            const closeAboveWeekHigh = allLevelsReady && close > levels.prevWeekHigh!;
            const closeAboveAllHighs = closeAbove1HHigh && closeAboveDayHigh && closeAboveWeekHigh;

            const closeBelow1HLow = allLevelsReady && close < levels.prev1HLow!;
            const closeBelowDayLow = allLevelsReady && close < levels.prevDayLow!;
            const closeBelowWeekLow = allLevelsReady && close < levels.prevWeekLow!;
            const closeBelowAllLows = closeBelow1HLow && closeBelowDayLow && closeBelowWeekLow;

            if (closeAboveAllHighs || closeBelowAllLows) {
                conditionsMet++;
            }

            const adxConditionMet = currentDailyADX !== null && currentDailyADX >= config.params.adxThreshold;

            // Reset mechanism
            const longPullbackOccurred = allLevelsReady && (
                close < levels.prev1HHigh! || close < levels.prevDayHigh! ||
                close < levels.prevWeekHigh! ||
                close < levels.prev1HLow! || close < levels.prevDayLow! ||
                close < levels.prevWeekLow!
            );

            const shortPullbackOccurred = allLevelsReady && (
                close > levels.prev1HHigh! || close > levels.prevDayHigh! ||
                close > levels.prevWeekHigh! ||
                close > levels.prev1HLow! || close > levels.prevDayLow! ||
                close > levels.prevWeekLow!
            );

            if (!longIsReset && longPullbackOccurred) {
                longIsReset = true;
            }
            if (!shortIsReset && shortPullbackOccurred) {
                shortIsReset = true;
            }

            // SL/TP calculation with 0.5 R:R
            const longStopLoss = allLevelsReady ? levels.prev1HLow! : null;
            const longRisk = allLevelsReady ? close - levels.prev1HLow! : 0;
            const longTargetPrice = allLevelsReady && longRisk > 0
                ? close + (longRisk * config.params.riskRewardRatio)  // 0.5 R:R
                : null;

            const shortStopLoss = allLevelsReady ? levels.prev1HHigh! : null;
            const shortRisk = allLevelsReady ? levels.prev1HHigh! - close : 0;
            const shortTargetPrice = allLevelsReady && shortRisk > 0
                ? close - (shortRisk * config.params.riskRewardRatio)  // 0.5 R:R
                : null;

            const withinWindow = this.isWithinTradingWindow(barDate, config);
            if (withinWindow) withinWindowCount++;

            let signal: 'BUY' | 'SELL' | 'NONE' = 'NONE';
            let signalBlocked = false;
            let blockedReason: string | undefined;

            if (withinWindow && allLevelsReady) {
                if ((config.direction === 'long' || config.direction === 'both') &&
                    closeAboveAllHighs && longRisk > 0) {

                    if (!adxConditionMet) {
                        signalBlocked = true;
                        blockedReason = `ADX ${currentDailyADX?.toFixed(1) ?? 'N/A'} < ${config.params.adxThreshold}`;
                        tradesBlockedByADX++;
                        if (debugCount < 5) {
                            debugCount++;
                        }
                    } else if (!longIsReset) {
                        signalBlocked = true;
                        blockedReason = 'Waiting for pullback';
                    } else {
                        signal = 'BUY';
                        longIsReset = false;

                        if (currentDailyADX !== null) {
                            adxValuesOnEntry.push(currentDailyADX);
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
                                'Long Reset': true,
                                'Short Reset': shortIsReset,
                                'All Levels Ready': true,
                                'SL Price': parseFloat(longStopLoss!.toFixed(2)),
                                'TP Price': parseFloat(longTargetPrice!.toFixed(2)),
                                'Daily ADX': parseFloat((currentDailyADX ?? 0).toFixed(2)),
                                'ADX Condition Met': true,
                                'Signal': 'BUY',
                            }
                        });
                    }
                }
                else if ((config.direction === 'short' || config.direction === 'both') &&
                    closeBelowAllLows && shortRisk > 0) {

                    if (!adxConditionMet) {
                        signalBlocked = true;
                        blockedReason = `ADX ${currentDailyADX?.toFixed(1) ?? 'N/A'} < ${config.params.adxThreshold}`;
                        tradesBlockedByADX++;
                    } else if (!shortIsReset) {
                        signalBlocked = true;
                        blockedReason = 'Waiting for pullback';
                    } else {
                        signal = 'SELL';
                        shortIsReset = false;

                        if (currentDailyADX !== null) {
                            adxValuesOnEntry.push(currentDailyADX);
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
                                'Long Reset': longIsReset,
                                'Short Reset': true,
                                'All Levels Ready': true,
                                'SL Price': parseFloat(shortStopLoss!.toFixed(2)),
                                'TP Price': parseFloat(shortTargetPrice!.toFixed(2)),
                                'Daily ADX': parseFloat((currentDailyADX ?? 0).toFixed(2)),
                                'ADX Condition Met': true,
                                'Signal': 'SELL',
                            }
                        });
                    }
                }
            }

            const calcRow: HTFWDHADXCalculationRow = {
                timestamp: barTime,
                time: formatDateTime(barDate),
                open, high, low, close,

                prev1HHigh: levels.prev1HHigh,
                prev1HLow: levels.prev1HLow,
                prevDayHigh: levels.prevDayHigh,
                prevDayLow: levels.prevDayLow,
                prevWeekHigh: levels.prevWeekHigh,
                prevWeekLow: levels.prevWeekLow,

                curr1HHigh: levels.curr1HHigh,
                curr1HLow: levels.curr1HLow,

                closeAbove1HHigh,
                closeAboveDayHigh,
                closeAboveWeekHigh,
                closeAboveAllHighs,

                closeBelow1HLow,
                closeBelowDayLow,
                closeBelowWeekLow,
                closeBelowAllLows,

                new1H: boundaries.new1H,
                newDay: boundaries.newDay,
                newWeek: boundaries.newWeek,

                allLevelsReady,
                longIsReset,
                shortIsReset,
                withinTradingWindow: withinWindow,

                dailyADX: currentDailyADX,
                adxConditionMet,
                completedDailyCandles: completedDailyHighs.length,

                slPrice: longStopLoss,
                tpPrice: longTargetPrice,

                signal,
                signalBlocked,
                blockedReason,
            };

            calculations.push(calcRow);
            prevDate = barDate;
        }

        console.log(`📊 [WDH ADX 0.5] Generated ${signals.length} signals with R:R ${config.params.riskRewardRatio}`);

        if (currentDayHODCount > 0) {
            dailyHODCounts.push(currentDayHODCount);
            dailyLODCounts.push(currentDayLODCount);
        }

        const totalDays = dailyHODCounts.length;
        const maxHODCount = totalDays > 0 ? Math.max(...dailyHODCounts) : 0;
        const maxLODCount = totalDays > 0 ? Math.max(...dailyLODCounts) : 0;
        const avgHODCount = totalDays > 0 ? dailyHODCounts.reduce((a, b) => a + b, 0) / totalDays : 0;
        const avgLODCount = totalDays > 0 ? dailyLODCounts.reduce((a, b) => a + b, 0) / totalDays : 0;

        const avgADXOnEntry = adxValuesOnEntry.length > 0
            ? adxValuesOnEntry.reduce((a, b) => a + b, 0) / adxValuesOnEntry.length
            : 0;

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
                avgDailyADXOnEntry: parseFloat(avgADXOnEntry.toFixed(2)),
                tradesBlockedByADX,
                daysWithADXAboveThreshold: daysWithADXAbove,
                daysWithADXBelowThreshold: daysWithADXBelow
            }
        };
    }

    calculateAnalytics(
        trades: BaseTrade[],
        hodLodStats: { maxHODCount: number; maxLODCount: number; avgHODCount: number; avgLODCount: number; totalDays: number } = { maxHODCount: 0, maxLODCount: 0, avgHODCount: 0, avgLODCount: 0, totalDays: 0 },
        adxStats: { avgDailyADXOnEntry: number; tradesBlockedByADX: number; daysWithADXAboveThreshold: number; daysWithADXBelowThreshold: number } = { avgDailyADXOnEntry: 0, tradesBlockedByADX: 0, daysWithADXAboveThreshold: 0, daysWithADXBelowThreshold: 0 }
    ): MultiTFBreakoutWDHADX05Analytics {
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

    formatExport(
        trades: BaseTrade[],
        _metrics: BasicMetrics,
        analytics: MultiTFBreakoutWDHADX05Analytics,
        dateRange: { start: string; end: string }
    ): MultiTFBreakoutWDHADX05Export {
        return {
            exportDate: new Date().toISOString(),
            backtestPeriod: dateRange,
            strategyInfo: {
                name: `${this.name} v${this.version}`,
                version: this.version,
                type: 'breakout-wdh-adx-05',
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
                dailyADX: t.indicators['Daily ADX'] as number || 0,
                htfLevels: {
                    prev1HHigh: t.indicators['Prev 1H High'] as number || 0,
                    prev1HLow: t.indicators['Prev 1H Low'] as number || 0,
                    prevDayHigh: t.indicators['Prev Day High'] as number || 0,
                    prevDayLow: t.indicators['Prev Day Low'] as number || 0,
                    prevWeekHigh: t.indicators['Prev Week High'] as number || 0,
                    prevWeekLow: t.indicators['Prev Week Low'] as number || 0,
                }
            }))
        };
    }

    runBacktest(
        ohlcData: CandlestickData[],
        config: MultiTFBreakoutWDHADX05Config = DEFAULT_CONFIG,
        initialCapital: number = 100
    ): {
        trades: Trade[];
        metrics: Metrics;
        analytics: MultiTFBreakoutWDHADX05Analytics;
        calculations: HTFWDHADXCalculationRow[];
    } {
        console.log(`🚀 [WDH ADX 0.5] Running backtest with R:R ${config.params.riskRewardRatio}, ₹${initialCapital} capital`);

        const { signals, calculations: allCalculations, hodLodStats, adxStats } = this.generateSignalsWithCalculations(ohlcData, config);
        const calculations = allCalculations.slice(-500);

        const backtestConfig = { initialCapital, quantity: 1 };
        const { trades, barsInPosition, totalMarketBars, equity } = backtestEngine.simulateTrades(signals, ohlcData, backtestConfig);
        console.log(`✅ [WDH ADX 0.5] ${trades.length} trades generated`);

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
export const multiTFBreakoutWDHADX05Strategy = new MultiTFBreakoutWDHADX05Strategy();
