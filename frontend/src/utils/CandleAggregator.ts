import { CandlestickData, Time } from 'lightweight-charts';

/**
 * Candle Aggregator
 * 
 * Aggregates real-time tick data (LTP updates) into 1-minute candles
 * for use in strategy calculations.
 */

export interface Candle {
    time: number; // Unix timestamp in seconds (start of minute)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export type CandleCallback = (candle: Candle) => void;

export class CandleAggregator {
    private currentCandle: Candle | null = null;
    private callbacks: CandleCallback[] = [];
    private lastEmittedTime: number = 0;

    /**
     * Process an incoming tick (LTP update)
     */
    onTick(ltp: number, volume: number, timestamp: Date = new Date()): void {
        // Round down to start of current minute
        const currentMinuteMs = Math.floor(timestamp.getTime() / 60000) * 60000;
        const currentMinuteSec = Math.floor(currentMinuteMs / 1000);

        // Check if we've moved to a new minute
        if (!this.currentCandle || this.currentCandle.time !== currentMinuteSec) {
            // Emit completed candle if it exists
            if (this.currentCandle && this.currentCandle.time !== this.lastEmittedTime) {
                console.log('📊 [CandleAggregator] Completed candle:', {
                    time: new Date(this.currentCandle.time * 1000).toISOString(),
                    ...this.currentCandle
                });
                this.emitCandle(this.currentCandle);
                this.lastEmittedTime = this.currentCandle.time;
            }

            // Start new candle
            this.currentCandle = {
                time: currentMinuteSec,
                open: ltp,
                high: ltp,
                low: ltp,
                close: ltp,
                volume: volume
            };

            console.log('📊 [CandleAggregator] Started new candle:', {
                time: new Date(currentMinuteSec * 1000).toISOString(),
                open: ltp
            });
        } else {
            // Update existing candle
            this.currentCandle.high = Math.max(this.currentCandle.high, ltp);
            this.currentCandle.low = Math.min(this.currentCandle.low, ltp);
            this.currentCandle.close = ltp;
            this.currentCandle.volume = volume; // Use latest volume (cumulative for the day)
        }
    }

    /**
     * Register a callback to be called when a candle completes
     */
    subscribe(callback: CandleCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Unregister a callback
     */
    unsubscribe(callback: CandleCallback): void {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }

    /**
     * Emit candle to all subscribers
     */
    private emitCandle(candle: Candle): void {
        this.callbacks.forEach(callback => {
            try {
                callback(candle);
            } catch (error) {
                console.error('❌ [CandleAggregator] Error in callback:', error);
            }
        });
    }

    /**
     * Get current incomplete candle (for debugging)
     */
    getCurrentCandle(): Candle | null {
        return this.currentCandle ? { ...this.currentCandle } : null;
    }

    /**
     * Convert to CandlestickData format for charts
     */
    static toCandlestickData(candle: Candle): CandlestickData {
        return {
            time: candle.time as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
        };
    }
}
