/**
 * Multi-TF Breakout Strategy - Types
 * 
 * Strategy tracks higher timeframe levels (1H, Daily, Weekly, Monthly)
 * and enters when price breaks above/below ALL previous levels.
 */

import { BaseStrategyConfig } from '../BaseStrategy';

// Strategy configuration
export interface MultiTFBreakoutConfig extends BaseStrategyConfig {
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

// Higher timeframe level tracking
export interface HTFLevels {
    // Current period (building)
    curr1HHigh: number | null;
    curr1HLow: number | null;
    currDayHigh: number | null;
    currDayLow: number | null;
    currWeekHigh: number | null;
    currWeekLow: number | null;
    currMonthHigh: number | null;
    currMonthLow: number | null;

    // Previous period (complete - used for entries)
    prev1HHigh: number | null;
    prev1HLow: number | null;
    prevDayHigh: number | null;
    prevDayLow: number | null;
    prevWeekHigh: number | null;
    prevWeekLow: number | null;
    prevMonthHigh: number | null;
    prevMonthLow: number | null;

    // Readiness flags
    prev1HReady: boolean;
    prevDayReady: boolean;
    prevWeekReady: boolean;
    prevMonthReady: boolean;
}

// Strategy-specific analytics
export interface MultiTFBreakoutAnalytics {
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
    };

    // HTF level stats
    levelBreakdowns: {
        avgRiskAmount: number;      // Average SL distance
        avgRewardAmount: number;    // Average TP distance
    };

    // Reset mechanism stats
    resetStats: {
        tradesAfterReset: number;
        tradesSkippedNoReset: number;
    };
}

// Export format
export interface MultiTFBreakoutExport {
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
    analytics: MultiTFBreakoutAnalytics;
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
            prevMonthHigh: number;
            prevMonthLow: number;
        };
    }>;
}

// Default configuration
export const DEFAULT_CONFIG: MultiTFBreakoutConfig = {
    name: 'Multi-TF Breakout',
    version: '1.0.0',
    direction: 'long',  // Start with long-only
    params: {
        startHour: 9,
        startMinute: 15,
        endHour: 14,
        endMinute: 15,
        riskRewardRatio: 1.0,  // 1:1 R:R
        requireReset: true,
    }
};
