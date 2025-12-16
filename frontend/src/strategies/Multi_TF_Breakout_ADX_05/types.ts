/**
 * Multi-TF Breakout ADX 0.5 Strategy - Types
 * 
 * v1.0.0 - Multi-TF Breakout (M/W/D/H) with Daily ADX Filter + 1:0.5 R:R
 * 
 * Entry: Close > ALL previous HTF highs (1H, Day, Week, Month)
 *        AND Daily ADX > threshold
 * Target: Entry + (0.5 × Risk) - Conservative TP
 */

import { BaseStrategyConfig } from '../BaseStrategy';

export interface HTFLevels {
    curr1HHigh: number | null;
    curr1HLow: number | null;
    currDayHigh: number | null;
    currDayLow: number | null;
    currWeekHigh: number | null;
    currWeekLow: number | null;
    currMonthHigh: number | null;
    currMonthLow: number | null;

    prev1HHigh: number | null;
    prev1HLow: number | null;
    prevDayHigh: number | null;
    prevDayLow: number | null;
    prevWeekHigh: number | null;
    prevWeekLow: number | null;
    prevMonthHigh: number | null;
    prevMonthLow: number | null;

    prev1HReady: boolean;
    prevDayReady: boolean;
    prevWeekReady: boolean;
    prevMonthReady: boolean;
}

export interface MultiTFBreakoutADX05Config extends BaseStrategyConfig {
    direction: 'long' | 'short' | 'both';
    params: {
        startHour: number;
        startMinute: number;
        endHour: number;
        endMinute: number;
        riskRewardRatio: number;
        requireReset: boolean;
        adxThreshold: number;
        adxPeriod: number;
    };
}

export interface MultiTFBreakoutADX05Analytics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    exitReasons: {
        stopLoss: number;
        takeProfit: number;
        marketClose: number;
        marketCloseProfit: number;
        marketCloseLoss: number;
    };
    levelBreakdowns: {
        avgRiskAmount: number;
        avgRewardAmount: number;
    };
    resetStats: {
        tradesAfterReset: number;
        tradesSkippedNoReset: number;
    };
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
}

export interface MultiTFBreakoutADX05Export {
    exportDate: string;
    backtestPeriod: { start: string; end: string };
    strategyInfo: {
        name: string;
        version: string;
        type: 'breakout-adx-05';
        totalTrades: number;
    };
    config: {
        direction: string;
        tradingWindow: string;
        riskRewardRatio: number;
        adxThreshold: number;
        adxPeriod: number;
    };
    analytics: MultiTFBreakoutADX05Analytics;
    trades: Array<{
        tradeNumber: number;
        entryDate: string;
        exitDate: string;
        direction: string;
        entryPrice: number;
        exitPrice: number;
        stopLoss: number;
        takeProfit: number;
        grossPnl: number;
        netPnl: number;
        exitReason: string;
        dailyADX: number;
        htfLevels: {
            prev1HHigh: number;
            prev1HLow: number;
            prevDayHigh: number;
            prevDayLow: number;
            prevWeekHigh: number;
            prevWeekLow: number;
            prevMonthHigh: number;
            prevMonthLow: number;
        };
    }>;
}

export const DEFAULT_CONFIG: MultiTFBreakoutADX05Config = {
    direction: 'long',
    params: {
        startHour: 9,
        startMinute: 15,
        endHour: 14,
        endMinute: 15,

        // 1:0.5 R:R - Conservative target (INDEPENDENT)
        riskRewardRatio: 0.5,

        requireReset: true,
        adxThreshold: 25,
        adxPeriod: 14,
    }
};
