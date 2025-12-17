/**
 * Equity Curve Component
 * 
 * Displays a line chart showing equity progression over time during backtest.
 * Uses lightweight-charts for a clean, interactive visualization.
 */

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, ColorType } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';

interface EquityCurveProps {
    data: { time: number; value: number }[];
    initialCapital: number;
    height?: number;
}

export function EquityCurve({ data, initialCapital, height = 200 }: EquityCurveProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#6B7280',
            },
            grid: {
                vertLines: { color: 'rgba(0, 0, 0, 0.05)' },
                horzLines: { color: 'rgba(0, 0, 0, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            rightPriceScale: {
                borderColor: '#E5E7EB',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: '#E5E7EB',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: 1, // Normal
            },
        });

        chartRef.current = chart;

        // Add line series for equity
        const lineSeries = chart.addLineSeries({
            color: '#10B981', // Green for positive
            lineWidth: 2,
            priceFormat: {
                type: 'custom',
                formatter: (price: number) => `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            },
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
        });

        seriesRef.current = lineSeries;

        // Prepare data - add initial capital as first point
        const chartData: LineData[] = [
            { time: data[0]?.time - 86400 || 0, value: initialCapital },
            ...data.map(d => ({
                time: d.time as number,
                value: d.value,
            }))
        ].sort((a, b) => (a.time as number) - (b.time as number));

        // Determine color based on final equity
        const finalEquity = data[data.length - 1]?.value || initialCapital;
        const isProfit = finalEquity >= initialCapital;
        lineSeries.applyOptions({
            color: isProfit ? '#10B981' : '#EF4444', // Green for profit, Red for loss
        });

        lineSeries.setData(chartData);
        chart.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, initialCapital, height]);

    if (data.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No equity data available</p>
            </div>
        );
    }

    // Calculate stats
    const finalEquity = data[data.length - 1]?.value || initialCapital;
    const totalReturn = finalEquity - initialCapital;
    const returnPercent = ((finalEquity - initialCapital) / initialCapital) * 100;
    const maxEquity = Math.max(...data.map(d => d.value), initialCapital);
    const minEquity = Math.min(...data.map(d => d.value), initialCapital);
    const maxDrawdown = ((maxEquity - minEquity) / maxEquity) * 100;

    return (
        <div className="space-y-3">
            {/* Stats Row */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-gray-500">Initial:</span>{' '}
                        <span className="font-medium">₹{initialCapital.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Final:</span>{' '}
                        <span className={`font-medium ${finalEquity >= initialCapital ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{finalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">Return:</span>{' '}
                        <span className={`font-medium ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalReturn >= 0 ? '+' : ''}₹{totalReturn.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            {' '}({returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-gray-500">Peak:</span>{' '}
                        <span className="font-medium text-blue-600">₹{maxEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Max DD:</span>{' '}
                        <span className="font-medium text-orange-600">{maxDrawdown.toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div
                ref={chartContainerRef}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden"
                style={{ height: `${height}px` }}
            />
        </div>
    );
}
