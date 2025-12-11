# Multi-Level Trading Filter System

A comprehensive framework for filtering intraday trades using multiple analytical layers. Each "level" acts as a filter gate - signals must pass ALL enabled levels to be valid.

---

## The 10 Levels of Analysis

### Level 1: Price Action (Candlestick Patterns)
Raw price movement and patterns formed by OHLC data.

**Filters:**
- Pattern quality score (strength of pattern)
- Candle body-to-wick ratio
- Pattern confirmation (next candle validation)
- Gap analysis (opening gaps)

---

### Level 2: Volume Analysis
Trading activity/participation level.

**Filters:**
- Volume relative to average (e.g., >1.5x 20-day avg)
- Volume surge detection
- Volume-price divergence
- Cumulative volume analysis

---

### Level 3: Trend Indicators
Direction and strength of the prevailing trend.

**Filters:**
- EMA crossovers (9/21, 20/50)
- Price position relative to EMAs
- ADX (trend strength) threshold
- Supertrend direction

---

### Level 4: Momentum Indicators
Speed of price movement and overbought/oversold conditions.

**Filters:**
- RSI levels (not too extreme, e.g., 30-70 for entries)
- MACD signal line crossovers
- Stochastic oscillator zones
- Rate of Change (ROC)

---

### Level 5: Volatility
Market uncertainty and expected price ranges.

**Filters:**
- ATR (Average True Range) thresholds
- Bollinger Band squeeze/expansion
- VIX/implied volatility levels
- Historical vs realized volatility

---

### Level 6: Support/Resistance & Structure
Key price levels and market structure.

**Filters:**
- Proximity to S/R levels
- Breakout confirmation
- Pivot points (daily/weekly)
- Fibonacci retracement levels

---

### Level 7: Market Depth/Order Flow
Underlying buying/selling pressure.

**Filters:**
- Bid-ask spread thresholds
- Order imbalance ratio
- Large order detection
- Tape reading signals

---

### Level 8: Time-Based Filters
Session timing and temporal patterns.

**Filters:**
- Trading hours (9:30 AM - 2:30 PM)
- Avoid first 15-30 min volatility
- Day of week patterns
- Event avoidance (earnings, news)

---

### Level 9: Sector/Market Context
Broader market conditions.

**Filters:**
- Index trend alignment (Nifty/Bank Nifty)
- Sector rotation strength
- Market breadth (advance/decline)
- Correlation with benchmark

---

### Level 10: Risk Management Meta-Level
Position sizing and trade quality.

**Filters:**
- Risk-reward ratio minimum (e.g., 1:2)
- Maximum trades per day
- Position sizing based on volatility
- Drawdown limits

---

## Filter Pipeline Architecture

```
Signal → [Level 1] → [Level 2] → [Level 3] → ... → [Level N] → Execute Trade
            ↓            ↓            ↓                ↓
          PASS?        PASS?        PASS?            PASS?
            │            │            │                │
            └── FAIL ────┴── FAIL ───┴──── FAIL ──────┘
                              ↓
                        REJECT TRADE
```

---

## Implementation Interface

```typescript
interface TradingLevel {
  name: string;
  enabled: boolean;
  config: LevelConfig;
  evaluate(data: MarketData): LevelResult;
}

interface LevelResult {
  passed: boolean;
  score: number;        // 0-100 quality score
  reason: string;       // Why it passed/failed
  details: object;      // Level-specific data
}
```

---

## Level Configuration Examples

```typescript
// Level 2: Volume Configuration
const volumeConfig = {
  enabled: true,
  filters: {
    minVolumeMultiplier: 1.5,
    averagePeriod: 20,
    requireVolumeSpike: true,
    spikeThreshold: 2.0
  }
};

// Level 3: Trend Configuration  
const trendConfig = {
  enabled: true,
  filters: {
    fastEMA: 9,
    slowEMA: 21,
    requirePriceAboveEMA: true,
    minADX: 20
  }
};
```

---

## Pipeline Execution

