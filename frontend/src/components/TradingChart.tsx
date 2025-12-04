import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { useChartData } from '../contexts/ChartDataContext';

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use shared chart data context
  const { historicalBars, setHistoricalBars, dataFetcher } = useChartData();

  // Track earliest loaded time
  const earliestTimeRef = useRef<number>(Math.floor(Date.now() / 1000));

  // Symbol configuration
  const symbolConfig = {
    symbol: 'RELIANCE',
    exchange: 'NSE',
    segment: 'E',
    secId: 14366,
    interval: '1', // 1 minute
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          // Format x-axis labels in IST
          const date = new Date((time as number) * 1000);
          const options: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          };
          return date.toLocaleTimeString('en-IN', options);
        },
      },
      localization: {
        timeFormatter: (time: Time) => {
          // Format hover tooltip in IST with full date/time
          const date = new Date((time as number) * 1000);
          return date.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        },
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    seriesRef.current = candlestickSeries;

    // Initial load using getBars (will fetch minimum 7 days)
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const now = Math.floor(Date.now() / 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60);

        const bars = await dataFetcher.getBars(
          symbolConfig.symbol,
          symbolConfig.exchange,
          symbolConfig.segment,
          symbolConfig.secId,
          sevenDaysAgo,
          now,
          symbolConfig.interval
        );

        if (bars.length > 0) {
          candlestickSeries.setData(bars);
          setHistoricalBars(bars);
          earliestTimeRef.current = bars[0].time as number;
          chart.timeScale().fitContent();
          console.log(`📊 Initial load: ${bars.length} bars`);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Panning logic: Fetch older data when scrolling left
    let isFetching = false;

    chart.timeScale().subscribeVisibleLogicalRangeChange(async (newVisibleLogicalRange) => {
      if (!newVisibleLogicalRange || isFetching) return;

      // Check if we're viewing data near the start
      if (newVisibleLogicalRange.from < 50) {
        isFetching = true;
        setIsLoading(true);

        try {
          const currentEarliest = earliestTimeRef.current;
          const newEnd = currentEarliest;
          const newStart = newEnd - (7 * 24 * 60 * 60); // Fetch previous 7 days

          console.log('⬅️  Panning left - fetching older data...');

          const olderBars = await dataFetcher.getBars(
            symbolConfig.symbol,
            symbolConfig.exchange,
            symbolConfig.segment,
            symbolConfig.secId,
            newStart,
            newEnd,
            symbolConfig.interval
          );

          if (olderBars.length > 0) {
            // Merge older data with existing data
            // Remove any overlap (bars with same timestamp)
            const lastOldTime = olderBars[olderBars.length - 1].time as number;
            const filteredCurrent = historicalBars.filter(
              (bar: CandlestickData) => (bar.time as number) > lastOldTime
            );

            const combinedBars = [...olderBars, ...filteredCurrent];

            // Update chart with merged data
            candlestickSeries.setData(combinedBars);
            setHistoricalBars(combinedBars);
            earliestTimeRef.current = olderBars[0].time as number;

            console.log(`✅ Extended history by ${olderBars.length} bars (total: ${combinedBars.length})`);
          } else {
            console.log('📭 No older data available');
          }
        } catch (error) {
          console.error('❌ Error fetching older data:', error);
        } finally {
          setIsLoading(false);
          isFetching = false;
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []); // No dependencies - runs once on mount

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-gray-900">Chart</h2>
          <p className="text-gray-600">Historical Price Data (Dhan Integration)</p>
        </div>
        {isLoading && <div className="text-sm text-blue-600">Loading data...</div>}
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
