/**
 * Multi-TF Breakout WDH ADX 1H Strategy - Types
 * 
 * v1.0.0 - Multi-TF Breakout (W/D/H only) with Hourly ADX Filter
 * 
 * Entry: Close > W/D/H highs (no Monthly condition) AND Hourly ADX > threshold
 * Exit: Stop Loss OR Target Profit (1:1 R:R) OR Market Close
 */

import { BaseStrategyConfig } from '../BaseStrategy';

/**
 * HTF Levels tracking for breakout detection (W/D/H only - no Monthly)
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
 * Multi-TF Breakout WDH ADX 1H Configuration
 */
export interface MultiTFBreakoutWDHADX1HConfig extends BaseStrategyConfig {
    direction: 'long' | 'short' | 'both';
    params: {
        // Trading hours (IST)
        startHour: number;
        startMinute: number;
        endHour: number;
        endMinute: number;

        // Risk management
        riskRewardRatio: number;

        // ADX filter parameters (Hourly)
        adxThreshold: number;  // Minimum ADX value for entry (default: 25)
        adxPeriod: number;     // ADX calculation period (default: 14)
    };
}

/**
 * Analytics specific to WDH ADX 1H strategy
 */
export interface MultiTFBreakoutWDHADX1HAnalytics {
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
        avgHourlyADXOnEntry: number;
        tradesBlockedByADX: number;
        hoursWithADXAboveThreshold: number;
        hoursWithADXBelowThreshold: number;
    };
}

/**
 * Export format for WDH ADX 1H strategy
 */
export interface MultiTFBreakoutWDHADX1HExport {
    exportDate: string;
    backtestPeriod: {
        start: string;
        end: string;
    };
    strategyInfo: {
        name: string;
        version: string;
        type: 'breakout-wdh-adx-1h';
        totalTrades: number;
    };
    config: {
        direction: string;
        tradingWindow: string;
        riskRewardRatio: number;
        adxThreshold: number;
        adxPeriod: number;
    };
    analytics: MultiTFBreakoutWDHADX1HAnalytics;
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
        hourlyADX: number;
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
 * Default configuration - 1:1 R:R (no Monthly condition)
 */
export const DEFAULT_CONFIG: MultiTFBreakoutWDHADX1HConfig = {
    name: 'Multi-TF Breakout WDH ADX 1H',
    version: '1.0.0',
    direction: 'long',
    params: {
        // Trading window: 9:15 AM - 2:15 PM IST
        startHour: 9,
        startMinute: 15,
        endHour: 14,
        endMinute: 15,

        // 1:1 Risk:Reward
        riskRewardRatio: 1.0,

        // ADX filter (Hourly)
        adxThreshold: 25,
        adxPeriod: 14,
    }
};
