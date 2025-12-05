import { Radio } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { LTPDisplay } from './websocket/LTPDisplay';
import { MarketDepthDisplay } from './websocket/MarketDepthDisplay';
import { OHLCDisplay } from './websocket/OHLCDisplay';
import { QuoteDisplay } from './websocket/QuoteDisplay';
import { TopBidAskDisplay } from './websocket/TopBidAskDisplay';
import { PrevCloseOIDisplay } from './websocket/PrevCloseOIDisplay';
import { CircuitLimitsDisplay } from './websocket/CircuitLimitsDisplay';
import { WeekHighLowDisplay } from './websocket/WeekHighLowDisplay';
import { OHLCTableDisplay } from './websocket/OHLCTableDisplay';
import { RealtimeAggregator } from '../utils/RealtimeAggregator';
import { useChartData } from '../contexts/ChartDataContext';
import { useRef, useEffect } from 'react';
import { CandlestickData, Time } from 'lightweight-charts';

// Interface definitions based on Dhan WebSocket protocol
export interface LTPData {
  exchange: string;
  securityId: string;
  symbol: string;
  ltq: number;
  ltp: number;
  volume: number;
  atp: number;
  oi: number;
  timestamp: string;
  change: number;
  changePer: number;
}

export interface MarketDepthData {
  exchange: string;
  securityId: string;
  symbol: string;
  bids: Array<{ price: number; volume: number; orders: number }>;
  asks: Array<{ price: number; volume: number; orders: number }>;
  totalBuy: number;
  totalSell: number;
}

export interface OHLCData {
  exchange: string;
  securityId: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface QuoteData {
  exchange: string;
  securityId: string;
  symbol: string;
  ltp: number;
  open: number;
  prevClose: number;
  high: number;
  low: number;
  change: number;
  changePer: number;
  timestamp: string;
}

export interface TopBidAskData {
  exchange: string;
  securityId: string;
  symbol: string;
  totalSell: number;
  totalBuy: number;
  sellQtyAtBest: number;
  buyQtyAtBest: number;
  bestBuyPrice: number;
  bestAskPrice: number;
  totalBuyPer: number;
  totalSellPer: number;
}

export interface PrevCloseOIData {
  exchange: string;
  securityId: string;
  symbol: string;
  prevClose: number;
  prevOI: number;
  currentOI: number;
  oiChange: number;
  oiPerChange: number;
}

export interface CircuitLimitData {
  exchange: string;
  securityId: string;
  symbol: string;
  upperLimit: number;
  lowerLimit: number;
  currentPrice: number;
}

export interface WeekHighLowData {
  exchange: string;
  securityId: string;
  symbol: string;
  weekHigh52: number;
  weekLow52: number;
  currentPrice: number;
}

export function WebSocketDataPanel() {
  // Use real WebSocket hook instead of mock data
  const {
    isConnected,
    ltpData,
    marketDepth,
    ohlcData,
    quoteData,
    topBidAsk,
    prevCloseOI,
    circuitLimits,
    weekHighLow,
    error
  } = useWebSocket();

  // Get historical chart data and live candle from context
  const { historicalBars, setHistoricalBars, liveCandle, setLiveCandle } = useChartData();

  // Initialize aggregator for real-time 1-min candles
  const aggregatorRef = useRef(new RealtimeAggregator());

  // Track previous candle time to detect minute boundary changes
  const prevCandleTimeRef = useRef<number | null>(null);

  // Process LTP updates through aggregator
  useEffect(() => {
    if (ltpData) {
      console.log('🔄 Processing LTP update for OHLC aggregation:', {
        ltp: ltpData.ltp,
        volume: ltpData.volume,
        timestamp: ltpData.timestamp,
        timestampYear: new Date(ltpData.timestamp).getFullYear() // Should be 2025 now!
      });

      const symbol = ltpData.securityId; // Use security ID as symbol

      // Now using corrected timestamp from Dhan (1980 epoch conversion applied)
      const candle = aggregatorRef.current.processTick(
        symbol,
        ltpData.ltp,
        ltpData.volume,
        ltpData.timestamp // Use message timestamp (now corrected!)
      );

      console.log('📊 Generated live candle:', {
        ...candle,
        timeISO: new Date(candle.time * 1000).toISOString()
      });

      // DETECT MINUTE BOUNDARY CHANGE
      if (prevCandleTimeRef.current !== null &&
        candle.time !== prevCandleTimeRef.current &&
        liveCandle) {

        // Save the COMPLETED candle to historical data
        const completedCandle: CandlestickData = {
          time: liveCandle.time as Time,
          open: liveCandle.open,
          high: liveCandle.high,
          low: liveCandle.low,
          close: liveCandle.close,
          volume: liveCandle.volume // Include volume!
        };

        setHistoricalBars(prev => {
          // Check for duplicates
          const exists = prev.some(bar => bar.time === completedCandle.time);
          if (exists) {
            console.log('⚠️ Candle already exists, skipping');
            return prev;
          }

          // Add and sort chronologically
          const updated = [...prev, completedCandle].sort((a, b) => (a.time as number) - (b.time as number));

          console.log('💾 Saved completed candle:', {
            time: new Date((completedCandle.time as number) * 1000).toISOString(),
            volume: liveCandle.volume,
            total: updated.length
          });

          return updated;
        });
      }

      // Update tracking ref
      prevCandleTimeRef.current = candle.time;

      // Update context (will trigger chart update)
      setLiveCandle(candle);
    }
  }, [ltpData, setLiveCandle, liveCandle, setHistoricalBars]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Radio className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-gray-900">WebSocket Market Data Feed</h3>
            <p className="text-gray-600">Real-time market data updates via binary protocol</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isConnected
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-50 border-gray-200'
          }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600 animate-pulse' : 'bg-gray-400'
            }`}></div>
          <span className={isConnected ? 'text-green-700' : 'text-gray-600'}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Data Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Message Type 1: LTP Update */}
        {ltpData && <LTPDisplay data={ltpData} />}

        {/* Message Type 5: Quote Update */}
        {quoteData && <QuoteDisplay data={quoteData} />}

        {/* Message Type 6: Top Bid/Ask */}
        {topBidAsk && <TopBidAskDisplay data={topBidAsk} />}

        {/* Message Type 3: OHLC */}
        {ohlcData && <OHLCDisplay data={ohlcData} />}

        {/* Message Type 32: Previous Close & OI */}
        {prevCloseOI && <PrevCloseOIDisplay data={prevCloseOI} />}

        {/* Message Type 33: Circuit Limits */}
        {circuitLimits && <CircuitLimitsDisplay data={circuitLimits} />}

        {/* Message Type 36: 52-Week High/Low */}
        {weekHighLow && <WeekHighLowDisplay data={weekHighLow} />}
      </div>

      {/* Message Type 2: Market Depth - Full Width */}
      {marketDepth && (
        <div className="mt-4">
          <MarketDepthDisplay data={marketDepth} />
        </div>
      )}

      {/* 1-Minute OHLC Table - Historical + Live Aggregated Data */}
      <div className="mt-4">
        <OHLCTableDisplay
          historicalData={historicalBars}
          liveCandle={liveCandle}
        />
      </div>
    </div>
  );
}


