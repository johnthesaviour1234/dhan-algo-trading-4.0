/**
 * Strategies Index
 * 
 * Export all available strategies from this file.
 */

// Base types and interface
export * from './BaseStrategy';

// EMA 3/15 Simple Strategy
export { EMASimpleStrategy, emaSimpleStrategy } from './EMA_3_15_Simple';
export type { EMASimpleConfig, EMASimpleAnalytics, EMASimpleExport } from './EMA_3_15_Simple/types';

// Multi-TF Breakout Strategy (with Monthly)
export { MultiTFBreakoutStrategy, multiTFBreakoutStrategy } from './Multi_TF_Breakout';
export type { MultiTFBreakoutConfig, MultiTFBreakoutAnalytics, MultiTFBreakoutExport } from './Multi_TF_Breakout/types';

// Multi-TF Breakout WDH Strategy (Weekly/Daily/Hourly - no Monthly)
export { MultiTFBreakoutWDHStrategy, multiTFBreakoutWDHStrategy } from './Multi_TF_Breakout_WDH';
export type { MultiTFBreakoutWDHConfig, MultiTFBreakoutWDHAnalytics, MultiTFBreakoutWDHExport } from './Multi_TF_Breakout_WDH/types';

// Multi-TF Breakout ADX Strategy (M/W/D/H + Daily ADX > 25 filter)
export { MultiTFBreakoutADXStrategy, multiTFBreakoutADXStrategy } from './Multi_TF_Breakout_ADX';
export type { MultiTFBreakoutADXConfig, MultiTFBreakoutADXAnalytics, MultiTFBreakoutADXExport } from './Multi_TF_Breakout_ADX/types';

// Multi-TF Breakout ADX 1H Strategy (M/W/D/H + Hourly ADX > 25 filter)
export { MultiTFBreakoutADX1HStrategy, multiTFBreakoutADX1HStrategy } from './Multi_TF_Breakout_ADX_1H';
export type { MultiTFBreakoutADX1HConfig, MultiTFBreakoutADX1HAnalytics, MultiTFBreakoutADX1HExport } from './Multi_TF_Breakout_ADX_1H/types';

// Multi-TF Breakout WDH ADX Strategy (W/D/H + Daily ADX > 25 filter - NO Monthly)
export { MultiTFBreakoutWDHADXStrategy, multiTFBreakoutWDHADXStrategy } from './Multi_TF_Breakout_WDH_ADX';
export type { MultiTFBreakoutWDHADXConfig, MultiTFBreakoutWDHADXAnalytics, MultiTFBreakoutWDHADXExport } from './Multi_TF_Breakout_WDH_ADX/types';

// Multi-TF Breakout WDH ADX 0.5 Strategy (W/D/H + ADX - 1:0.5 R:R conservative)
export { MultiTFBreakoutWDHADX05Strategy, multiTFBreakoutWDHADX05Strategy } from './Multi_TF_Breakout_WDH_ADX_05';
export type { MultiTFBreakoutWDHADX05Config, MultiTFBreakoutWDHADX05Analytics, MultiTFBreakoutWDHADX05Export } from './Multi_TF_Breakout_WDH_ADX_05/types';

// Multi-TF Breakout ADX 0.5 Strategy (M/W/D/H + Daily ADX - 1:0.5 R:R conservative)
export { MultiTFBreakoutADX05Strategy, multiTFBreakoutADX05Strategy } from './Multi_TF_Breakout_ADX_05';
export type { MultiTFBreakoutADX05Config, MultiTFBreakoutADX05Analytics, MultiTFBreakoutADX05Export } from './Multi_TF_Breakout_ADX_05/types';

// Multi-TF Breakout ADX 1H 0.5 Strategy (M/W/D/H + Hourly ADX - 1:0.5 R:R conservative)
export { MultiTFBreakoutADX1H05Strategy, multiTFBreakoutADX1H05Strategy } from './Multi_TF_Breakout_ADX_1H_05';
export type { MultiTFBreakoutADX1H05Config, MultiTFBreakoutADX1H05Analytics, MultiTFBreakoutADX1H05Export } from './Multi_TF_Breakout_ADX_1H_05/types';

// Multi-TF Breakout WDH ADX 1H Strategy (W/D/H + Hourly ADX > 25 filter - NO Monthly, 1:1 R:R)
export { MultiTFBreakoutWDHADX1HStrategy, multiTFBreakoutWDHADX1HStrategy } from './Multi_TF_Breakout_WDH_ADX_1H';
export type { MultiTFBreakoutWDHADX1HConfig, MultiTFBreakoutWDHADX1HAnalytics, MultiTFBreakoutWDHADX1HExport } from './Multi_TF_Breakout_WDH_ADX_1H/types';

// Multi-TF Breakout WDH ADX 1H 0.5 Strategy (W/D/H + Hourly ADX > 25 filter - NO Monthly, 1:0.5 R:R)
export { MultiTFBreakoutWDHADX1H05Strategy, multiTFBreakoutWDHADX1H05Strategy } from './Multi_TF_Breakout_WDH_ADX_1H_05';
export type { MultiTFBreakoutWDHADX1H05Config, MultiTFBreakoutWDHADX1H05Analytics, MultiTFBreakoutWDHADX1H05Export } from './Multi_TF_Breakout_WDH_ADX_1H_05/types';
