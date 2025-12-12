# Strategy Architecture

## Overview

This project uses an **isolated strategy architecture** where each trading strategy is self-contained with its own signal generation, analytics, and export format.

## Directory Structure

```
frontend/src/strategies/
├── BaseStrategy.ts              # Interface all strategies implement
├── index.ts                     # Strategy exports
│
└── [StrategyName]/              # One folder per strategy
    ├── index.ts                 # Main strategy class
    ├── types.ts                 # Strategy-specific types
    └── CHANGELOG.md             # Version history (in backtest results)
```

## Creating a New Strategy

### 1. Create Strategy Folder
```
frontend/src/strategies/[NEW_STRATEGY]/
├── index.ts
└── types.ts
```

### 2. Define Types (`types.ts`)
```typescript
import { BaseStrategyConfig } from '../BaseStrategy';

export interface MyStrategyConfig extends BaseStrategyConfig {
    params: {
        // Strategy-specific parameters
    };
}

export interface MyStrategyAnalytics {
    // Strategy-specific analytics
}

export interface MyStrategyExport {
    // Strategy-specific export format
}
```

### 3. Implement Strategy (`index.ts`)
```typescript
import { BaseStrategy, Signal, BaseTrade, BasicMetrics } from '../BaseStrategy';
import { MyStrategyConfig, MyStrategyAnalytics, MyStrategyExport } from './types';

export class MyStrategy implements BaseStrategy<...> {
    readonly name = 'My Strategy';
    readonly version = '1.0.0';
    readonly description = '...';

    getIndicatorNames(): string[] { ... }
    generateSignals(ohlcData, config): Signal[] { ... }
    calculateAnalytics(trades): MyStrategyAnalytics { ... }
    formatExport(trades, metrics, analytics, dateRange): MyStrategyExport { ... }
}
```

### 4. Export in `index.ts`
```typescript
export { MyStrategy } from './[NEW_STRATEGY]';
```

### 5. Add to BacktestingPanel
```typescript
const availableStrategies = [
    {
        id: '...',
        name: 'My Strategy v1.0.0',
        type: 'custom',
        engineConfig: { ... }
    }
];
```

## Key Principles

1. **Isolation**: Each strategy is independent
2. **Own Analytics**: Define only metrics relevant to the strategy
3. **Own Export**: Clean JSON format without unnecessary fields
4. **Shared Utils**: Use `IndicatorCalculator` for common calculations
5. **Versioning**: Track changes in strategy-specific CHANGELOG

## Current Strategies

| Strategy | Type | Version | Status |
|----------|------|---------|--------|
| EMA 3/15 Simple | simple | 1.0.0 | ✅ Active |

## Strategy Types

### `simple` Type
- **Trade Execution:** Signal-based exits only (no SL/TP/trailing stop)
- **Exit Reasons:** Only `Signal` or `MarketClose`
- **Analytics:** Only `hourlyPerformance` (no Monte Carlo, slippage sensitivity)
- **Use Case:** Baseline strategies for filter analysis

### `advanced` Type (future)
- Full SL/TP/trailing stop logic
- All advanced analytics
- Use Case: Production strategies with risk management

## Backtest Results Structure

```
backtest result folder/
└── [StrategyName]/
    ├── CHANGELOG.md              # Version history
    └── results/
        └── backtest_[name]_[version]_[dates].json
```

