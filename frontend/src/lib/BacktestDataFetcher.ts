import { CandlestickData, Time } from 'lightweight-charts';
import { API_URL } from '../config/api';

/**
 * Backtest Data Fetcher
 * 
 * Similar to ChartDataFetcher but WITHOUT the 31-day storage limit.
 * Designed for backtesting which needs access to unlimited historical data.
 * Fetches data in 7-day batches and merges them carefully to avoid gaps/duplicates.
 * 
 * Rate limiting: Adds delay between API calls to avoid overwhelming the server
 * UI yielding: Yields to UI thread periodically to prevent browser freeze
 */

interface CacheEntry {
    data: CandlestickData[];
    timestamp: number;
}

export interface BacktestSymbolConfig {
    symbol: string;
    exchange: string;
    segment: string;
    secId: number;
    interval: string;
}

export class BacktestDataFetcher {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly IST_OFFSET_MINUTES = 330; // +5:30 hours
    private readonly SECONDS_PER_DAY = 86400;
    private readonly BATCH_DAYS = 7; // Fetch 7 days per batch

    // Rate limiting settings
    private readonly RATE_LIMIT_DELAY_MS = 500; // 500ms between API calls
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 1000; // 1 second retry delay

    /**
     * Yield to UI thread to prevent browser freeze
     * Uses requestAnimationFrame for better UI responsiveness
     */
    private async yieldToUI(): Promise<void> {
        return new Promise(resolve => {
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => setTimeout(resolve, 0));
            } else {
                setTimeout(resolve, 0);
            }
        });
    }

    /**
     * Rate-limited delay between API calls
     */
    private async rateLimitDelay(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
        await this.yieldToUI();
    }

    /**
     * Generate cache key for a symbol
     */
    private getCacheKey(symbol: string, interval: string): string {
        return `backtest_${symbol}_${interval}`;
    }

    /**
     * Apply IST offset for request construction
     */
    private applyISTOffset(unixSeconds: number): Date {
        return new Date((unixSeconds + this.IST_OFFSET_MINUTES * 60) * 1000);
    }

    /**
     * Process API response into chart bars
     */
    private processBars(response: any): CandlestickData[] {
        if (!response.success || !response.data?.c || !response.data.c.length) {
            return [];
        }

        const data = response.data;
        const bars: CandlestickData[] = [];

        for (let i = 0; i < data.c.length; i++) {
            bars.push({
                time: data.t[i] as Time,
                open: parseFloat(data.o[i]),
                high: parseFloat(data.h[i]),
                low: parseFloat(data.l[i]),
                close: parseFloat(data.c[i]),
            });
        }

        // Sort chronologically
        bars.sort((a, b) => (a.time as number) - (b.time as number));
        return bars;
    }

    /**
     * Fetch a single batch of data (up to 7 days)
     */
    private async fetchBatch(
        startUnix: number,
        endUnix: number,
        config: BacktestSymbolConfig
    ): Promise<CandlestickData[]> {
        const startTime = this.applyISTOffset(startUnix);
        startTime.setHours(0, 0, 1, 0);

        const endTime = this.applyISTOffset(endUnix);
        endTime.setHours(23, 59, 59, 999);

        const payload = {
            EXCH: config.exchange,
            SEG: config.segment,
            INST: 'EQUITY',
            SEC_ID: config.secId,
            START: Math.floor(startTime.getTime() / 1000),
            END: Math.floor(endTime.getTime() / 1000),
            START_TIME: startTime.toString(),
            END_TIME: endTime.toString(),
            INTERVAL: config.interval,
        };

        console.log(`📤 [Backtest] Fetching batch: ${new Date(startUnix * 1000).toISOString().split('T')[0]} to ${new Date(endUnix * 1000).toISOString().split('T')[0]}`);

        try {
            const response = await fetch(`${API_URL}/api/getData`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`API responded with ${response.status}`);
            }

            const json = await response.json();
            return this.processBars(json);
        } catch (error) {
            console.error('❌ [Backtest] Error fetching batch:', error);
            return [];
        }
    }

    /**
     * Calculate missing date ranges that need to be fetched
     * Returns an array of {from, to} ranges that are not covered by existing data
     */
    private calculateMissingRanges(
        requestedFrom: number,
        requestedTo: number,
        existingData: CandlestickData[]
    ): { from: number; to: number }[] {
        if (existingData.length === 0) {
            return [{ from: requestedFrom, to: requestedTo }];
        }

        // Sort existing data by time
        const sorted = [...existingData].sort((a, b) => (a.time as number) - (b.time as number));

        const oldestCached = sorted[0].time as number;
        const newestCached = sorted[sorted.length - 1].time as number;

        const missing: { from: number; to: number }[] = [];

        // Check if we need data before cached range
        if (requestedFrom < oldestCached - 60) { // -60s buffer
            missing.push({
                from: requestedFrom,
                to: Math.min(oldestCached - 60, requestedTo)
            });
        }

        // Check if we need data after cached range  
        if (requestedTo > newestCached + 60) { // +60s buffer
            missing.push({
                from: Math.max(newestCached + 60, requestedFrom),
                to: requestedTo
            });
        }

        console.log(`📊 [Backtest] Missing ranges calculated:`, missing.map(r =>
            `${new Date(r.from * 1000).toISOString().split('T')[0]} to ${new Date(r.to * 1000).toISOString().split('T')[0]}`
        ));

        return missing;
    }

    /**
     * Split a date range into 7-day batches
     */
    private splitIntoBatches(from: number, to: number): { from: number; to: number }[] {
        const batches: { from: number; to: number }[] = [];
        const batchSeconds = this.BATCH_DAYS * this.SECONDS_PER_DAY;

        let currentFrom = from;
        while (currentFrom < to) {
            const currentTo = Math.min(currentFrom + batchSeconds, to);
            batches.push({ from: currentFrom, to: currentTo });
            currentFrom = currentTo + 60; // +60s to avoid overlap
        }

        return batches;
    }

    /**
     * Main method: Fetch all data for a backtest date range
     * Handles caching, batch fetching, and deduplication
     */
    async fetchBacktestData(
        fromDate: Date,
        toDate: Date,
        config: BacktestSymbolConfig,
        onProgress?: (progress: number, message: string) => void
    ): Promise<CandlestickData[]> {
        const fromUnix = Math.floor(fromDate.getTime() / 1000);
        const toUnix = Math.floor(toDate.getTime() / 1000);

        console.log(`📊 [Backtest] Fetching data from ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);

        // Get or create cache for this symbol
        const cacheKey = this.getCacheKey(config.symbol, config.interval);
        let cachedData: CandlestickData[] = [];

        if (this.cache.has(cacheKey)) {
            cachedData = this.cache.get(cacheKey)!.data;
            console.log(`📦 [Backtest] Found ${cachedData.length} bars in cache`);
        }

        // Calculate what ranges we need to fetch
        const missingRanges = this.calculateMissingRanges(fromUnix, toUnix, cachedData);

        if (missingRanges.length === 0) {
            console.log('✅ [Backtest] All data already cached, filtering to requested range');
            return this.filterToRange(cachedData, fromUnix, toUnix);
        }

        // Split missing ranges into 7-day batches
        const allBatches: { from: number; to: number }[] = [];
        for (const range of missingRanges) {
            allBatches.push(...this.splitIntoBatches(range.from, range.to));
        }

        console.log(`📥 [Backtest] Need to fetch ${allBatches.length} batches`);

        // Fetch all batches
        const allNewBars: CandlestickData[] = [];
        let completedBatches = 0;

        for (const batch of allBatches) {
            const batchBars = await this.fetchBatch(batch.from, batch.to, config);
            allNewBars.push(...batchBars);
            completedBatches++;

            const progress = Math.round((completedBatches / allBatches.length) * 100);
            const message = `Fetching historical data: ${completedBatches}/${allBatches.length} batches`;

            if (onProgress) {
                onProgress(progress, message);
            }

            console.log(`📦 [Backtest] Batch ${completedBatches}/${allBatches.length}: ${batchBars.length} bars`);

            // Rate limiting: 500ms delay + UI yield between batches
            if (completedBatches < allBatches.length) {
                await this.rateLimitDelay();
            }
        }

        // Merge cached and new bars using Map for deduplication
        const barsMap = new Map<number, CandlestickData>();

        // Add existing cached bars
        cachedData.forEach(bar => {
            barsMap.set(bar.time as number, bar);
        });

        // Add new bars (will overwrite duplicates with fresh data)
        allNewBars.forEach(bar => {
            barsMap.set(bar.time as number, bar);
        });

        // Convert to sorted array - NO 31-day limit for backtest!
        const mergedBars = Array.from(barsMap.values())
            .sort((a, b) => (a.time as number) - (b.time as number));

        console.log(`✅ [Backtest] Total bars after merge: ${mergedBars.length}`);
        if (mergedBars.length > 0) {
            console.log(`   Range: ${new Date((mergedBars[0].time as number) * 1000).toISOString()} to ${new Date((mergedBars[mergedBars.length - 1].time as number) * 1000).toISOString()}`);
        }

        // Update cache with all data (no limit!)
        this.cache.set(cacheKey, {
            data: mergedBars,
            timestamp: Date.now()
        });

        // Return only the requested range
        return this.filterToRange(mergedBars, fromUnix, toUnix);
    }

    /**
     * Filter data to requested range
     */
    private filterToRange(
        data: CandlestickData[],
        fromUnix: number,
        toUnix: number
    ): CandlestickData[] {
        return data.filter(bar => {
            const time = bar.time as number;
            return time >= fromUnix && time <= toUnix;
        });
    }

    /**
     * Get cached data without fetching
     */
    getCachedData(symbol: string, interval: string): CandlestickData[] {
        const cacheKey = this.getCacheKey(symbol, interval);
        if (this.cache.has(cacheKey)) {
            return [...this.cache.get(cacheKey)!.data];
        }
        return [];
    }

    /**
     * Clear cache for a specific symbol or all cache
     */
    clearCache(symbol?: string): void {
        if (symbol) {
            const keysToDelete: string[] = [];
            this.cache.forEach((_, key) => {
                if (key.includes(`_${symbol}_`)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.cache.delete(key));
        } else {
            this.cache.clear();
        }
    }
}

// Singleton instance for shared use
export const backtestDataFetcher = new BacktestDataFetcher();
