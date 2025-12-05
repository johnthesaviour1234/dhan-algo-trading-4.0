import { CandlestickData } from 'lightweight-charts';

/**
 * Real-time OHLC Aggregator
 * Aggregates live LTP ticks into 1-minute candles
 * Based on REALTIME_TIMEFRAME_AGGREGATION.md implementation
 */

export interface OHLCCandle {
    time: number; // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface CandleCache {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    prevVolume: number; // For volume delta calculation
    firstTick: boolean;
}

export class RealtimeAggregator {
    private candleCache: Map<string, CandleCache> = new Map();
    private readonly resolution: number = 60; // 1 minute in seconds

    /**
     * Process incoming LTP tick and aggregate into 1-minute candle
     * @param symbol Security symbol/ID
     * @param ltp Last traded price
     * @param volume Cumulative volume
     * @param timestamp Timestamp in milliseconds or seconds
     * @returns Current aggregated candle
     */
    processTick(symbol: string, ltp: number, volume: number, timestamp: number | string): OHLCCandle {
        // Normalize timestamp to seconds
        let ts: number;
        if (typeof timestamp === 'string') {
            ts = Math.floor(new Date(timestamp).getTime() / 1000);
        } else if (timestamp > 10000000000) {
            // Likely milliseconds
            ts = Math.floor(timestamp / 1000);
        } else {
            // Already in seconds
            ts = Math.floor(timestamp);
        }

        // Align timestamp to 1-minute boundary (round down)
        const candleTime = this.alignTime(ts, this.resolution);

        const cacheKey = `${symbol}_1min`;
        let candle = this.candleCache.get(cacheKey);

        // Check if same candle or new candle
        if (candle && candle.time === candleTime) {
            // UPDATE EXISTING CANDLE

            // Update High
            if (ltp > candle.high) {
                candle.high = Math.max(ltp, candle.high);
            }

            // Update Low
            if (ltp < candle.low) {
                candle.low = Math.min(ltp, candle.low);
            }

            // Update Close (always latest LTP)
            candle.close = ltp;

            // Accumulate volume (only new volume since last tick)
            if (volume !== candle.prevVolume) {
                const volumeDelta = volume - candle.prevVolume;
                candle.volume += volumeDelta;
                console.log(`   🔢 Volume delta: ${volumeDelta} (total: ${candle.volume})`);
            }
            candle.prevVolume = volume;

        } else {
            // CREATE NEW CANDLE
            candle = {
                time: candleTime,
                open: ltp,
                high: ltp,
                low: ltp,
                close: ltp,
                volume: 0,
                prevVolume: volume, // Start from current cumulative volume
                firstTick: true
            };

            this.candleCache.set(cacheKey, candle);
            console.log(`   📍 New candle created at ${new Date(candleTime * 1000).toISOString()}, baseline volume: ${volume}`);
        }

        // Return formatted candle for display
        return {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        };
    }

    /**
     * Align timestamp to interval boundary
     * @param timestamp Unix timestamp in seconds
     * @param resolution Interval in seconds (60 for 1 minute)
     * @returns Aligned timestamp (rounded down to interval boundary)
     */
    private alignTime(timestamp: number, resolution: number): number {
        // Round down to interval boundary
        return Math.floor(timestamp / resolution) * resolution;
    }

    /**
     * Get current candle for a symbol
     * @param symbol Security symbol/ID
     * @returns Current candle or null
     */
    getCurrentCandle(symbol: string): OHLCCandle | null {
        const cacheKey = `${symbol}_1min`;
        const candle = this.candleCache.get(cacheKey);

        if (!candle) {
            return null;
        }

        return {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        };
    }

    /**
     * Convert CandlestickData to OHLCCandle format
     * @param candlestickData Data from chart
     * @returns Converted candle
     */
    static fromCandlestickData(candlestickData: CandlestickData): OHLCCandle {
        return {
            time: candlestickData.time as number,
            open: candlestickData.open,
            high: candlestickData.high,
            low: candlestickData.low,
            close: candlestickData.close,
            volume: 0 // Chart data doesn't include volume
        };
    }

    /**
     * Clear cache for a specific symbol or all symbols
     * @param symbol Optional symbol to clear
     */
    clearCache(symbol?: string): void {
        if (symbol) {
            const cacheKey = `${symbol}_1min`;
            this.candleCache.delete(cacheKey);
        } else {
            this.candleCache.clear();
        }
    }
}
