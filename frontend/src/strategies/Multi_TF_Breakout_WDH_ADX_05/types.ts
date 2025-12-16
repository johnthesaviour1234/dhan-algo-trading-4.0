/**
 * Multi-TF Breakout WDH ADX 0.5 Strategy - Types
 * 
 * v1.0.0 - Multi-TF Breakout (Weekly/Daily/Hourly) with Daily ADX Filter
 *          and 1:0.5 Risk:Reward ratio (conservative target)
 * 
 * Entry: Close > ALL previous HTF highs (1H, Day, Week - no Monthly)
 *        AND Daily ADX > threshold
 * Target: Entry + (0.5 × Risk) - More conservative TP
 */

import { BaseStrategyConfig } from '../BaseStrategy';

/**
 * HTF Levels tracking for breakout detection (no Monthly)
 */
export interface HTFLevels {
    // Current period (building)
    curr1HHigh: number | null;
    curr1HLow: number | null;
    currDayHigh: number | null;
    currDayLow: number | null;
    currWeekHigh: number | null;
    currWeekLow: number | null;

    // Previous period (confirmed - used for entry conditions)
    prev1HHigh: number | null;
    prev1HLow: number | null;
    prevDayHigh: number | null;
    prevDayLow: number | null;
    prevWeekHigh: number | null;
    prevWeekLow: number | null;

    // State tracking for when levels become ready
    prev1HReady: boolean;
    prevDayReady: boolean;
    prevWeekReady: boolean;
}

/**
 * Multi-TF Breakout WDH ADX 0.5 Configuration
 */
export interface MultiTFBreakoutWDHADX05Config extends BaseStrategyConfig {
    direction: 'long' | 'short' | 'both';
    params: {
        // Trading hours (IST)
        startHour: number;
        startMinute: number;
        endHour: number;
        endMinute: number;

        // Risk management
        riskRewardRatio: number;

        // ADX filter parameters (Daily)
        adxThreshold: number;
        adxPeriod: number;
    };
}

/**
 * Analytics specific to WDH ADX 0.5 strategy
 */
export interface MultiTFBreakoutWDHADX05Analytics {
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

/**
 * Export format for WDH ADX 0.5 strategy
 */
export interface MultiTFBreakoutWDHADX05Export {
    exportDate: string;
    backtestPeriod: {
        start: string;
        end: string;
    };
    strategyInfo: {
        name: string;
        version: string;
        type: 'breakout-wdh-adx-05';
        totalTrades: number;
    };
    config: {
        direction: string;
        tradingWindow: string;
        riskRewardRatio: number;
        adxThreshold: number;
        adxPeriod: number;
    };
    analytics: MultiTFBreakoutWDHADX05Analytics;
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
        };
    }>;
}

/**
 * Default configuration - 1:0.5 R:R (conservative target)
 */
export const DEFAULT_CONFIG: MultiTFBreakoutWDHADX05Config = {
    direction: 'long',
    params: {
        // Trading window: 9:15 AM - 2:15 PM IST
        startHour: 9,
        startMinute: 15,
        endHour: 14,
        endMinute: 15,

        // 1:0.5 Risk:Reward (conservative - target is half of risk)
        riskRewardRatio: 0.5,  // INDEPENDENT - changing this won't affect other strategies

        // ADX filter (Daily)
        adxThreshold: 25,
        adxPeriod: 14,
    }
};
