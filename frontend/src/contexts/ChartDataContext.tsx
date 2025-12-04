import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { CandlestickData } from 'lightweight-charts';
import { ChartDataFetcher } from '../lib/ChartDataFetcher';

interface ChartDataContextValue {
    historicalBars: CandlestickData[];
    setHistoricalBars: (bars: CandlestickData[]) => void;
    dataFetcher: ChartDataFetcher;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    fetchBars: (from: number, to: number) => Promise<CandlestickData[]>;
}

const ChartDataContext = createContext<ChartDataContextValue | null>(null);

export function ChartDataProvider({ children }: { children: React.ReactNode }) {
    const [historicalBars, setHistoricalBars] = useState<CandlestickData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dataFetcherRef = useRef(new ChartDataFetcher());

    // Symbol configuration (hardcoded to Vodafone Idea for now)
    const symbolConfig = {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        segment: 'E',
        secId: 14366,
        interval: '1', // 1 minute
    };

    const fetchBars = useCallback(async (from: number, to: number): Promise<CandlestickData[]> => {
        setIsLoading(true);
        try {
            const bars = await dataFetcherRef.current.getBars(
                symbolConfig.symbol,
                symbolConfig.exchange,
                symbolConfig.segment,
                symbolConfig.secId,
                from,
                to,
                symbolConfig.interval
            );
            return bars;
        } catch (error) {
            console.error('Failed to fetch bars:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    const value: ChartDataContextValue = {
        historicalBars,
        setHistoricalBars,
        dataFetcher: dataFetcherRef.current,
        isLoading,
        setIsLoading,
        fetchBars,
    };

    return (
        <ChartDataContext.Provider value={value}>
            {children}
        </ChartDataContext.Provider>
    );
}

export function useChartData() {
    const context = useContext(ChartDataContext);
    if (!context) {
        throw new Error('useChartData must be used within a ChartDataProvider');
    }
    return context;
}
