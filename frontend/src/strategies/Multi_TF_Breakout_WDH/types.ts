/**
 * Multi-TF Breakout WDH Strategy - Types
 * 
 * Variant that tracks Weekly, Daily, Hourly levels only (no Monthly)
 * Enters when price breaks above/below ALL previous levels.
 */

import { BaseStrategyConfig } from '../BaseStrategy';

// Strategy configuration
export interface MultiTFBreakoutWDHConfig extends BaseStrategyConfig {
    name: string;
    version: string;
    direction: 'long' | 'short' | 'both';
    params: {
        // Trading window (IST)
        startHour: number;      // 9
        startMinute: number;    // 15
        endHour: number;        // 14
        endMinute: number;      // 15

        // Risk management
        riskRewardRatio: number;  // 1.0 = 1:1 R:R

        // Reset mechanism
        requireReset: boolean;    // Require pullback before re-entry
    };
}

// Higher timeframe level tracking (Week, Day, Hour - no Month)
export interface HTFLevelsWDH {
    // Current period (building)
    curr1HHigh: number | null;
    curr1HLow: number | null;
    currDayHigh: number | null;
    currDayLow: number | null;
    currWeekHigh: number | null;
    currWeekLow: number | null;

    // Previous period (complete - used for entries)
    prev1HHigh: number | null;
    prev1HLow: number | null;
    prevDayHigh: number | null;
    prevDayLow: number | null;
    prevWeekHigh: number | null;
    prevWeekLow: number | null;

    // Readiness flags
    prev1HReady: boolean;
    prevDayReady: boolean;
    prevWeekReady: boolean;
}

// Strategy-specific analytics
export interface MultiTFBreakoutWDHAnalytics {
    // Basic stats
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;

    // Exit breakdown
    exitReasons: {
        stopLoss: number;
        takeProfit: number;
        marketClose: number;
        marketCloseProfit: number;
        marketCloseLoss: number;
    };

    // HTF level stats
    levelBreakdowns: {
        avgRiskAmount: number;
        avgRewardAmount: number;
    };

    // Reset mechanism stats
    resetStats: {
        tradesAfterReset: number;
        tradesSkippedNoReset: number;
    };

    // HOD/LOD formation stats
    hodLodStats: {
        maxHODCount: number;
        maxLODCount: number;
        avgHODCount: number;
        avgLODCount: number;
        totalDays: number;
    };
}

// Export format
export interface MultiTFBreakoutWDHExport {
    exportDate: string;
    backtestPeriod: {
        start: string;
        end: string;
    };
    strategyInfo: {
        name: string;
        version: string;
        type: string;
        totalTrades: number;
    };
    config: {
        direction: string;
        tradingWindow: string;
        riskRewardRatio: number;
    };
    analytics: MultiTFBreakoutWDHAnalytics;
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

// Default configuration
export const DEFAULT_CONFIG: MultiTFBreakoutWDHConfig = {
    name: 'Multi-TF Breakout WDH',
    version: '1.0.0',
    direction: 'long',
    params: {
        startHour: 9,
        startMinute: 15,
        endHour: 14,
        endMinute: 15,
        riskRewardRatio: 1.0,  // 1:1 R:R (independent config)
        requireReset: true,
    }
};
