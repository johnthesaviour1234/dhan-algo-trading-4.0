# EMA 3/15 Simple Crossover Strategy

## Strategy Overview
- **Strategy Name:** EMA 3/15 Simple Crossover
- **Type:** Trend-following (pure crossover)
- **Direction:** Long only
- **Timeframe:** 1-minute candles
- **Symbol:** RELIANCE (NSE)
- **Architecture:** Isolated strategy (see `frontend/src/strategies/README.md`)

---

## Version History

### v1.0.0 - Baseline (Current)
**Date:** 2025-12-11  
**Status:** 🔄 TESTING

#### Configuration
```
Fast EMA: 3
Slow EMA: 15
Stop Loss: None (pure crossover)
Target: None (exit on reverse crossover)
```

#### Entry Conditions
```
BUY when: EMA 3 crosses ABOVE EMA 15
```

#### Exit Conditions
```
SELL when: EMA 3 crosses BELOW EMA 15
```

#### Development Analytics Tracked
- EMA Gap % (distance between EMAs)
- ADX for trend strength context
- RSI (14) for momentum context
- Entry Hour & Day of Week
- Price distance from EMA 3
- Bars since last crossover

---

## Architecture Notes (2025-12-12)

### v1.0.1 - Pure Signal-Based Exits
**Date:** 2025-12-12  
**Status:** ✅ ACTIVE

#### Changes
- **New `simulateSimpleTrades` method** in BacktestEngine
- **No SL/TP/trailing stop** - purely signal-based exits
- **Exit Reasons:** Only `Signal` or `MarketClose` (2:30 PM)
- **Simplified Analytics:** Only `hourlyPerformance` in export
- **Removed:** Monte Carlo, slippage sensitivity, profit distribution

#### Why This Matters
Previous version had hidden SL/TP logic (default 0.5% target) affecting results.
Now: Entry on BUY signal, exit ONLY on SELL signal or market close.
This gives accurate baseline data for analysis.

---

This strategy was **refactored to isolated architecture**:

### Files
| File | Purpose |
|------|---------|
| `strategies/EMA_3_15_Simple/index.ts` | Strategy implementation |
| `strategies/EMA_3_15_Simple/types.ts` | Strategy-specific types |
| `strategies/BaseStrategy.ts` | Interface this strategy implements |

### Key Features
1. **Own signal generation** - `generateSignals()` method
2. **Own analytics** - Hourly perf, day-of-week, EMA gap analysis, RSI analysis
3. **Own export format** - Clean JSON without SL/TP fields

### Legacy Code Removed
- Old shared strategies deleted from `strategies/` folder
- All old strategies removed from `BacktestingPanel.tsx`
- Only this strategy remains as the baseline

---

## Walk-Forward Schedule

| Phase | Date Range | Purpose | Version | Status |
|-------|------------|---------|---------|--------|
| Training 1 | Jan-Jun 2023 | Baseline analysis | v1.0.0 | 🔄 Active |
| Analysis | - | Identify winning patterns | - | ⏳ Waiting |
| Training 2 | Jan-Jun 2023 | Add filters | v1.1.0 | ⏳ Waiting |
| Validation 1 | Jul-Dec 2023 | Validate v1.1.0 | v1.1.0 | ⏳ Waiting |

---

## Development Guidelines
1. Start with pure baseline - no filters
2. Analyze which indicators correlate with winners
3. Add ONE filter at a time based on data
4. Document expected vs actual impact
5. Only proceed to validation after improvement confirmed
6. Follow `strategies/README.md` for architecture patterns
