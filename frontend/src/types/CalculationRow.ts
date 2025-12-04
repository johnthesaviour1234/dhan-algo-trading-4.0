/**
 * Calculation Row Interface
 * 
 * Represents a single row of real-time strategy calculations
 * showing OHLC candle data, indicator values, and generated signals
 */

export interface CalculationRow {
    timestamp: number; // Unix seconds
    time: string; // Formatted time (HH:MM:SS)
    open: number;
    high: number;
    low: number;
    close: number;
    fastMA: number; // EMA3 or SMA3
    slowMA: number; // EMA15 or SMA15
    fastAboveSlow: boolean; // Fast > Slow
    fastBelowSlow: boolean; // Fast < Slow
    signal: 'BUY' | 'SELL' | 'NONE'; // Signal generated
}
