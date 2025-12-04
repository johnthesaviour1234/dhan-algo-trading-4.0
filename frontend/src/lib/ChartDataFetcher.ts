import { CandlestickData, Time } from 'lightweight-charts';
import { API_URL } from '../config/api';

/**
 * Chart Data Fetcher - Based on reverse-engineered Dhan implementation
 * Implements the getBars mechanism from bundle2.1.37.js Class Dn
 */
interface CacheEntry {
    data: CandlestickData[];
    timestamp: number;
}

export class ChartDataFetcher {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly IST_OFFSET_MINUTES = 330; // +5:30 hours
    private readonly MIN_DAYS = 7;
    private readonly SECONDS_PER_DAY = 86400;
    private readonly WEEK_SECONDS = 604800;

    /**
     * Calculate difference between two dates in days
     * Based on getDayDiff from Class Dn
     */
    private getDayDiff(dateA: Date, dateB: Date): number {
        const diff = dateA.getTime() - dateB.getTime();
        return Math.floor(diff / (this.SECONDS_PER_DAY * 1000));
    }

    /**
     * Normalize timestamp to midnight (remove time component)
     */
    private normalizeToMidnight(unixSeconds: number): Date {
        return new Date(new Date(unixSeconds * 1000).toDateString());
    }

    /**
     * Ensure minimum 7-day data window
     * Based on getChartsRange from Class Dn
     */
    private ensureMinimumRange(from: number, to: number): { from: number; to: number } {
        const currentDate = new Date(new Date().toDateString());

        // Normalize dates to midnight
        let startDate = this.normalizeToMidnight(from);
        let endDate = this.normalizeToMidnight(to);

        let adjustedFrom = Math.floor(startDate.getTime() / 1000);
        let adjustedTo = Math.floor(endDate.getTime() / 1000);

        // Calculate day differences
        const daysFrom = this.getDayDiff(currentDate, startDate);
        const daysTo = this.getDayDiff(currentDate, endDate);

        // Adjust for today
        if (daysTo === 0) {
            adjustedTo += this.SECONDS_PER_DAY;
        }

        // Ensure minimum 7-day window
        if (daysFrom - daysTo < this.MIN_DAYS) {
            adjustedFrom -= this.WEEK_SECONDS;
        }

        return { from: adjustedFrom, to: adjustedTo };
    }

    /**
     * Apply IST offset for request construction
     */
    private applyISTOffset(unixSeconds: number): Date {
        return new Date((unixSeconds + this.IST_OFFSET_MINUTES * 60) * 1000);
    }

    /**
     * Generate cache key - Symbol-based (no time range)
     * Matches Dhan's approach: cache per symbol, not per time range
     */
    private getCacheKey(symbol: string, interval: string): string {
        return `${symbol}_${interval}`;
    }

