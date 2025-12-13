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

// Multi-TF Breakout Strategy
export { MultiTFBreakoutStrategy, multiTFBreakoutStrategy } from './Multi_TF_Breakout';
export type { MultiTFBreakoutConfig, MultiTFBreakoutAnalytics, MultiTFBreakoutExport } from './Multi_TF_Breakout/types';
