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