    /**
     * Process API response into chart bars
     * Based on response processing from Class Dn
     */
    private processBars(response: any): CandlestickData[] {
        if (!response.success || !response.data?.c || !response.data.c.length) {
            return [];
        }

        const data = response.data;
        const bars: CandlestickData[] = [];

        for (let i = 0; i < data.c.length; i++) {
            // Use timestamps directly from API (already in Unix seconds)
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
     * Main getBars method - fetches data with caching and minimum window enforcement
     * Based on getBars from Class Dn
     */
    async getBars(
        symbol: string,
        exchange: string,
        segment: string,
        secId: number,
        from: number,
        to: number,
        interval: string
    ): Promise<CandlestickData[]> {
        // 1. Enforce minimum 7-day range
        const adjusted = this.ensureMinimumRange(from, to);

        console.log(`📊 getBars: Original range ${from} to ${to}`);
        console.log(`📊 getBars: Adjusted range ${adjusted.from} to ${adjusted.to} (min 7 days enforced)`);

        // 2. Get or create symbol-based cache
        const cacheKey = this.getCacheKey(symbol, interval);
        let cachedBars: CandlestickData[] = [];

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey)!;
            const age = Date.now() - cached.timestamp;

            // Use cached bars as starting point
            cachedBars = cached.data;
            console.log(`📦 Found ${cachedBars.length} bars in cache (age: ${Math.floor(age / 1000)}s)`);

            // Check if we already have the requested range
            const oldestCached = cachedBars.length > 0 ? (cachedBars[0].time as number) : Infinity;
            const newestCached = cachedBars.length > 0 ? (cachedBars[cachedBars.length - 1].time as number) : 0;

            // If cache covers the requested range, return filtered data
            if (oldestCached <= adjusted.from && newestCached >= adjusted.to) {
                console.log('✅ Cache covers requested range, returning filtered data');
                return cachedBars.filter(bar => {
                    const t = bar.time as number;
                    return t >= adjusted.from && t <= adjusted.to;
                });
            }

            console.log('⚠️ Cache does not cover full range, fetching new data');
        }


        // 3. Apply IST offset for request times
        const startTime = this.applyISTOffset(adjusted.from);
        startTime.setHours(0, 0, 1, 0);

        const endTime = this.applyISTOffset(adjusted.to);
        endTime.setHours(23, 59, 59, 999);

        // 4. Build request payload
        const payload = {
            EXCH: exchange,
            SEG: segment,
            INST: 'EQUITY',
            SEC_ID: secId,
            START: Math.floor(startTime.getTime() / 1000),
            END: Math.floor(endTime.getTime() / 1000),
            START_TIME: startTime.toString(),
            END_TIME: endTime.toString(),
            INTERVAL: interval,
        };

        console.log('📤 Fetching from API with payload:', payload);

        try {
            // 5. Fetch from backend proxy
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

            // 6. Process response
            const bars = this.processBars(json);

            console.log(`✅ Received ${bars.length} bars from API`);

            // 7. Merge with cached bars + Apply 31-day retention (Dhan's approach)
            const now = Math.floor(Date.now() / 1000);
            const thirtyOneDaysAgo = now - (31 * 24 * 60 * 60);

            // Combine cached + new bars using Map for deduplication
            const barsMap = new Map<number, CandlestickData>();

            // Add existing cached bars
            cachedBars.forEach(bar => {
                const t = bar.time as number;
                // Only keep bars within 31 days
                if (t >= thirtyOneDaysAgo) {
                    barsMap.set(t, bar);
                }
            });

            // Add/update with new bars
            bars.forEach(bar => {
                const t = bar.time as number;
                if (t >= thirtyOneDaysAgo) {
                    barsMap.set(t, bar); // Last-Write-Wins
                }
            });

            // Convert to sorted array
            const allBars = Array.from(barsMap.values())
                .sort((a, b) => (a.time as number) - (b.time as number));

            console.log(`📊 Cache updated: ${allBars.length} total bars (31-day retention)`);
            console.log(`   Range: ${new Date((allBars[0]?.time as number || 0) * 1000).toISOString()} to ${new Date((allBars[allBars.length - 1]?.time as number || 0) * 1000).toISOString()}`);

            // 8. Update cache
            this.cache.set(cacheKey, {
                data: allBars,
                timestamp: Date.now()
            });

            // 9. Return bars for requested range
            return allBars.filter(bar => {
                const t = bar.time as number;
                return t >= adjusted.from && t <= adjusted.to;
            });
        } catch (error) {
            console.error('❌ Error fetching bars:', error);
            return [];
        }
    }

    /**
     * Clear cache for a specific symbol or all cache
     */
    clearCache(symbol?: string): void {
        if (symbol) {
            // Clear cache for specific symbol
            const keysToDelete: string[] = [];
            this.cache.forEach((_, key) => {
                if (key.startsWith(`${symbol}_`)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.cache.delete(key));
        } else {
            // Clear all cache
            this.cache.clear();
        }
    }
}