```typescript
class TradingPipeline {
  levels: TradingLevel[] = [];
  
  evaluateSignal(signal: CandlestickSignal, data: MarketData): TradeDecision {
    let totalScore = 0;
    let results: LevelResult[] = [];
    
    for (const level of this.levels) {
      if (!level.enabled) continue;
      
      const result = level.evaluate(data);
      results.push(result);
      
      if (!result.passed) {
        return {
          execute: false,
          rejectedBy: level.name,
          reason: result.reason,
          allResults: results
        };
      }
      
      totalScore += result.score;
    }
    
    return {
      execute: true,
      qualityScore: totalScore / results.length,
      allResults: results
    };
  }
}
```

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                              │
├──────────────────────────────────────────────────────────────────┤
│  WebSocket Feed          Historical API           Index Data      │
│  (Real-time OHLCV)       (Past candles)          (Nifty/BankNifty)│
└──────────┬───────────────────┬─────────────────────┬─────────────┘
           │                   │                     │
           ▼                   ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA AGGREGATOR                              │
│  - Current candle                                                 │
│  - Last N candles (for indicators)                                │
│  - Volume history                                                 │
│  - Pre-computed indicators (EMA, RSI, ATR, etc.)                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      SIGNAL DETECTOR                              │
│  Candlestick Pattern Recognition                                  │
│  Output: { pattern: "BULLISH_ENGULFING", direction: "LONG" }      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FILTER PIPELINE                              │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Volume  │→ │  Trend  │→ │Momentum │→ │Volatility│→ │  Time   │ │
│  │ Filter  │  │ Filter  │  │ Filter  │  │ Filter  │  │ Filter  │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘ │
│       │            │            │            │            │      │
│    PASS/FAIL    PASS/FAIL    PASS/FAIL    PASS/FAIL    PASS/FAIL │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      TRADE DECISION                               │
│  If ALL filters pass → Execute trade                              │
│  If ANY filter fails → Log rejection, skip trade                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Trade Quality Scoring

Each level contributes a quality score (0-100):

```typescript
function scoreVolume(currentVolume: number, avgVolume: number): LevelResult {
  const ratio = currentVolume / avgVolume;
  
  if (ratio < 1.0) return { passed: false, score: 0, reason: "Below average volume" };
  if (ratio < 1.5) return { passed: true, score: 50, reason: "Moderate volume" };
  if (ratio < 2.0) return { passed: true, score: 75, reason: "Good volume" };
  return { passed: true, score: 100, reason: "Excellent volume surge" };
}
```

| Quality Score | Trade Classification |
|---------------|---------------------|
| 80-100 | A-Grade (High conviction) |
| 60-79 | B-Grade (Normal trade) |
| 40-59 | C-Grade (Consider skipping) |
| <40 | Reject |

---

## Implementation Phases

### Phase 1: Foundation (Easy)
| Level | Status | Effort |
|-------|--------|--------|
| L1: Candlestick | ✅ Exists | Done |
| L8: Time Filter | ✅ Exists | Done |
| L2: Volume | 🟡 Pending | Easy |
| L3: Trend (EMA) | 🟡 Pending | Easy |

### Phase 2: Momentum & Volatility (Medium)
| Level | Status | Effort |
|-------|--------|--------|
| L4: RSI/MACD | 🟡 Pending | Medium |
| L5: ATR/Bollinger | 🟡 Pending | Medium |

### Phase 3: Advanced (Complex)
| Level | Status | Effort |
|-------|--------|--------|
| L6: Support/Resistance | 🔴 Pending | Complex |
| L9: Market Context | 🔴 Pending | Complex |
| L7: Order Flow | 🔴 Pending | Very Complex |

---

## Implementation Priority

| Level | Data Required | Recommendation |
|-------|--------------|----------------|
| L1: Candlestick | OHLC | ✅ Already done |
| L2: Volume | Volume | Start here |
| L3: Trend | OHLC (for EMAs) | High priority |
| L4: Momentum | OHLC | Next after trend |
| L5: Volatility | OHLC (for ATR) | Important |
| L6: Structure | Historical OHLC | Medium priority |
| L7: Order Flow | Market Depth (L2) | Advanced |
| L8: Time | Timestamp | ✅ Already done |
| L9: Market Context | Index data | Requires additional data |
| L10: Risk Mgmt | Trade parameters | Always active |

---

## Key Benefits

1. **Modular** - Enable/disable any level independently
2. **Tunable** - Adjust thresholds without code changes
3. **Transparent** - Know exactly why a trade was taken/rejected
4. **Scorable** - Quantify trade quality for analysis
5. **Backtestable** - Test different filter combinations
6. **Extensible** - Add new levels easily

---

*Document created: 2025-12-10*
