/**
 * HTF ADX Calculation Row Interface
 * 
 * Extends base HTF calculation with Daily ADX indicator
 * Used exclusively by Multi_TF_Breakout_ADX strategy
 */

export interface HTFADXCalculationRow {
    // Basic candle info
    timestamp: number;          // Unix seconds
    time: string;               // Formatted time (DD MMM YYYY, HH:MM)
    open: number;
    high: number;
    low: number;
    close: number;

    // HTF Levels - Previous period values used for entry conditions
    prev1HHigh: number | null;
    prev1HLow: number | null;
    prevDayHigh: number | null;
    prevDayLow: number | null;
    prevWeekHigh: number | null;
    prevWeekLow: number | null;
    prevMonthHigh: number | null;
    prevMonthLow: number | null;

    // Current period levels (for reference)
    curr1HHigh: number | null;
    curr1HLow: number | null;

    // Conditions - close compared to each level
    closeAbove1HHigh: boolean;
    closeAboveDayHigh: boolean;
    closeAboveWeekHigh: boolean;
    closeAboveMonthHigh: boolean;
    closeAboveAllHighs: boolean;

    closeBelow1HLow: boolean;
    closeBelowDayLow: boolean;
    closeBelowWeekLow: boolean;
    closeBelowMonthLow: boolean;
    closeBelowAllLows: boolean;

    // Boundary detection
    new1H: boolean;
    newDay: boolean;
    newWeek: boolean;
    newMonth: boolean;

    // State tracking
    allLevelsReady: boolean;
    longIsReset: boolean;
    shortIsReset: boolean;
    withinTradingWindow: boolean;

    // ADX Indicator (NEW - specific to ADX strategy)
    dailyADX: number | null;           // Current Daily ADX value (from completed candles)
    adxConditionMet: boolean;          // true if dailyADX >= threshold
    completedDailyCandles: number;     // Number of completed daily candles used for ADX

    // SL/TP for potential entry
    slPrice: number | null;
    tpPrice: number | null;

    // Signal
    signal: 'BUY' | 'SELL' | 'NONE';
    signalBlocked: boolean;
    blockedReason?: string;
}
