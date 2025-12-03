import { useState, useEffect } from 'react';
import { Activity, TrendingUp, BarChart3, Layers, Radio } from 'lucide-react';
import { LTPDisplay } from './websocket/LTPDisplay';
import { MarketDepthDisplay } from './websocket/MarketDepthDisplay';
import { OHLCDisplay } from './websocket/OHLCDisplay';
import { QuoteDisplay } from './websocket/QuoteDisplay';
import { TopBidAskDisplay } from './websocket/TopBidAskDisplay';
import { PrevCloseOIDisplay } from './websocket/PrevCloseOIDisplay';
import { CircuitLimitsDisplay } from './websocket/CircuitLimitsDisplay';
import { WeekHighLowDisplay } from './websocket/WeekHighLowDisplay';

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
  const [isConnected, setIsConnected] = useState(false);
  const [ltpData, setLtpData] = useState<LTPData | null>(null);
  const [marketDepth, setMarketDepth] = useState<MarketDepthData | null>(null);
  const [ohlcData, setOhlcData] = useState<OHLCData | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [topBidAsk, setTopBidAsk] = useState<TopBidAskData | null>(null);
  const [prevCloseOI, setPrevCloseOI] = useState<PrevCloseOIData | null>(null);
  const [circuitLimits, setCircuitLimits] = useState<CircuitLimitData | null>(null);
  const [weekHighLow, setWeekHighLow] = useState<WeekHighLowData | null>(null);

  // Simulate WebSocket connection and data updates
  useEffect(() => {
    // Simulate connection
    setTimeout(() => setIsConnected(true), 1000);

    // Initialize with mock data
    setLtpData(generateMockLTPData());
    setMarketDepth(generateMockMarketDepth());
    setOhlcData(generateMockOHLC());
    setQuoteData(generateMockQuote());
    setTopBidAsk(generateMockTopBidAsk());
    setPrevCloseOI(generateMockPrevCloseOI());
    setCircuitLimits(generateMockCircuitLimits());
    setWeekHighLow(generateMockWeekHighLow());

    // Real-time updates
    const interval = setInterval(() => {
      if (Math.random() > 0.3) updateLTPData();
      if (Math.random() > 0.5) updateMarketDepth();
      if (Math.random() > 0.6) updateQuoteData();
      if (Math.random() > 0.7) updateTopBidAsk();
      if (Math.random() > 0.8) updateOHLCData();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const updateLTPData = () => {
    setLtpData(prev => {
      if (!prev) return generateMockLTPData();
      const newLtp = prev.ltp + (Math.random() * 4 - 2);
      const change = newLtp - prev.ltp;
      return {
        ...prev,
        ltp: parseFloat(newLtp.toFixed(2)),
        ltq: Math.floor(Math.random() * 500 + 50),
        volume: prev.volume + Math.floor(Math.random() * 10000),
        change: parseFloat(change.toFixed(2)),
        changePer: parseFloat(((change / prev.ltp) * 100).toFixed(2)),
        timestamp: new Date().toISOString(),
      };
    });
  };

  const updateMarketDepth = () => {
    setMarketDepth(prev => {
      if (!prev) return generateMockMarketDepth();
      const basePrice = ltpData?.ltp || 2450;
      return {
        ...prev,
        bids: Array(5).fill(0).map((_, i) => ({
          price: parseFloat((basePrice - (i + 1) * 0.25).toFixed(2)),
          volume: Math.floor(Math.random() * 1000 + 100),
          orders: Math.floor(Math.random() * 20 + 5),
        })),
        asks: Array(5).fill(0).map((_, i) => ({
          price: parseFloat((basePrice + (i + 1) * 0.25).toFixed(2)),
          volume: Math.floor(Math.random() * 1000 + 100),
          orders: Math.floor(Math.random() * 20 + 5),
        })),
      };
    });
  };

  const updateQuoteData = () => {
    setQuoteData(prev => {
      if (!prev) return generateMockQuote();
      const newLtp = ltpData?.ltp || prev.ltp;
      const change = newLtp - prev.prevClose;
      return {
        ...prev,
        ltp: newLtp,
        high: Math.max(prev.high, newLtp),
        low: Math.min(prev.low, newLtp),
        change: parseFloat(change.toFixed(2)),
        changePer: parseFloat(((change / prev.prevClose) * 100).toFixed(2)),
        timestamp: new Date().toISOString(),
      };
    });
  };

  const updateTopBidAsk = () => {
    setTopBidAsk(prev => {
      if (!prev) return generateMockTopBidAsk();
      const basePrice = ltpData?.ltp || 2450;
      const totalBuy = Math.floor(Math.random() * 200000 + 100000);
      const totalSell = Math.floor(Math.random() * 200000 + 100000);
      const totalQty = totalBuy + totalSell;
      return {
        ...prev,
        bestBuyPrice: parseFloat((basePrice - 0.25).toFixed(2)),
        bestAskPrice: parseFloat((basePrice + 0.25).toFixed(2)),
        buyQtyAtBest: Math.floor(Math.random() * 1000 + 200),
        sellQtyAtBest: Math.floor(Math.random() * 1000 + 200),
        totalBuy,
        totalSell,
        totalBuyPer: parseFloat(((totalBuy / totalQty) * 100).toFixed(2)),
        totalSellPer: parseFloat(((totalSell / totalQty) * 100).toFixed(2)),
      };
    });
  };

  const updateOHLCData = () => {
    setOhlcData(prev => {
      if (!prev) return generateMockOHLC();
      const currentLtp = ltpData?.ltp || prev.close;
      return {
        ...prev,
        high: Math.max(prev.high, currentLtp),
        low: Math.min(prev.low, currentLtp),
        close: currentLtp,
      };
    });
  };

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
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          isConnected 
            ? 'bg-green-50 border-green-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-600 animate-pulse' : 'bg-gray-400'
          }`}></div>
          <span className={isConnected ? 'text-green-700' : 'text-gray-600'}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

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
    </div>
  );
}

// Mock data generators
function generateMockLTPData(): LTPData {
  const ltp = 2450.50;
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    ltq: 125,
    ltp: ltp,
    volume: 1234567,
    atp: 2448.25,
    oi: 5000000,
    timestamp: new Date().toISOString(),
    change: 5.50,
    changePer: 0.22,
  };
}

function generateMockMarketDepth(): MarketDepthData {
  const basePrice = 2450.50;
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    bids: Array(5).fill(0).map((_, i) => ({
      price: parseFloat((basePrice - (i + 1) * 0.25).toFixed(2)),
      volume: Math.floor(Math.random() * 1000 + 500),
      orders: Math.floor(Math.random() * 20 + 5),
    })),
    asks: Array(5).fill(0).map((_, i) => ({
      price: parseFloat((basePrice + (i + 1) * 0.25).toFixed(2)),
      volume: Math.floor(Math.random() * 1000 + 500),
      orders: Math.floor(Math.random() * 20 + 5),
    })),
    totalBuy: 125000,
    totalSell: 98000,
  };
}

function generateMockOHLC(): OHLCData {
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    open: 2440.00,
    high: 2455.00,
    low: 2435.00,
    close: 2450.50,
  };
}

function generateMockQuote(): QuoteData {
  const ltp = 2450.50;
  const prevClose = 2445.00;
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    ltp: ltp,
    open: 2440.00,
    prevClose: prevClose,
    high: 2455.00,
    low: 2435.00,
    change: ltp - prevClose,
    changePer: ((ltp - prevClose) / prevClose) * 100,
    timestamp: new Date().toISOString(),
  };
}

function generateMockTopBidAsk(): TopBidAskData {
  const totalBuy = 125000;
  const totalSell = 98000;
  const totalQty = totalBuy + totalSell;
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    totalSell: totalSell,
    totalBuy: totalBuy,
    sellQtyAtBest: 500,
    buyQtyAtBest: 800,
    bestBuyPrice: 2450.25,
    bestAskPrice: 2450.75,
    totalBuyPer: (totalBuy / totalQty) * 100,
    totalSellPer: (totalSell / totalQty) * 100,
  };
}

function generateMockPrevCloseOI(): PrevCloseOIData {
  const prevOI = 4950000;
  const currentOI = 5000000;
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    prevClose: 2445.00,
    prevOI: prevOI,
    currentOI: currentOI,
    oiChange: currentOI - prevOI,
    oiPerChange: ((currentOI - prevOI) / prevOI) * 100,
  };
}

function generateMockCircuitLimits(): CircuitLimitData {
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    upperLimit: 2689.50,
    lowerLimit: 2200.50,
    currentPrice: 2450.50,
  };
}

function generateMockWeekHighLow(): WeekHighLowData {
  return {
    exchange: 'NSE',
    securityId: '14366',
    symbol: 'RELIANCE',
    weekHigh52: 2850.00,
    weekLow52: 2100.00,
    currentPrice: 2450.50,
  };
}
