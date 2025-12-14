/**
 * HTF Calculation Row Interface
 * 
 * Represents a single row of Multi-TF Breakout strategy calculations
 * showing OHLC candle data, HTF levels, conditions, and signals
 */

export interface HTFCalculationRow {
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
    closeAboveAllHighs: boolean;  // The entry condition

    closeBelow1HLow: boolean;
    closeBelowDayLow: boolean;
    closeBelowWeekLow: boolean;
    closeBelowMonthLow: boolean;
    closeBelowAllLows: boolean;   // The short entry condition

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

    // SL/TP for potential entry
    slPrice: number | null;       // Stop loss price (prev 1H low)
    tpPrice: number | null;       // Take profit price

    // Signal
    signal: 'BUY' | 'SELL' | 'NONE';
    signalBlocked: boolean;       // True if conditions met but blocked by reset
    blockedReason?: string;       // Why signal was blocked
}
