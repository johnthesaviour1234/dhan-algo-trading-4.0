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

    // ========== OPTIMIZED ROLLING CALCULATORS FOR LARGE DATASETS ==========

    /**
     * State for rolling ADX calculation - O(1) per update
     */
    static initADXState(period: number = 14): ADXRollingState {
        return {
            period,
            barCount: 0,
            prevHigh: 0,
            prevLow: 0,
            prevClose: 0,
            smoothedTR: 0,
            smoothedPlusDM: 0,
            smoothedMinusDM: 0,
            adx: 0,
            dxBuffer: [],
            trBuffer: [],
            plusDMBuffer: [],
            minusDMBuffer: [],
            initialized: false,
            adxInitialized: false
        };
    }

    /**
     * Update ADX with a new bar - O(1) complexity
     * Call this for each new bar instead of recalculating from scratch
     */
    static updateADX(
        state: ADXRollingState,
        high: number,
        low: number,
        close: number
    ): number | null {
        const period = state.period;

        // First bar - just store values
        if (state.barCount === 0) {
            state.prevHigh = high;
            state.prevLow = low;
            state.prevClose = close;
            state.barCount = 1;
            return null;
        }

        // Calculate TR and DM for this bar
        const tr = Math.max(
            high - low,
            Math.abs(high - state.prevClose),
            Math.abs(low - state.prevClose)
        );

        const upMove = high - state.prevHigh;
        const downMove = state.prevLow - low;

        let plusDM = 0;
        let minusDM = 0;

        if (upMove > downMove && upMove > 0) {
            plusDM = upMove;
        }
        if (downMove > upMove && downMove > 0) {
            minusDM = downMove;
        }

        // Update previous values
        state.prevHigh = high;
        state.prevLow = low;
        state.prevClose = close;
        state.barCount++;

        // Accumulation phase - collect first 'period' values
        if (!state.initialized) {
            state.trBuffer.push(tr);
            state.plusDMBuffer.push(plusDM);
            state.minusDMBuffer.push(minusDM);

            if (state.trBuffer.length === period) {
                // Initialize smoothed values
                state.smoothedTR = state.trBuffer.reduce((a, b) => a + b, 0);
                state.smoothedPlusDM = state.plusDMBuffer.reduce((a, b) => a + b, 0);
                state.smoothedMinusDM = state.minusDMBuffer.reduce((a, b) => a + b, 0);
                state.initialized = true;

                // Calculate first DX
                const plusDI = (state.smoothedPlusDM / state.smoothedTR) * 100;
                const minusDI = (state.smoothedMinusDM / state.smoothedTR) * 100;
                if (plusDI + minusDI > 0) {
                    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
                    if (!isNaN(dx) && isFinite(dx)) {
                        state.dxBuffer.push(dx);
                    }
                }
            }
            return null;
        }

        // Wilder's smoothing for TR, +DM, -DM
        state.smoothedTR = state.smoothedTR - (state.smoothedTR / period) + tr;
        state.smoothedPlusDM = state.smoothedPlusDM - (state.smoothedPlusDM / period) + plusDM;
        state.smoothedMinusDM = state.smoothedMinusDM - (state.smoothedMinusDM / period) + minusDM;

        // Calculate DI and DX
        const plusDI = (state.smoothedPlusDM / state.smoothedTR) * 100;
        const minusDI = (state.smoothedMinusDM / state.smoothedTR) * 100;

        if (plusDI + minusDI <= 0) return state.adxInitialized ? state.adx : null;

        const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
        if (isNaN(dx) || !isFinite(dx)) return state.adxInitialized ? state.adx : null;

        // ADX initialization phase
        if (!state.adxInitialized) {
            state.dxBuffer.push(dx);
            if (state.dxBuffer.length === period) {
                state.adx = state.dxBuffer.reduce((a, b) => a + b, 0) / period;
                state.adxInitialized = true;
            }
            return state.adxInitialized ? state.adx : null;
        }

        // Smooth ADX
        state.adx = ((state.adx * (period - 1)) + dx) / period;
        return state.adx;
    }

    /**
     * Calculate all EMAs for entire dataset in a single pass - O(n)
     * Returns array of EMA values for each bar
     */
    static calculateAllEMAs(prices: number[], period: number): (number | null)[] {
        const result: (number | null)[] = new Array(prices.length).fill(null);
        if (prices.length < period) return result;

        // Initialize with SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        let ema = sum / period;
        result[period - 1] = ema;

        // EMA for remaining bars
        const k = 2 / (period + 1);
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
            result[i] = ema;
        }

        return result;
    }

    /**
     * Calculate all Smoothed EMAs (EMA with SMA smoothing) in a single pass - O(n)
     * This matches TradingView's EMA with secondary SMA smoothing
     */
    static calculateAllSmoothedEMAs(
        prices: number[],
        emaPeriod: number,
        smoothingPeriod: number = 9
    ): (number | null)[] {
        const result: (number | null)[] = new Array(prices.length).fill(null);
        const minRequired = emaPeriod + smoothingPeriod - 1;
        if (prices.length < minRequired) return result;

        // First calculate all raw EMAs
        const emaValues = this.calculateAllEMAs(prices, emaPeriod);

        // Now apply SMA smoothing using rolling window
        let bufferSum = 0;
        const buffer: number[] = [];

        for (let i = emaPeriod - 1; i < prices.length; i++) {
            const ema = emaValues[i];
            if (ema === null) continue;

            buffer.push(ema);
            bufferSum += ema;

            if (buffer.length > smoothingPeriod) {
                bufferSum -= buffer.shift()!;
            }

            if (buffer.length === smoothingPeriod) {
                result[i] = bufferSum / smoothingPeriod;
            }
        }

        return result;
    }

    /**
     * Calculate all ADX values for entire dataset in a single pass - O(n)
     * Much faster than calling calculateADX for each bar
     */
    static calculateAllADX(
        highs: number[],
        lows: number[],
        closes: number[],
        period: number = 14
    ): (number | null)[] {
        const len = highs.length;
        const result: (number | null)[] = new Array(len).fill(null);

        if (len < period * 2 + 1) return result;

        // Calculate TR and DM for all bars
        const trueRanges: number[] = [];
        const plusDM: number[] = [];
        const minusDM: number[] = [];

        for (let i = 1; i < len; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);

            const upMove = highs[i] - highs[i - 1];
            const downMove = lows[i - 1] - lows[i];

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

        if (trueRanges.length < period) return result;

        // Initialize smoothed values
        let smoothedTR = 0;
        let smoothedPlusDM = 0;
        let smoothedMinusDM = 0;

        for (let i = 0; i < period; i++) {
            smoothedTR += trueRanges[i];
            smoothedPlusDM += plusDM[i];
            smoothedMinusDM += minusDM[i];
        }

        // Calculate DX values
        const dxValues: { idx: number; dx: number }[] = [];

        const calcDX = (stR: number, stP: number, stM: number): number | null => {
            const plusDI = (stP / stR) * 100;
            const minusDI = (stM / stR) * 100;
            if (plusDI + minusDI <= 0) return null;
            const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
            return (!isNaN(dx) && isFinite(dx)) ? dx : null;
        };

        // First DX at index period (corresponding to original bar period + 1)
        let dx = calcDX(smoothedTR, smoothedPlusDM, smoothedMinusDM);
        if (dx !== null) {
            dxValues.push({ idx: period, dx });
        }

        // Continue with Wilder's smoothing
        for (let i = period; i < trueRanges.length; i++) {
            smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];
            smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
            smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];

            dx = calcDX(smoothedTR, smoothedPlusDM, smoothedMinusDM);
            if (dx !== null) {
                dxValues.push({ idx: i + 1, dx });
            }
        }

        // Need at least 'period' DX values to calculate ADX
        if (dxValues.length < period) return result;

        // Initialize ADX with first 'period' DX values
        let adxSum = 0;
        for (let i = 0; i < period; i++) {
            adxSum += dxValues[i].dx;
        }
        let adx = adxSum / period;

        // Set ADX for the bar after we have enough DX values
        result[dxValues[period - 1].idx] = adx;

        // Continue smoothing ADX
        for (let i = period; i < dxValues.length; i++) {
            adx = ((adx * (period - 1)) + dxValues[i].dx) / period;
            result[dxValues[i].idx] = adx;
        }

        return result;
    }

    /**
     * Rolling SMA state for O(1) updates
     */
    static initSMAState(period: number): SMARollingState {
        return {
            period,
            buffer: [],
            sum: 0
        };
    }

    /**
     * Update SMA with new price - O(1) complexity
     */
    static updateSMA(state: SMARollingState, price: number): number | null {
        state.buffer.push(price);
        state.sum += price;

        if (state.buffer.length > state.period) {
            state.sum -= state.buffer.shift()!;
        }

        if (state.buffer.length === state.period) {
            return state.sum / state.period;
        }
        return null;
    }

    /**
     * Calculate all ATR (Average True Range) values for entire dataset - O(n)
     * Uses Wilder's smoothing method (same as ADX)
     * 
     * @param highs - Array of high prices
     * @param lows - Array of low prices
     * @param closes - Array of close prices
     * @param period - ATR period (default 14)
     * @returns Array of ATR values for each bar, null if not enough data
     */
    static calculateAllATR(
        highs: number[],
        lows: number[],
        closes: number[],
        period: number = 14
    ): (number | null)[] {
        const len = highs.length;
        const result: (number | null)[] = new Array(len).fill(null);

        if (len < period + 1) return result;

        // Calculate True Range for each bar
        const trueRanges: number[] = [];
        for (let i = 1; i < len; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        if (trueRanges.length < period) return result;

        // First ATR is simple average of first 'period' TR values
        let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
        result[period] = atr; // First ATR at index 'period'

        // Continue with Wilder's smoothing: ATR = ((prev ATR * (period-1)) + current TR) / period
        for (let i = period; i < trueRanges.length; i++) {
            atr = ((atr * (period - 1)) + trueRanges[i]) / period;
            result[i + 1] = atr; // +1 because TR array is offset by 1
        }

        return result;
    }

    /**
     * Calculate all RSI values for entire dataset in a single pass - O(n)
     * Uses Wilder's smoothing method for accurate RSI calculation
     * 
     * @param prices - Array of close prices
     * @param period - RSI period (default 14, commonly 7 for scalping)
     * @returns Array of RSI values (0-100) for each bar, null if not enough data
     */
    static calculateAllRSIs(prices: number[], period: number = 14): (number | null)[] {
        const result: (number | null)[] = new Array(prices.length).fill(null);
        if (prices.length < period + 1) return result;

        // Calculate price changes
        const changes: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }

        // Separate gains and losses
        const gains = changes.map(c => c > 0 ? c : 0);
        const losses = changes.map(c => c < 0 ? -c : 0);

        // First average - simple average of first 'period' values
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

        // First RSI value (at index 'period' in original prices)
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        let rsi = 100 - (100 / (1 + rs));
        result[period] = rsi;

        // Continue with Wilder's smoothing: avgGain = (prevAvgGain * (period-1) + currentGain) / period
        for (let i = period; i < changes.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

            rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
            result[i + 1] = rsi; // +1 because changes array is offset by 1
        }

        return result;
    }

    /**
     * Calculate RSI for the latest bar only (for live trading)
     */
    static calculateRSI(prices: number[], period: number = 14): number | null {
        const allRSIs = this.calculateAllRSIs(prices, period);
        return allRSIs[allRSIs.length - 1];
    }
}

/**
 * State object for rolling ADX calculation
 */
export interface ADXRollingState {
    period: number;
    barCount: number;
    prevHigh: number;
    prevLow: number;
    prevClose: number;
    smoothedTR: number;
    smoothedPlusDM: number;
    smoothedMinusDM: number;
    adx: number;
    dxBuffer: number[];
    trBuffer: number[];
    plusDMBuffer: number[];
    minusDMBuffer: number[];
    initialized: boolean;
    adxInitialized: boolean;
}

/**
 * State object for rolling SMA calculation
 */
export interface SMARollingState {
    period: number;
    buffer: number[];
    sum: number;
}
