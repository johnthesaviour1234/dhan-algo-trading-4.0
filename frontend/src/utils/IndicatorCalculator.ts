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
     * Calculate EMA with secondary SMA smoothing (matches TradingView settings)
     * OPTIMIZED VERSION - O(n) instead of O(n²)
     * 
     * @param prices - Array of close prices (FULL array up to current bar)
     * @param emaPeriod - EMA period (e.g., 3 or 15)
     * @param smoothingPeriod - SMA smoothing period (default 9)
     * @param state - Optional state object for rolling calculation
     * @returns { value: smoothed EMA, state: updated state for next call }
     */
    static calculateSmoothedEMAFast(
        prices: number[],
        emaPeriod: number,
        smoothingPeriod: number = 9,
        state?: { ema: number; emaBuffer: number[]; bufferSum: number }
    ): { value: number | null; state: { ema: number; emaBuffer: number[]; bufferSum: number } | null } {
        if (prices.length < emaPeriod) {
            return { value: null, state: null };
        }

        const currentPrice = prices[prices.length - 1];
        const k = 2 / (emaPeriod + 1);

        let ema: number;
        let emaBuffer: number[];
        let bufferSum: number;

        if (!state) {
            // First call - calculate initial EMA using SMA seed
            const initialPrices = prices.slice(0, emaPeriod);
            ema = initialPrices.reduce((a, b) => a + b, 0) / emaPeriod;

            // Calculate remaining EMAs up to current
            for (let i = emaPeriod; i < prices.length; i++) {
                ema = prices[i] * k + ema * (1 - k);
            }

            emaBuffer = [ema];
            bufferSum = ema;
        } else {
            // Rolling calculation
            ema = currentPrice * k + state.ema * (1 - k);
            emaBuffer = [...state.emaBuffer, ema];
            bufferSum = state.bufferSum + ema;

            // Keep only last smoothingPeriod values
            if (emaBuffer.length > smoothingPeriod) {
                bufferSum -= emaBuffer.shift()!;
            }
        }

        // Return smoothed value if we have enough buffer
        const value = emaBuffer.length >= smoothingPeriod
            ? bufferSum / smoothingPeriod
            : null;

        return {
            value,
            state: { ema, emaBuffer, bufferSum }
        };
    }

    /**
     * Simple smoothed EMA for backward compatibility (still O(n) per call but no state)
     * Use calculateSmoothedEMAFast with state for best performance in loops
     */
    static calculateSmoothedEMA(
        prices: number[],
        emaPeriod: number,
        smoothingPeriod: number = 9
    ): number | null {
        if (prices.length < emaPeriod + smoothingPeriod - 1) {
            return null;
        }

        // Calculate EMA for each bar efficiently
        const k = 2 / (emaPeriod + 1);

        // Initialize with SMA
        let ema = prices.slice(0, emaPeriod).reduce((a, b) => a + b, 0) / emaPeriod;

        // Build EMA buffer for last smoothingPeriod values
        const emaBuffer: number[] = [];

        // Start from where we can begin collecting buffer
        const startIdx = Math.max(emaPeriod, prices.length - smoothingPeriod);

        // Calculate EMAs up to startIdx first
        for (let i = emaPeriod; i < startIdx; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }

        // Collect last smoothingPeriod EMA values
        for (let i = startIdx; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
            emaBuffer.push(ema);
        }

        // Return SMA of buffer
        if (emaBuffer.length < smoothingPeriod) {
            return null;
        }

        return emaBuffer.reduce((a, b) => a + b, 0) / smoothingPeriod;
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

    /**
     * Calculate ADX (Average Directional Index)
     * ADX measures trend strength regardless of direction
     * 
     * @param highs - Array of high prices
     * @param lows - Array of low prices  
     * @param closes - Array of close prices
     * @param period - ADX period (default 14)
     * @returns ADX value (0-100) or null if not enough data
     * 
     * Interpretation:
     * - ADX < 20: Weak trend / Range-bound
     * - ADX 20-25: Trend emerging
     * - ADX > 25: Strong trend
     * - ADX > 40: Very strong trend
     */
    static calculateADX(
        highs: number[],
        lows: number[],
        closes: number[],
        period: number = 14
    ): number | null {
        // Need at least period + 1 bars
        if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
            return null;
        }

        const len = highs.length;

        // Calculate True Range and Directional Movement for each bar
        const trueRanges: number[] = [];
        const plusDM: number[] = [];
        const minusDM: number[] = [];

        for (let i = 1; i < len; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevHigh = highs[i - 1];
            const prevLow = lows[i - 1];
            const prevClose = closes[i - 1];

            // True Range = max(H-L, |H-prevC|, |L-prevC|)
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);

            // +DM = H - prevH if positive and > L - prevL, else 0
            // -DM = prevL - L if positive and > H - prevH, else 0
            const upMove = high - prevHigh;
            const downMove = prevLow - low;

            if (upMove > downMove && upMove > 0) {
                plusDM.push(upMove);
            } else {
                plusDM.push(0);
            }

            if (downMove > upMove && downMove > 0) {
                minusDM.push(downMove);
            } else {
                minusDM.push(0);
            }
        }

        // Calculate smoothed ATR, +DM, -DM using Wilder's smoothing
        if (trueRanges.length < period) return null;

        // First smoothed values (simple average of first 'period' values)
        let smoothedTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

        const dxValues: number[] = [];

        // Calculate first DI values
        let plusDI = (smoothedPlusDM / smoothedTR) * 100;
        let minusDI = (smoothedMinusDM / smoothedTR) * 100;
        let dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
        if (!isNaN(dx) && isFinite(dx)) {
            dxValues.push(dx);
        }

        // Continue with Wilder's smoothing
        for (let i = period; i < trueRanges.length; i++) {
            smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];
            smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
            smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];

            plusDI = (smoothedPlusDM / smoothedTR) * 100;
            minusDI = (smoothedMinusDM / smoothedTR) * 100;

            if (plusDI + minusDI > 0) {
                dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
                if (!isNaN(dx) && isFinite(dx)) {
                    dxValues.push(dx);
                }
            }
        }

        // Need at least 'period' DX values to calculate ADX
        if (dxValues.length < period) return null;

        // First ADX is average of first 'period' DX values
        let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

        // Smooth remaining DX values
        for (let i = period; i < dxValues.length; i++) {
            adx = ((adx * (period - 1)) + dxValues[i]) / period;
        }

        return adx;
    }
}
