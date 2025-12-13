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

### v1.1.0 - ADX Filter
**Date:** 2025-12-12  
**Status:** ✅ TESTED

#### Changes from v1.0.0
- **Added ADX > 25 filter** - Only take BUY signals when ADX > 25
- SELL signals always fire (must exit position)

#### Results (Jan-Jun 2023)
- Trades: 5,066 (down from 5,956)
- Win rate: 0.61%
- Return: -299% (still losing)
- Conclusion: ADX > 25 not enough, need stronger filter

---

### v1.2.0 - Higher ADX Threshold
**Date:** 2025-12-12  
**Status:** ✅ TESTED

#### Changes from v1.1.0
- **Increased ADX threshold to 40** (from 25)

#### Results (Jan-Jun 2023)
- Trades: 4,075 (down from 5,066)
- Win rate: 0.59%
- Return: -240% (still losing)
- Conclusion: ADX filter helps but 735 consecutive losses indicates deeper issue

---

### v1.3.0 - Enhanced Analytics
**Date:** 2025-12-12  
**Status:** ✅ TESTED

#### Purpose
Added comprehensive analytics to understand WHY we're losing:

#### New Analytics
1. **Duration Analysis**
   - Under 1 min trades: win rate, avg PnL
   - 1-5 min trades: win rate, avg PnL
   - Over 5 min trades: win rate, avg PnL

2. **Gross vs Net Analysis**
   - Are we profitable BEFORE costs?
   - Gross win rate vs Net win rate
   - Total costs breakdown

3. **Market Condition Analysis**
   - EMA Gap on winners vs losers
   - Trades with EMA Gap < 0.1% (sideways)
   - Trades with EMA Gap > 0.1% (trending)
   - Win rate in each condition

---

### v1.4.0 - ATR-Based Stop Loss & Target Profit
**Date:** 2025-12-12  
**Status:** ✅ TESTED

#### Key Changes
- **SL** = Entry - (ATR₁₄ × 3), **TP** = Entry + (ATR₁₄ × 3)
- **1:1 Risk:Reward**
- One trade at a time, exits via SL/TP/MarketClose

#### Results (Jan-Jun 2023)
| Metric | Value |
|--------|-------|
| Trades | 186 (↓ from 4,075) |
| Win Rate | 25.27% (↑ from 0.59%) |
| Return | -8.35% (↑ from -240%) |
| Max Consec. Losses | 15 (↓ from 735) |

#### Issues Found
- 63% trades in sideways markets (EMA gap < 0.1%)
- 10:00 AM = worst hour (13.5% win rate)
- ATR×3 too wide → many MarketClose exits

---

### v1.5.0 - Improved Filters & R:R (Current)
**Date:** 2025-12-12  
**Status:** 🔄 TESTING

#### Key Changes
1. **EMA Gap Filter**: Skip when |EMA Gap| < 0.1% (sideways)
2. **Time Filter**: Skip 09:45-10:15 (gap reversal zone)
3. **Tighter SL**: ATR × 2 (was ×3)
4. **Wider TP**: ATR × 4 (was ×3) → **1:2 R:R**
5. **Max Hold Time**: 60 min forced exit

#### Configuration
```
SL = Entry - (ATR₁₄ × 2)
TP = Entry + (ATR₁₄ × 4)
minEmaGap = 0.1%
skipTime = 09:45-10:15
maxHoldMinutes = 60
```

#### Expected Impact
- Fewer trades (filtered sideways + 10AM)
- Better win rate (trending markets only)
- Better R:R (1:2 instead of 1:1)

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
