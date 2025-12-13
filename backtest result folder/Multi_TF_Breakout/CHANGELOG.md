# Multi-TF Breakout Strategy

## Strategy Overview
- **Strategy Name:** Multi-TF Breakout
- **Type:** Breakout
- **Direction:** Long only (v1.0.0)
- **Timeframe:** 1-minute candles
- **Architecture:** Isolated strategy

---

## Version History

### v1.0.0 - Initial Implementation
**Date:** 2025-12-13  
**Status:** 🔄 TESTING

#### Entry Conditions
```
LONG when:
- Close > Previous 1H High
- Close > Previous Day High
- Close > Previous Week High
- Close > Previous Month High
- All HTF levels are ready (have valid previous values)
- Setup is reset (pullback occurred after last trade)
```

#### Exit Conditions
```
- Stop Loss: Previous 1H Low
- Take Profit: Entry + (Entry - SL) × R:R Ratio
- Market Close: 14:15 IST
```

#### Configuration
```
Trading Window: 09:15 - 14:15 IST
Risk:Reward Ratio: 1:1
Require Reset: Yes (pullback before re-entry)
```

#### Higher Timeframe Level Tracking
- **1H**: Aggregated from 1-min bars (new hour boundary)
- **Daily**: Day high/low from previous day
- **Weekly**: Week high/low from previous week  
- **Monthly**: Month high/low from previous month

#### Reset Mechanism
After a trade closes, the strategy waits for a pullback (price breaks below any HTF level) before allowing a new entry. This prevents multiple entries in the same breakout move.

---

## Files
| File | Purpose |
|------|---------|
| `strategies/Multi_TF_Breakout/index.ts` | Strategy implementation |
| `strategies/Multi_TF_Breakout/types.ts` | Strategy-specific types |
| `strategies/BaseStrategy.ts` | Interface this strategy implements |
