/**
 * Indicator Calculator
 * 
 * Provides efficient rolling calculations for technical indicators (EMA, SMA)
 * without recalculating entire history on each update.
 */

export class IndicatorCalculator {
    /**
     * Calculate Simple Moving Average
     */
    static calculateSMA(prices: number[], period: number): number | null {
        if (prices.length < period) {
            return null; // Not enough data
        }

        const relevantPrices = prices.slice(-period);
        const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
        return sum / period;
    }

    /**
     * Calculate Exponential Moving Average
     * Uses previous EMA for efficient rolling calculation
     */
    static calculateEMA(prices: number[], period: number, previousEMA?: number): number | null {
        if (prices.length === 0) {
            return null;
        }

        const currentPrice = prices[prices.length - 1];

        // If we don't have previous EMA, calculate initial SMA
        if (previousEMA === undefined) {
            if (prices.length < period) {
                return null; // Not enough data for initial calculation
            }
            // Use SMA of first 'period' prices as initial EMA
            const initialPrices = prices.slice(0, period);
            previousEMA = initialPrices.reduce((acc, p) => acc + p, 0) / period;

            // If we only had exactly 'period' prices, return the SMA
            if (prices.length === period) {
                return previousEMA;
            }

            // Otherwise, iterate through remaining prices to get current EMA
            for (let i = period; i < prices.length; i++) {
                const k = 2 / (period + 1);
                previousEMA = (prices[i] * k) + (previousEMA * (1 - k));
            }
            return previousEMA;
        }

        // Rolling calculation using previous EMA
        const k = 2 / (period + 1); // Smoothing factor
        const newEMA = (currentPrice * k) + (previousEMA * (1 - k));
        return newEMA;
    }

    /**
     * Calculate both EMA values needed for crossover detection
     */
    static calculateEMACrossover(
        prices: number[],
        fastPeriod: number,
        slowPeriod: number,
        previousFastEMA?: number,
        previousSlowEMA?: number
    ): { fastEMA: number | null; slowEMA: number | null } {
        return {
            fastEMA: this.calculateEMA(prices, fastPeriod, previousFastEMA),
            slowEMA: this.calculateEMA(prices, slowPeriod, previousSlowEMA)
        };
    }

    /**
     * Calculate both SMA values needed for crossover detection
     */
    static calculateSMACrossover(
        prices: number[],
        fastPeriod: number,
        slowPeriod: number
    ): { fastSMA: number | null; slowSMA: number | null } {
        return {
            fastSMA: this.calculateSMA(prices, fastPeriod),
            slowSMA: this.calculateSMA(prices, slowPeriod)
        };
    }

    /**
     * Detect crossover between two moving averages
     * Returns: 'bullish' (fast crossed above slow), 'bearish' (fast crossed below slow), or null
     */
    static detectCrossover(
        currentFast: number,
        currentSlow: number,
        previousFast?: number,
        previousSlow?: number
    ): 'bullish' | 'bearish' | null {
        if (previousFast === undefined || previousSlow === undefined) {
            return null; // Need previous values to detect crossover
        }

        const wasFastAboveSlow = previousFast > previousSlow;
        const isFastAboveSlow = currentFast > currentSlow;

        if (!wasFastAboveSlow && isFastAboveSlow) {
            return 'bullish'; // Fast crossed above slow (golden cross)
        } else if (wasFastAboveSlow && !isFastAboveSlow) {
            return 'bearish'; // Fast crossed below slow (death cross)
        }

        return null; // No crossover
    }
}
