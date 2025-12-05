export interface OHLCCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface StrategyInterface {
    start(initialData: OHLCCandle[]): Promise<void>;
    stop(): void;
    updateWithOHLCData(candles: OHLCCandle[]): void;
    isActive(): boolean;
    getCalculationHistory(): any[];
}
