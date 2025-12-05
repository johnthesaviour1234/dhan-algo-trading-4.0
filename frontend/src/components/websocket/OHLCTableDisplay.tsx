import { CandlestickData } from 'lightweight-charts';
import { OHLCCandle } from '../../utils/RealtimeAggregator';

interface OHLCTableDisplayProps {
    historicalData: CandlestickData[];
    liveCandle: OHLCCandle | null;
}

export function OHLCTableDisplay({ historicalData, liveCandle }: OHLCTableDisplayProps) {
    // Merge historical and live data
    const mergedData = React.useMemo(() => {
        const historical = historicalData.map(bar => ({
            time: bar.time as number,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume || 0 // Preserve volume if exists, fallback to 0
        }));

        // If we have a live candle, check if it's newer than the last historical candle
        if (liveCandle) {
            const lastHistoricalTime = historical.length > 0
                ? historical[historical.length - 1].time
                : 0;

            // Only add live candle if it's newer or update if same time
            if (liveCandle.time > lastHistoricalTime) {
                return [...historical, liveCandle];
            } else if (liveCandle.time === lastHistoricalTime) {
                // Update last candle with live data
                const updated = [...historical];
                updated[updated.length - 1] = liveCandle;
                return updated;
            }
        }

        return historical;
    }, [historicalData, liveCandle]);

    // Sort newest first and take last 50 candles
    const displayData = React.useMemo(() => {
        return [...mergedData]
            .sort((a, b) => b.time - a.time)
            .slice(0, 50);
    }, [mergedData]);

    // Format timestamp for display
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    // Format date for display
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short'
        });
    };

    // Format number with 2 decimal places
    const formatPrice = (price: number) => {
        return price.toFixed(2);
    };

    // Format volume
    const formatVolume = (volume: number) => {
        if (volume === 0) return '-';
        if (volume > 1000000) return `${(volume / 1000000).toFixed(2)}M`;
        if (volume > 1000) return `${(volume / 1000).toFixed(1)}K`;
        return volume.toString();
    };

    // Check if candle is live (within last 60 seconds)
    const isLiveCandle = (timestamp: number) => {
        if (!liveCandle) return false;
        return timestamp === liveCandle.time;
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <h3 className="text-sm font-medium text-gray-900">
                        1-Minute OHLC Data (Historical + Live)
                    </h3>
                    <span className="text-xs text-gray-500">
                        Last 50 candles
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className="border-b border-gray-200">
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Time
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Open
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                High
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Low
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Close
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Vol
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    No data available
                                </td>
                            </tr>
                        ) : (
                            displayData.map((candle, index) => {
                                const isLive = isLiveCandle(candle.time);
                                const rowClass = isLive
                                    ? 'bg-green-50 hover:bg-green-100'
                                    : index % 2 === 0
                                        ? 'bg-white hover:bg-gray-50'
                                        : 'bg-gray-50 hover:bg-gray-100';

                                return (
                                    <tr key={candle.time} className={rowClass}>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {isLive && (
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {formatTime(candle.time)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {formatDate(candle.time)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap text-gray-900">
                                            {formatPrice(candle.open)}
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap text-green-600 font-medium">
                                            {formatPrice(candle.high)}
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap text-red-600 font-medium">
                                            {formatPrice(candle.low)}
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <span className={`font-medium ${candle.close >= candle.open
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                                }`}>
                                                {formatPrice(candle.close)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap text-gray-600">
                                            {formatVolume(candle.volume)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                    {mergedData.length} total candles • Updates every minute
                </p>
            </div>
        </div>
    );
}

// Import React at the top
import React from 'react';
