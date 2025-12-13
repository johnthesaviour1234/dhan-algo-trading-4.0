/**
 * EMA 3/15 Simple Strategy - Types
 * 
 * Strategy-specific types for the simple EMA crossover strategy.
 */

import { BaseStrategyConfig } from '../BaseStrategy';

// Strategy configuration
export interface EMASimpleConfig extends BaseStrategyConfig {
    name: string;
    version: string;
    direction: 'long';  // Only long for this strategy
    params: {
        fastPeriod: number;  // EMA 3
        slowPeriod: number;  // EMA 15
        adxThreshold: number; // ADX filter: 0 = disabled, >0 = only trade when ADX > threshold
        // v1.4.0: ATR-based Stop Loss & Target Profit
        atrPeriod: number;       // ATR calculation period (default: 14)
        atrMultiplierSL: number; // Stop Loss = Entry - (ATR × multiplier)
        atrMultiplierTP: number; // Target Profit = Entry + (ATR × multiplier)
        // v1.5.0: Additional filters
        minEmaGap?: number;      // Minimum EMA gap % to enter (0.1 = 0.1%)
        skipTimeStart?: string;  // Skip entries between these times (e.g., '09:45')
        skipTimeEnd?: string;    // End of skip window (e.g., '10:15')
        maxHoldMinutes?: number; // Max hold time before forced exit (0 = disabled)
    };
}

// Strategy-specific analytics (enhanced for loss analysis)
export interface EMASimpleAnalytics {
    // Basic performance
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;

    // Hourly breakdown (useful for time-based analysis)
    hourlyPerformance: Array<{
        hour: string;
        trades: number;
        winRate: number;
        avgPnl: number;
        totalPnl: number;
    }>;

    // Day of week breakdown
    dayOfWeekPerformance: Array<{
        day: string;
        trades: number;
        winRate: number;
        avgPnl: number;
        totalPnl: number;
    }>;

    // EMA Gap analysis (how gap at entry affects outcome)
    emaGapAnalysis: {
        avgGapOnWinners: number;
        avgGapOnLosers: number;
    };

    // RSI analysis at entry
    rsiAnalysis: {
        avgRsiOnWinners: number;
        avgRsiOnLosers: number;
    };

    // NEW v1.3.0: Duration analysis - do longer trades perform better?
    durationAnalysis: {
        under1min: { trades: number; winRate: number; avgPnl: number };
        between1and5min: { trades: number; winRate: number; avgPnl: number };
        over5min: { trades: number; winRate: number; avgPnl: number };
    };

    // NEW v1.3.0: Gross vs Net - are we profitable before costs?
    grossVsNetAnalysis: {
        totalGrossPnl: number;
        totalNetPnl: number;
        totalCosts: number;
        grossWinRate: number;  // Win rate before costs
        netWinRate: number;    // Win rate after costs
    };

    // NEW v1.3.0: Market condition at entry - detecting sideways markets
    marketConditionAnalysis: {
        avgEmaGapOnWinners: number;
        avgEmaGapOnLosers: number;
        tradesWithEmaGapUnder0_1: number;   // Sideways indicator
        tradesWithEmaGapOver0_1: number;    // Trending indicator
        winRateWithEmaGapUnder0_1: number;
        winRateWithEmaGapOver0_1: number;
    };
}

// Strategy-specific export format (clean and minimal)
export interface EMASimpleExport {
    exportDate: string;
    strategy: {
        name: string;
        version: string;
        description: string;
    };
    backtestPeriod: {
        start: string;
        end: string;
    };
    summary: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        profitFactor: number;
        expectancy: number;
        avgWin: number;
        avgLoss: number;
        totalPnl: number;
    };
    analytics: EMASimpleAnalytics;
    trades: Array<{
        tradeNumber: number;
        entryDate: string;
        exitDate: string;
        direction: string;
        entryPrice: number;
        exitPrice: number;
        grossPnl: number;
        netPnl: number;
        pnlPercent: number;
        duration: string;
        // Strategy-specific indicators only
        indicators: {
            ema3: number;
            ema15: number;
            emaGapPercent: number;
            adx: number;
            rsi: number;
            priceAboveEma3: boolean;
            priceDistPercent: number;
            hour: string;
            day: string;
            barsSinceCross: number;
        };
    }>;
}

// Default configuration
export const DEFAULT_CONFIG: EMASimpleConfig = {
    name: 'EMA 3/15 Simple',
    version: '1.5.0',
    direction: 'long',
    params: {
        fastPeriod: 3,
        slowPeriod: 15,
        adxThreshold: 40,
        // v1.5.0: Improved ATR-based SL/TP (1:2 R:R)
        atrPeriod: 14,
        atrMultiplierSL: 2,   // SL = Entry - (ATR × 2) - tighter
        atrMultiplierTP: 4,   // TP = Entry + (ATR × 4) = 1:2 R:R
        // v1.5.0: Additional filters
        minEmaGap: 0.1,       // Only trade when EMA gap >= 0.1% (trending)
        skipTimeStart: '09:45', // Skip 9:45-10:15 (gap reversal zone)
        skipTimeEnd: '10:15',
        maxHoldMinutes: 60,   // Max 60 min hold time
    }
};
