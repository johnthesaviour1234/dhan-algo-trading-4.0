/**
 * Candlestick Pattern Detection
 * 
 * Detects common candlestick patterns for entry/exit signals.
 * Returns pattern name for UI display.
 */

export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface PatternResult {
    pattern: string;
    type: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 1-3 (weak to strong)
}

export class CandlestickPatterns {
    /**
     * Detect bullish patterns
     * Returns the pattern name or null if no pattern found
     */
    static detectBullishPattern(candles: CandleData[]): PatternResult | null {
        if (candles.length < 3) return null;

        const current = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const prevPrev = candles.length >= 3 ? candles[candles.length - 3] : null;

        // Check patterns in order of strength

        // 1. Bullish Engulfing (strength: 3)
        if (this.isBullishEngulfing(current, prev)) {
            return { pattern: 'Bullish Engulfing', type: 'bullish', strength: 3 };
        }

        // 2. Morning Star (strength: 3)
        if (prevPrev && this.isMorningStar(current, prev, prevPrev)) {
            return { pattern: 'Morning Star', type: 'bullish', strength: 3 };
        }

        // 3. Piercing Line (strength: 2)
        if (this.isPiercingLine(current, prev)) {
            return { pattern: 'Piercing Line', type: 'bullish', strength: 2 };
        }

        // 4. Hammer (strength: 2)
        if (this.isHammer(current)) {
            return { pattern: 'Hammer', type: 'bullish', strength: 2 };
        }

        // 5. Bullish Harami (strength: 1)
        if (this.isBullishHarami(current, prev)) {
            return { pattern: 'Bullish Harami', type: 'bullish', strength: 1 };
        }

        return null;
    }

    /**
     * Detect bearish patterns
     * Returns the pattern name or null if no pattern found
     */
    static detectBearishPattern(candles: CandleData[]): PatternResult | null {
        if (candles.length < 3) return null;

        const current = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const prevPrev = candles.length >= 3 ? candles[candles.length - 3] : null;

        // 1. Bearish Engulfing (strength: 3)
        if (this.isBearishEngulfing(current, prev)) {
            return { pattern: 'Bearish Engulfing', type: 'bearish', strength: 3 };
        }

        // 2. Evening Star (strength: 3)
        if (prevPrev && this.isEveningStar(current, prev, prevPrev)) {
            return { pattern: 'Evening Star', type: 'bearish', strength: 3 };
        }

        // 3. Dark Cloud Cover (strength: 2)
        if (this.isDarkCloudCover(current, prev)) {
            return { pattern: 'Dark Cloud Cover', type: 'bearish', strength: 2 };
        }

        // 4. Shooting Star (strength: 2)
        if (this.isShootingStar(current)) {
            return { pattern: 'Shooting Star', type: 'bearish', strength: 2 };
        }

        // 5. Bearish Harami (strength: 1)
        if (this.isBearishHarami(current, prev)) {
            return { pattern: 'Bearish Harami', type: 'bearish', strength: 1 };
        }

        return null;
    }

    // ===== Individual Pattern Detection =====

    /**
     * Hammer: Small body at top, long lower shadow (2x body), little/no upper shadow
     * Appears in downtrend, signals reversal
     */
    static isHammer(candle: CandleData): boolean {
        const body = Math.abs(candle.close - candle.open);
        const range = candle.high - candle.low;
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);

        if (range === 0) return false;

        const bodyRatio = body / range;
        const lowerShadowRatio = lowerShadow / range;
        const upperShadowRatio = upperShadow / range;

