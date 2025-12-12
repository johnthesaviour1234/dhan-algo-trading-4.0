/**
 * Base Strategy Interface
 * 
 * All strategies must implement this interface.
 * Each strategy is isolated and defines its own:
 * - Signal generation logic
 * - Analytics to track
 * - Export format
 */

import { CandlestickData } from 'lightweight-charts';

// Basic signal type
export interface Signal {
    time: number;
    type: 'BUY' | 'SELL';
    price: number;
    indicators: Record<string, number | boolean | string>;
}

// Basic trade type
export interface BaseTrade {
    id: string;
    entryDate: string;
    exitDate: string;
    direction: 'Long' | 'Short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    grossPnl: number;
    pnl: number;
    pnlPercent: number;
    duration: string;
    signal: 'Buy' | 'Sell';
    slippage: number;
    costs: TradeCosts;
    indicators: Record<string, number | boolean | string>;
    exitReason: string;
}

// Trade costs breakdown
export interface TradeCosts {
    brokerage: number;
    stt: number;
    transactionCharges: number;
    gst: number;
    sebiCharges: number;
    stampDuty: number;
    totalCost: number;
}

// Basic metrics every strategy needs
export interface BasicMetrics {
    return: number;
    winRate: number;
    lossRate: number;
    totalTrades: number;
    profitFactor: number;
    expectancy: number;
    avgWin: number;
    avgLoss: number;
}

// Strategy configuration base
export interface BaseStrategyConfig {
    name: string;
    version: string;
    direction: 'long' | 'short' | 'both';
    params: Record<string, unknown>;
}

// Strategy interface that all strategies must implement
export interface BaseStrategy<
    TConfig extends BaseStrategyConfig = BaseStrategyConfig,
    TAnalytics = Record<string, unknown>,
    TExport = Record<string, unknown>
> {
    // Strategy metadata
    readonly name: string;
    readonly version: string;
    readonly description: string;

    // Generate trading signals from OHLC data
    generateSignals(ohlcData: CandlestickData[], config: TConfig): Signal[];

    // Get list of indicators this strategy tracks
    getIndicatorNames(): string[];

    // Calculate strategy-specific analytics from trades
    calculateAnalytics(trades: BaseTrade[]): TAnalytics;

    // Format data for export (strategy-specific format)
    formatExport(
        trades: BaseTrade[],
        metrics: BasicMetrics,
        analytics: TAnalytics,
        dateRange: { start: string; end: string }
    ): TExport;
}
