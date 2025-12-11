import { CandlestickData } from 'lightweight-charts';

/**
 * HTF (Higher Timeframe) Aggregator
 * 
 * Aggregates 1-minute OHLC bars into higher timeframe bars (hourly, daily).
 * Designed for backtesting with STRICT look-ahead bias prevention.
 * 
 * CRITICAL: At any 1-min timestamp, we only use the LAST COMPLETED HTF candle,
 * never the in-progress one.
 */

export interface HTFBar {
    time: number;       // Start time of HTF candle (Unix seconds)
    endTime: number;    // End time of HTF candle (Unix seconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    complete: boolean;  // Whether candle is complete
}

export class HTFAggregator {
    /**
     * Aggregate 1-minute bars into higher timeframe bars
     * 
     * @param bars - Array of 1-minute CandlestickData
     * @param minutesPerCandle - Minutes per HTF candle (60=hourly, 300=daily 9:30-2:30)
     * @returns Array of HTFBar with complete/incomplete status
     */
    static aggregate(bars: CandlestickData[], minutesPerCandle: number): HTFBar[] {
        if (bars.length === 0) return [];

        const secondsPerCandle = minutesPerCandle * 60;
        const htfBars: Map<number, HTFBar> = new Map();

        for (const bar of bars) {
            const barTime = bar.time as number;

            // Calculate HTF candle start time (floor to nearest interval)
            const htfStartTime = Math.floor(barTime / secondsPerCandle) * secondsPerCandle;
            const htfEndTime = htfStartTime + secondsPerCandle;

            const volume = (bar as any).volume || 0;

            if (!htfBars.has(htfStartTime)) {
                // Start new HTF candle
                htfBars.set(htfStartTime, {
                    time: htfStartTime,
                    endTime: htfEndTime,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: volume,
                    complete: false  // Will be marked complete later
                });
            } else {
                // Update existing HTF candle
                const htfBar = htfBars.get(htfStartTime)!;
                htfBar.high = Math.max(htfBar.high, bar.high);
                htfBar.low = Math.min(htfBar.low, bar.low);
                htfBar.close = bar.close;
                htfBar.volume += volume;
            }
        }

        // Convert to sorted array
        const result = Array.from(htfBars.values())
            .sort((a, b) => a.time - b.time);

        // Mark all but the last candle as complete
        // (Last candle may be incomplete since data might end mid-candle)
        for (let i = 0; i < result.length - 1; i++) {
            result[i].complete = true;
        }

        return result;
    }

    /**
     * Get the index of the LAST COMPLETED HTF bar at a given 1-min timestamp
     * 
     * CRITICAL for look-ahead bias prevention:
     * - Returns the index of the most recent COMPLETED HTF candle
     * - Never returns an in-progress candle
     * 
     * Example: At 9:30 AM with 60-min candles:
     * - Current HTF: 9:15-10:15 (incomplete at 9:30)
     * - Returns: 8:15-9:15 candle (the last completed one)
     * 
     * @param htfBars - Pre-computed HTF bars
     * @param currentTime - Current 1-min bar timestamp (Unix seconds)
     * @returns Index of last completed HTF bar, or -1 if none available
     */
    static getLastCompletedBarIndex(htfBars: HTFBar[], currentTime: number): number {
        // Find the last HTF bar whose END TIME is <= currentTime
        // This ensures we only use fully completed candles
        for (let i = htfBars.length - 1; i >= 0; i--) {
            if (htfBars[i].endTime <= currentTime) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Get the LAST COMPLETED HTF bar at a given 1-min timestamp
     */
    static getLastCompletedBar(htfBars: HTFBar[], currentTime: number): HTFBar | null {
        const idx = this.getLastCompletedBarIndex(htfBars, currentTime);
        return idx >= 0 ? htfBars[idx] : null;
    }

    /**
     * Calculate EMA values for all HTF bars
     * Uses same O(n) algorithm as IndicatorCalculator
     */
    static calculateHTFEMAs(htfBars: HTFBar[], period: number): (number | null)[] {
        if (htfBars.length < period) {
            return new Array(htfBars.length).fill(null);
        }

        const closes = htfBars.map(b => b.close);
        const result: (number | null)[] = new Array(closes.length).fill(null);

        // Initialize with SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += closes[i];
        }
        let ema = sum / period;
        result[period - 1] = ema;

        // EMA for remaining bars
        const k = 2 / (period + 1);
        for (let i = period; i < closes.length; i++) {
            ema = closes[i] * k + ema * (1 - k);
            result[i] = ema;
        }

        return result;
    }

    /**
     * Format HTF bar time for logging
     */
    static formatHTFTime(htfBar: HTFBar): string {
        const start = new Date(htfBar.time * 1000);
        const end = new Date(htfBar.endTime * 1000);
        return `${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }
}