        return (
            bodyRatio < 0.35 &&           // Small body
            lowerShadowRatio > 0.5 &&     // Long lower shadow
            upperShadowRatio < 0.15 &&    // Little upper shadow
            lowerShadow >= body * 2       // Lower shadow at least 2x body
        );
    }

    /**
     * Shooting Star: Small body at bottom, long upper shadow (2x body), little/no lower shadow
     */
    static isShootingStar(candle: CandleData): boolean {
        const body = Math.abs(candle.close - candle.open);
        const range = candle.high - candle.low;
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);

        if (range === 0) return false;

        const bodyRatio = body / range;
        const upperShadowRatio = upperShadow / range;
        const lowerShadowRatio = lowerShadow / range;

        return (
            bodyRatio < 0.35 &&           // Small body
            upperShadowRatio > 0.5 &&     // Long upper shadow
            lowerShadowRatio < 0.15 &&    // Little lower shadow
            upperShadow >= body * 2       // Upper shadow at least 2x body
        );
    }

    /**
     * Bullish Engulfing: Current green candle completely engulfs previous red candle
     */
    static isBullishEngulfing(current: CandleData, prev: CandleData): boolean {
        const currentBullish = current.close > current.open;
        const prevBearish = prev.close < prev.open;

        if (!currentBullish || !prevBearish) return false;

        return (
            current.open <= prev.close &&     // Current opens at or below prev close
            current.close >= prev.open        // Current closes at or above prev open
        );
    }

    /**
     * Bearish Engulfing: Current red candle completely engulfs previous green candle
     */
    static isBearishEngulfing(current: CandleData, prev: CandleData): boolean {
        const currentBearish = current.close < current.open;
        const prevBullish = prev.close > prev.open;

        if (!currentBearish || !prevBullish) return false;

        return (
            current.open >= prev.close &&     // Current opens at or above prev close
            current.close <= prev.open        // Current closes at or below prev open
        );
    }

    /**
     * Morning Star: 3-candle pattern
     * 1. Long red candle
     * 2. Small body (doji-like) that gaps down
     * 3. Long green candle that closes above midpoint of candle 1
     */
    static isMorningStar(current: CandleData, middle: CandleData, first: CandleData): boolean {
        const firstBearish = first.close < first.open;
        const currentBullish = current.close > current.open;

        if (!firstBearish || !currentBullish) return false;

        const firstBody = Math.abs(first.close - first.open);
        const middleBody = Math.abs(middle.close - middle.open);
        const currentBody = Math.abs(current.close - current.open);
        const firstMidpoint = (first.open + first.close) / 2;

        return (
            firstBody > middleBody * 2 &&           // First is long compared to middle
            currentBody > middleBody * 2 &&         // Current is long compared to middle
            middle.high < first.close &&            // Middle gaps down from first
            current.close > firstMidpoint           // Current closes above first's midpoint
        );
    }

    /**
     * Evening Star: 3-candle pattern (opposite of Morning Star)
     */
    static isEveningStar(current: CandleData, middle: CandleData, first: CandleData): boolean {
        const firstBullish = first.close > first.open;
        const currentBearish = current.close < current.open;

        if (!firstBullish || !currentBearish) return false;

        const firstBody = Math.abs(first.close - first.open);
        const middleBody = Math.abs(middle.close - middle.open);
        const currentBody = Math.abs(current.close - current.open);
        const firstMidpoint = (first.open + first.close) / 2;

        return (
            firstBody > middleBody * 2 &&           // First is long compared to middle
            currentBody > middleBody * 2 &&         // Current is long compared to middle
            middle.low > first.close &&             // Middle gaps up from first
            current.close < firstMidpoint           // Current closes below first's midpoint
        );
    }

    /**
     * Piercing Line: 2-candle bullish reversal
     * 1. Long red candle
     * 2. Green candle that opens below prev low and closes above prev midpoint
     */
    static isPiercingLine(current: CandleData, prev: CandleData): boolean {
        const prevBearish = prev.close < prev.open;
        const currentBullish = current.close > current.open;

        if (!prevBearish || !currentBullish) return false;

        const prevMidpoint = (prev.open + prev.close) / 2;
        const prevBody = Math.abs(prev.close - prev.open);
        const currentBody = Math.abs(current.close - current.open);

        return (
            current.open < prev.low &&              // Current opens below prev low
            current.close > prevMidpoint &&         // Current closes above prev midpoint
            current.close < prev.open &&            // But doesn't close above prev open
            currentBody > prevBody * 0.5            // Current body is substantial
        );
    }

    /**
     * Dark Cloud Cover: 2-candle bearish reversal (opposite of Piercing Line)
     */
    static isDarkCloudCover(current: CandleData, prev: CandleData): boolean {
        const prevBullish = prev.close > prev.open;
        const currentBearish = current.close < current.open;

        if (!prevBullish || !currentBearish) return false;

        const prevMidpoint = (prev.open + prev.close) / 2;
        const prevBody = Math.abs(prev.close - prev.open);
        const currentBody = Math.abs(current.close - current.open);

        return (
            current.open > prev.high &&             // Current opens above prev high
            current.close < prevMidpoint &&         // Current closes below prev midpoint
            current.close > prev.open &&            // But doesn't close below prev open
            currentBody > prevBody * 0.5            // Current body is substantial
        );
    }

    /**
     * Bullish Harami: Small green candle within previous large red candle
     */
    static isBullishHarami(current: CandleData, prev: CandleData): boolean {
        const prevBearish = prev.close < prev.open;
        const currentBullish = current.close > current.open;

        if (!prevBearish || !currentBullish) return false;

        return (
            current.open > prev.close &&            // Current opens above prev close
            current.close < prev.open &&            // Current closes below prev open
            current.high < prev.open &&             // Current high below prev open
            current.low > prev.close                // Current low above prev close
        );
    }

    /**
     * Bearish Harami: Small red candle within previous large green candle
     */
    static isBearishHarami(current: CandleData, prev: CandleData): boolean {
        const prevBullish = prev.close > prev.open;
        const currentBearish = current.close < current.open;

        if (!prevBullish || !currentBearish) return false;

        return (
            current.open < prev.close &&            // Current opens below prev close
            current.close > prev.open &&            // Current closes above prev open
            current.high < prev.close &&            // Current high below prev close
            current.low > prev.open                 // Current low above prev open
        );
    }
}
