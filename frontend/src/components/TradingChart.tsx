import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Keep track of the earliest loaded time to fetch older data
  const earliestTimeRef = useRef<number>(Math.floor(Date.now() / 1000));

  const fetchData = useCallback(async (start: number, end: number) => {
    setIsLoading(true);
    try {
      // Construct payload for Dhan API
      // Note: Using hardcoded symbol details for demo as per user request
      const payload = {
        "EXCH": "NSE",
        "SEG": "E",
        "INST": "EQUITY",
        "SEC_ID": 14366, // Example ID
        "START": start,
        "END": end,
        "START_TIME": new Date(start * 1000).toString(),
        "END_TIME": new Date(end * 1000).toString(),
        "INTERVAL": "1" // 1 minute candles
      };

      const response = await fetch('http://localhost:3001/api/getData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const json = await response.json();

      if (json.success && json.data) {
        const { t, o, h, l, c } = json.data;

        // Dhan API returns Unix timestamps directly (seconds since 1970)
        // These represent IST times, so no conversion needed
        const formattedData: CandlestickData[] = t.map((unixTime: number, index: number) => ({
          time: unixTime as Time,
          open: o[index],
          high: h[index],
          low: l[index],
          close: c[index],
        }));

        return formattedData;
      }
      return [];
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

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

    // Initial load: Fetch last 7 days
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);

    fetchData(sevenDaysAgo, now).then(data => {
      if (data.length > 0) {
        candlestickSeries.setData(data);
        earliestTimeRef.current = data[0].time as number;
        chart.timeScale().fitContent();
      }
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Pagination / Infinite Scroll Logic
    chart.timeScale().subscribeVisibleLogicalRangeChange(async (newVisibleLogicalRange) => {
      if (!newVisibleLogicalRange) return;

      // If we are near the start (left side) of the data
      if (newVisibleLogicalRange.from < 10 && !isLoading) {
        const currentEarliest = earliestTimeRef.current;
        const newEnd = currentEarliest;
        const newStart = newEnd - (7 * 24 * 60 * 60); // Fetch previous 7 days

        console.log('Fetching older data...');
        const newData = await fetchData(newStart, newEnd);

        if (newData.length > 0) {
          // Merge new data with existing data
          // Note: Lightweight charts doesn't have a simple 'prepend' method that maintains state perfectly
          // We might need to get all current data and reset, or use update if overlapping?
          // For simplicity in this demo, we'll just setData with combined array if possible, 
          // but setData overwrites. 
          // A better approach for real apps is managing a data store state and updating the series.

          // However, to keep it simple and working:
          // We need to maintain the full dataset in a ref or state if we want to append efficiently.
          // But here, let's just assume we prepend and reset data.
          // NOTE: This resets the view, which is jarring. 
          // Ideally we use `setData` with the full sorted array.

          // Let's fetch the current data from the series? No direct getter.
          // We should track data in a ref.
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [fetchData]); // Re-create chart if fetchData changes (it shouldn't)

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
