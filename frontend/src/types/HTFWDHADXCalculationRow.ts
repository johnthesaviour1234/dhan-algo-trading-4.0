/**
 * HTF WDH ADX Calculation Row Interface
 * 
 * For Multi_TF_Breakout_WDH_ADX strategy
 * Includes Weekly/Daily/Hourly levels (NO Monthly) + Daily ADX
 */

export interface HTFWDHADXCalculationRow {
    // Basic candle info
    timestamp: number;
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;

    // HTF Levels - Previous period values (NO Monthly)
    prev1HHigh: number | null;
    prev1HLow: number | null;
    prevDayHigh: number | null;
    prevDayLow: number | null;
    prevWeekHigh: number | null;
    prevWeekLow: number | null;

    // Current period levels
    curr1HHigh: number | null;
    curr1HLow: number | null;

    // Conditions (NO Monthly)
    closeAbove1HHigh: boolean;
    closeAboveDayHigh: boolean;
    closeAboveWeekHigh: boolean;
    closeAboveAllHighs: boolean;

    closeBelow1HLow: boolean;
    closeBelowDayLow: boolean;
    closeBelowWeekLow: boolean;
    closeBelowAllLows: boolean;

    // Boundary detection (NO Monthly)
    new1H: boolean;
    newDay: boolean;
    newWeek: boolean;

    // State tracking
    allLevelsReady: boolean;
    longIsReset: boolean;
    shortIsReset: boolean;
    withinTradingWindow: boolean;

    // ADX Indicator (Daily)
    dailyADX: number | null;
    adxConditionMet: boolean;
    completedDailyCandles: number;

    // SL/TP
    slPrice: number | null;
    tpPrice: number | null;

    // Signal
    signal: 'BUY' | 'SELL' | 'NONE';
    signalBlocked: boolean;
    blockedReason?: string;
}
