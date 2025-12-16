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

