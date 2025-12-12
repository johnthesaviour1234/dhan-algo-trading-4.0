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
    };
}

// Strategy-specific analytics (minimal for simple crossover)
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
    version: '1.0.0',
    direction: 'long',
    params: {
        fastPeriod: 3,
        slowPeriod: 15
    }
};
