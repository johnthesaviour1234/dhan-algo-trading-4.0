/**
 * Multi-TF Breakout ADX Strategy - Types
 * 
 * v1.0.0 - Multi-TF Breakout with Daily ADX Filter
 * 
 * Strategy tracks higher timeframe levels (1H, Daily, Weekly, Monthly)
 * and enters when price breaks above/below ALL previous levels
 * AND Daily ADX > threshold (measured from completed daily candles only).
 */

import { BaseStrategyConfig } from '../BaseStrategy';

// Strategy configuration
export interface MultiTFBreakoutADXConfig extends BaseStrategyConfig {
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
        riskRewardRatio: number;  // 2.0 = 1:2 R:R

        // Reset mechanism
        requireReset: boolean;    // Require pullback before re-entry

        // ADX Filter (NEW)
        adxThreshold: number;     // Minimum ADX value to enter (default: 25)
        adxPeriod: number;        // ADX calculation period (default: 14)
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
export interface MultiTFBreakoutADXAnalytics {
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

    // ADX Filter stats (NEW)
    adxStats: {
        avgDailyADXOnEntry: number;      // Average ADX value when trades were entered
        tradesBlockedByADX: number;       // Signals that met all conditions except ADX
        daysWithADXAboveThreshold: number;
        daysWithADXBelowThreshold: number;
    };
}

// Export format
export interface MultiTFBreakoutADXExport {
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
        adxThreshold: number;
        adxPeriod: number;
    };
    analytics: MultiTFBreakoutADXAnalytics;
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
        dailyADX: number;  // ADX value at time of entry
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
export const DEFAULT_CONFIG: MultiTFBreakoutADXConfig = {
    name: 'Multi-TF Breakout ADX',
    version: '1.0.0',
    direction: 'long',
    params: {
        startHour: 9,
        startMinute: 15,
        endHour: 14,
        endMinute: 15,
        riskRewardRatio: 1.0,  // 1:1 R:R (independent config)
        requireReset: true,
        // ADX Filter
        adxThreshold: 25,      // Only enter when Daily ADX > 25
        adxPeriod: 14,         // Standard 14-period ADX
    }
};
