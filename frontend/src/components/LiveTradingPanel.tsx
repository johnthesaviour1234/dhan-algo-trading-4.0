import { useState, useEffect, useRef } from 'react';
import { Play, Pause, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign } from 'lucide-react';
import { StrategyCard } from './StrategyCard';
import type { StrategyPerformance, MetricData, Trade } from './BacktestingPanel';
// NOTE: Legacy strategy imports removed during architecture refactoring (2025-12-12)
// Live trading strategies need to be migrated to new isolated architecture
// See: frontend/src/strategies/README.md
import { toast } from './Toast';
import { API_URL } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useChartData } from '../contexts/ChartDataContext';
import { useMemo } from 'react';
import type { OHLCCandle } from '../types/Strategy';

// TODO: Migrate live trading strategies to new isolated architecture
const availableStrategies = [
  { id: 'ema_3_15_simple', name: 'EMA 3/15 Simple v1.0.0', type: 'simple' },
  // Legacy strategies removed - need migration to new architecture
];
interface LiveTradingPanelProps {
  orders: import('../App').ProcessedOrder[];
  setOrders: React.Dispatch<React.SetStateAction<import('../App').ProcessedOrder[]>>;
}
export function LiveTradingPanel({ orders, setOrders }: LiveTradingPanelProps) {
  const [selectedStrategies, setSelectedStrategies] = useState<typeof availableStrategies>([]);
  const [performanceData, setPerformanceData] = useState<StrategyPerformance[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  // TODO: Replace with new isolated strategy interface when migrated
  const [activeStrategies, setActiveStrategies] = useState<Map<string, unknown>>(new Map());
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);

  // WebSocket hook for real-time market data
  const { ltpData } = useWebSocket();

  // Get OHLC data from ChartDataContext
  const { historicalBars, liveCandle } = useChartData();

  // Create merged OHLC data (historical + live)
  const mergedOHLCData: OHLCCandle[] = useMemo(() => {
    const historical: OHLCCandle[] = historicalBars.map(bar => ({
      time: bar.time as number,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0
    }));

    // Add live candle if newer or update if same time
    if (liveCandle) {
      const lastHistTime = historical.length > 0 ? historical[historical.length - 1].time : 0;

      if (liveCandle.time > lastHistTime) {
        return [...historical, liveCandle];
      } else if (liveCandle.time === lastHistTime) {
        const updated = [...historical];
        updated[updated.length - 1] = liveCandle;
        return updated;
      }
    }

    return historical;
  }, [historicalBars, liveCandle]);

  // Helper to filter OHLC data by strategy lookback period
  const getFilteredOHLCData = (fullData: OHLCCandle[], lookbackCandles: number): OHLCCandle[] => {
    if (fullData.length <= lookbackCandles) {
      return fullData; // Return all if less than lookback
    }
    // Return last N candles
    return fullData.slice(-lookbackCandles);
  };

  // Track last candle time to trigger strategies only on new candles (not every LTP tick)
  const prevCandleTimeRef = useRef<number | null>(null);

  // Check for access token on mount and periodically
  useEffect(() => {
    const checkToken = async () => {
      const localToken = localStorage.getItem('dhan_access_token');
      if (localToken) {
        setHasAccessToken(true);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/access-token`);
        if (res.ok) {
          const data = await res.json();
          setHasAccessToken(!!data.token);
        } else {
          setHasAccessToken(false);
        }
      } catch {
        setHasAccessToken(false);
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);



  const addStrategy = (strategyId: string) => {
    const strategy = availableStrategies.find(s => s.id === strategyId);
    if (strategy && !selectedStrategies.find(s => s.id === strategyId)) {
      setSelectedStrategies([...selectedStrategies, strategy]);
    }
  };

  const placeOrder = async (
    type: 'BUY' | 'SELL',
    qty: number,
    strategyId?: string,
    intent?: 'ENTRY' | 'EXIT'
  ): Promise<{
    price?: number;
    orderId?: string;
    orderStatus?: string;
    correlationId?: string;
  }> => {
    try {
      // Get access token
      let token = localStorage.getItem('dhan_access_token');

      if (!token) {
        const res = await fetch(`${API_URL}/api/access-token`);
        if (res.ok) {
          const data = await res.json();
          token = data.token;
          if (token) localStorage.setItem('dhan_access_token', token);
        } else {
          toast.warning('Please set access token first');
          throw new Error('No access token');
        }
      }

      if (!token) {
        toast.error('Access token not available');
        throw new Error('No access token');
      }

      // Generate correlation ID for tracking (simple format like manual orders)
      const correlationId = strategyId
        ? `${strategyId}-${Date.now()}`
        : undefined;

      const orderPayload = {
        dhanClientId: "1102850909",
        correlationId: correlationId,
        transactionType: type,
        exchangeSegment: "NSE_EQ",
        productType: "INTRADAY",
        orderType: "MARKET",
        validity: "DAY",
        tradingSymbol: "IDEA",  // Required for NSE_EQ despite being "optional" in docs
        securityId: "14366",
        quantity: qty,
        disclosedQuantity: 0,
        price: 0,
        triggerPrice: 0,
        afterMarketOrder: false
      };

      console.log('📤 Placing order:', orderPayload);
      if (correlationId) {
        console.log('🏷️  Correlation ID:', correlationId);
      }

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (res.ok && data.success && data.orderId) {
        console.log('✅ Order placed:', data);
        console.log('📋 Order ID:', data.orderId);
        if (correlationId) {
          console.log('🏷️  Correlation ID:', correlationId);
        }
        return {
          price: 10, // TODO: Get actual price from order response or market data
          orderId: data.orderId,
          orderStatus: data.orderStatus,
          correlationId: correlationId
        };
      } else {
        // Log full error details
        console.error('❌ Order placement failed:');
        console.error('   Response:', data);
        console.error('   Error Code:', data.errorCode);
        console.error('   Error Type:', data.errorType);
        console.error('   Error Message:', data.errorMessage || data.error);
        throw new Error(data.errorMessage || data.error || 'Order failed');
      }
    } catch (error: any) {
      console.error('❌ Order error:', error);
      toast.error(`Order ${type} failed: ${error.message}`);
      throw error;
    }
  };

  // Validated order placement - checks position before executing
  const validateAndPlaceOrder = async (
    strategyId: string,
    type: 'BUY' | 'SELL',
    qty: number,
    intent: 'ENTRY' | 'EXIT' = 'ENTRY'
  ): Promise<{
    price?: number;
    orderId?: string;
    orderStatus?: string;
    correlationId?: string;
  }> => {
    // Import position calculator
    const { canExecuteTrade } = await import('../utils/positionCalculator');

    // Validate against current positions
    const validation = canExecuteTrade(orders, 'IDEA', type);

    if (!validation.canTrade) {
      console.warn(`⚠️ Trade blocked for ${strategyId}:`, validation.warning);
      toast.warning(validation.warning || 'Trade blocked');
      throw new Error(validation.warning);
    }

    // Validation passed - execute order with tracking
    console.log(`✅ Position check passed for ${strategyId} ${type}`);
    return placeOrder(type, qty, strategyId, intent);
  };

  const removeStrategy = (strategyId: string) => {
    setSelectedStrategies(selectedStrategies.filter(s => s.id !== strategyId));
    setPerformanceData(performanceData.filter(p => p.strategyId !== strategyId));

    if (selectedStrategies.length === 1) {
      setHasResults(false);
      setIsLive(false);
    }
  };

  // Fetch Order Book from Dhan API
  const fetchOrderBook = async (): Promise<boolean> => {
    try {
      console.log('📥 Syncing Order Book before trading...');
      setIsSyncingOrders(true);

      let token = localStorage.getItem('dhan_access_token');

      if (!token) {
        const res = await fetch(`${API_URL}/api/access-token`);
        if (res.ok) {
          const data = await res.json();
          token = data.token;
        }
      }

      if (!token) {
        toast.error('Access token not available');
        return false;
      }

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        }
      });

      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.orders)) {
        console.log(`✅ Order Book synced: ${data.orders.length} orders`);
        setOrders(data.orders.map((order: any) => ({
          order_no: order.orderId || order.order_no || '',
          symbol: order.tradingSymbol || order.symbol || '',
          display_name: order.tradingSymbol || '',
          // Convert API format (BUY/SELL) to UI format (B/S)
          txn_type: order.transactionType === 'BUY' ? 'B' : order.transactionType === 'SELL' ? 'S' : 'B',
          order_type: order.orderType || 'MARKET',
          quantity: parseInt(order.quantity) || 0,
          traded_qty: order.filledQty || 0,
          remaining_quantity: order.remainingQuantity || 0,
          price: parseFloat(order.price) || 0,
          traded_price: 0,
          avg_traded_price: order.averageTradedPrice || 0,
          status: order.orderStatus || 'PENDING',
          order_date_time: order.createTime || '',
          last_updated_time: order.updateTime || '',
          reason_description: order.omsErrorDescription || '',
          exchange: order.exchangeSegment || '',
          product_name: order.productType || '',
          serial_no: 0
        })));
        toast.success(`Synced ${data.orders.length} existing orders`);
        return true;
      } else {
        console.error('❌ Failed to sync Order Book:', data.error);
        toast.error('Failed to sync Order Book');
        return false;
      }
    } catch (error: any) {
      console.error('❌ Order Book sync error:', error.message);
      toast.error(`Sync failed: ${error.message}`);
      return false;
    } finally {
      setIsSyncingOrders(false);
    }
  };

  const startLiveTrading = async () => {  // Made async!
    if (selectedStrategies.length === 0) return;

    // Check for access token before starting
    if (!hasAccessToken) {
      toast.error('Please set your Dhan Access Token first!');
      return;
    }

    // TODO: Live trading strategies need to be migrated to new isolated architecture
    // See: frontend/src/strategies/README.md
    toast.warning('Live trading strategies are being migrated to new architecture. Check console for details.');
    console.log('⚠️ Live trading strategies need to be migrated to new isolated architecture');
    console.log('📖 See: frontend/src/strategies/README.md');

    // Sync Order Book before starting strategies
    toast.info('Syncing Order Book...');
    const syncSuccess = await fetchOrderBook();
    if (!syncSuccess) {
      toast.error('Cannot start trading without Order Book sync');
      return;
    }

    // Wait 2 seconds for orders to fully sync and settle
    console.log('⏳ Waiting 2s for order data to settle...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Order data ready');

    setIsLive(true);

    // Initialize with placeholder performance data
    // TODO: Replace with actual strategy instances when migrated
    const initialPerformanceData: StrategyPerformance[] = [];

    selectedStrategies.forEach(strategy => {
      // Placeholder initialization until strategies are migrated
      initialPerformanceData.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyType: strategy.type,
        metrics: generateInitialMetrics(),
        trades: [],
      });
      console.log(`📊 [${strategy.name}] Strategy placeholder initialized (needs migration)`);
    });

    setPerformanceData(initialPerformanceData);
    setHasResults(true);
  };


  // TODO: Update strategies when new candle is added - commented until strategies migrated
  // useEffect(() => {
  //   if (mergedOHLCData.length === 0 || activeStrategies.size === 0) return;
  //   // ... legacy strategy update logic
  // }, [mergedOHLCData, activeStrategies]);

  const stopLiveTrading = () => {
    setIsLive(false);

    // TODO: Stop all active strategies when migrated
    // activeStrategies.forEach((strategy, id) => {
    //   console.log(`🛑 Stopping strategy: ${id}`);
    //   strategy.stop();
    // });

    setActiveStrategies(new Map());
    console.log('🛑 Live trading stopped - strategies placeholder cleared');
  };



  // Real-time updates - only update metrics, no mock trades
  useEffect(() => {
    if (!isLive || selectedStrategies.length === 0) return;

    const interval = setInterval(() => {
      setPerformanceData(prevData =>
        prevData.map(strategy => ({
          ...strategy,
          metrics: updateMetrics(strategy.metrics),
          // Trades only updated by Testing strategy via callback, not by timer
        }))
      );
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [isLive, selectedStrategies]);

  // Fetch real-time calculations from EMA/SMA strategies
  useEffect(() => {
    if (!isLive || activeStrategies.size === 0) return;

    const interval = setInterval(() => {
      setPerformanceData(prevData =>
        prevData.map(strategy => {
          // Get active strategy instance
          const activeStrategy = activeStrategies.get(strategy.strategyId);

          // Check if strategy has getCalculationHistory method (EMA/SMA strategies)
          if (activeStrategy && 'getCalculationHistory' in activeStrategy) {
            const calculations = (activeStrategy as any).getCalculationHistory();
            return {
              ...strategy,
              calculations
            };
          }

          return strategy;
        })
      );
    }, 1000); // Update every second for real-time feel

    return () => clearInterval(interval);
  }, [isLive, activeStrategies]);

  const combinedMetrics = calculateCombinedMetrics(performanceData);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-gray-900 mb-1">Live Trading</h3>
          <p className="text-gray-600">Monitor and execute strategies in real-time</p>
        </div>
        {isLive && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="text-green-700">Live Trading Active</span>
          </div>
        )}
      </div>

      {/* Strategy Selection */}
      <div className="mb-6">
        <label className="block text-gray-700 mb-2">Select Strategies</label>
        <div className="flex gap-4 flex-wrap">
          {availableStrategies.map(strategy => {
            const isSelected = selectedStrategies.some(s => s.id === strategy.id);
            return (
              <div key={strategy.id} className="flex items-center gap-2">
                <button
                  onClick={() => !isSelected && addStrategy(strategy.id)}
                  disabled={isSelected}
                  className={`px-4 py-2 rounded-lg border transition-colors ${isSelected
                    ? 'bg-blue-50 border-blue-300 text-blue-700 cursor-default'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400'
                    }`}
                >
                  {strategy.name}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Button */}
      <div className="mb-8">
        {!isLive ? (
          <div>
            <button
              onClick={startLiveTrading}
              disabled={selectedStrategies.length === 0 || !hasAccessToken || isSyncingOrders}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${selectedStrategies.length === 0 || !hasAccessToken || isSyncingOrders
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
                }`}
            >
              <Play className="w-5 h-5" />
              {isSyncingOrders ? 'Syncing Orders...' : 'Start Live Trading'}
            </button>
            {!hasAccessToken && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ Please set your Dhan Access Token first
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={stopLiveTrading}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Pause className="w-5 h-5" />
            Stop Live Trading
          </button>
        )}
      </div>

      {/* Results */}
      {hasResults && (
        <div className="space-y-8">
          {/* Combined Performance */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-gray-900">Combined Portfolio Performance</h3>
            </div>

            <div className="space-y-3">
              {(['overall', 'yearly', 'quarterly', 'monthly', 'weekly', 'daily'] as const).map((timeframe) => (
                <div key={timeframe} className="bg-white rounded-lg p-4">
                  <div className="text-gray-700 mb-3 capitalize">{timeframe}</div>

                  <div className="grid grid-cols-6 gap-3">
                    <MetricCard
                      icon={<TrendingUp className="w-4 h-4" />}
                      label="Return"
                      value={`${combinedMetrics[timeframe].return > 0 ? '+' : ''}${combinedMetrics[timeframe].return.toFixed(2)}%`}
                      positive={combinedMetrics[timeframe].return > 0}
                    />

                    <MetricCard
                      icon={<Activity className="w-4 h-4" />}
                      label="Sharpe Ratio"
                      value={combinedMetrics[timeframe].sharpeRatio.toFixed(2)}
                      positive={combinedMetrics[timeframe].sharpeRatio > 1}
                    />

                    <MetricCard
                      icon={<TrendingDown className="w-4 h-4" />}
                      label="Max Drawdown"
                      value={`${combinedMetrics[timeframe].maxDrawdown.toFixed(2)}%`}
                      positive={combinedMetrics[timeframe].maxDrawdown > -10}
                    />

                    <MetricCard
                      icon={<Target className="w-4 h-4" />}
                      label="Win Rate"
                      value={`${combinedMetrics[timeframe].winRate.toFixed(2)}%`}
                      positive={combinedMetrics[timeframe].winRate > 50}
                    />

                    <MetricCard
                      icon={<BarChart3 className="w-4 h-4" />}
                      label="Total Trades"
                      value={combinedMetrics[timeframe].totalTrades.toString()}
                    />

                    <MetricCard
                      icon={<DollarSign className="w-4 h-4" />}
                      label="Profit Factor"
                      value={combinedMetrics[timeframe].profitFactor.toFixed(2)}
                      positive={combinedMetrics[timeframe].profitFactor > 1}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Individual Strategy Performance */}
          <div>
            <h3 className="text-gray-900 mb-4">Individual Strategy Performance</h3>
            <div className="space-y-4">
              {performanceData.map(performance => (
                <StrategyCard
                  key={performance.strategyId}
                  performance={performance}
                  onRemove={() => removeStrategy(performance.strategyId)}
                  totalStrategies={performanceData.length}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  positive?: boolean;
}

function MetricCard({ icon, label, value, positive }: MetricCardProps) {
  const getColor = () => {
    if (positive === undefined) return 'text-gray-900';
    return positive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 text-gray-600 mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl ${getColor()}`}>{value}</div>
    </div>
  );
}

function generateInitialMetrics(): StrategyPerformance['metrics'] {
  return {
    daily: generateRandomMetricData(),
    weekly: generateRandomMetricData(),
    monthly: generateRandomMetricData(),
    quarterly: generateRandomMetricData(),
    yearly: generateRandomMetricData(),
    overall: generateRandomMetricData(),
  };
}

function generateRandomMetricData(): MetricData {
  const winRate = parseFloat((Math.random() * 40 + 40).toFixed(2));
  const avgWin = parseFloat((Math.random() * 100 + 10).toFixed(2));
  const avgLoss = parseFloat((Math.random() * 50 + 5).toFixed(2));
  const lossRate = parseFloat((100 - winRate).toFixed(2));
  const expectancy = parseFloat(((winRate / 100 * avgWin) - (lossRate / 100 * avgLoss)).toFixed(2));
  return {
    return: parseFloat((Math.random() * 40 - 10).toFixed(2)),
    sharpeRatio: parseFloat((Math.random() * 3).toFixed(2)),
    maxDrawdown: parseFloat((Math.random() * -30).toFixed(2)),
    winRate,
    lossRate,
    totalTrades: Math.floor(Math.random() * 100 + 10),
    profitFactor: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
    expectancy,
    avgWin,
    avgLoss,
  };
}

function updateMetrics(currentMetrics: StrategyPerformance['metrics']): StrategyPerformance['metrics'] {
  const updatedMetrics = { ...currentMetrics };

  // Slightly update each timeframe
  (['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'overall'] as const).forEach(timeframe => {
    const winRate = parseFloat(Math.max(0, Math.min(100, currentMetrics[timeframe].winRate + (Math.random() * 4 - 2))).toFixed(2));
    const lossRate = parseFloat((100 - winRate).toFixed(2));
    const avgWin = parseFloat(Math.max(0, (currentMetrics[timeframe].avgWin || 50) + (Math.random() * 2 - 1)).toFixed(2));
    const avgLoss = parseFloat(Math.max(0, (currentMetrics[timeframe].avgLoss || 25) + (Math.random() * 1 - 0.5)).toFixed(2));
    const expectancy = parseFloat(((winRate / 100 * avgWin) - (lossRate / 100 * avgLoss)).toFixed(2));

    updatedMetrics[timeframe] = {
      return: parseFloat((currentMetrics[timeframe].return + (Math.random() * 2 - 1)).toFixed(2)),
      sharpeRatio: parseFloat((currentMetrics[timeframe].sharpeRatio + (Math.random() * 0.2 - 0.1)).toFixed(2)),
      maxDrawdown: parseFloat((currentMetrics[timeframe].maxDrawdown + (Math.random() * 1 - 0.5)).toFixed(2)),
      winRate,
      lossRate,
      totalTrades: currentMetrics[timeframe].totalTrades,
      profitFactor: parseFloat(Math.max(0, currentMetrics[timeframe].profitFactor + (Math.random() * 0.2 - 0.1)).toFixed(2)),
      expectancy,
      avgWin,
      avgLoss,
    };
  });

  return updatedMetrics;
}

function generateInitialTrades(strategyName: string): Trade[] {
  const trades: Trade[] = [];
  const tradeCount = Math.floor(Math.random() * 10 + 5);
  const now = new Date();

  for (let i = 0; i < tradeCount; i++) {
    const entryDate = new Date(now);
    entryDate.setDate(now.getDate() - Math.floor(Math.random() * 30));
    const exitDate = new Date(entryDate);
    exitDate.setDate(entryDate.getDate() + Math.floor(Math.random() * 10 + 1));

    trades.push(generateTrade(strategyName, entryDate, exitDate, i));
  }

  return trades.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
}

function maybeAddNewTrade(currentTrades: Trade[], strategyName: string): Trade[] {
  // 20% chance to add a new trade on each update
  if (Math.random() > 0.8) {
    const now = new Date();
    const entryDate = new Date(now);
    entryDate.setHours(entryDate.getHours() - Math.floor(Math.random() * 24));
    const exitDate = new Date(now);

    const newTrade = generateTrade(strategyName, entryDate, exitDate, currentTrades.length);
    return [...currentTrades, newTrade].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }

  return currentTrades;
}

function generateTrade(strategyName: string, entryDate: Date, exitDate: Date, index: number): Trade {
  const direction = Math.random() > 0.5 ? 'Long' : 'Short';
  const entryPrice = parseFloat((Math.random() * 100 + 50).toFixed(2));
  const priceChange = (Math.random() * 20 - 10);
  const exitPrice = parseFloat((entryPrice + (direction === 'Long' ? priceChange : -priceChange)).toFixed(2));
  const quantity = Math.floor(Math.random() * 100 + 10);

  const pnl = direction === 'Long'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;
  const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'Long' ? 1 : -1);

  const durationHours = Math.floor((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60));
  const duration = durationHours < 24 ? `${durationHours}h` : `${Math.floor(durationHours / 24)}d`;

  // Generate strategy-specific indicators
  let indicators: Record<string, number | boolean | string> = {};

  if (strategyName === 'SMA Crossover') {
    const sma5 = parseFloat((entryPrice + Math.random() * 10 - 5).toFixed(2));
    const sma30 = parseFloat((entryPrice + Math.random() * 10 - 5).toFixed(2));
    indicators = {
      'SMA 5': sma5,
      'SMA 30': sma30,
      'SMA 5 > SMA 30': sma5 > sma30,
    };
  } else if (strategyName === 'RSI Mean Reversion') {
    const rsi = parseFloat((Math.random() * 100).toFixed(2));
    indicators = {
      'RSI 14': rsi,
      'RSI < 30': rsi < 30,
      'RSI > 70': rsi > 70,
    };
  } else if (strategyName === 'Breakout Strategy') {
    const high20 = parseFloat((entryPrice + Math.random() * 5).toFixed(2));
    const low20 = parseFloat((entryPrice - Math.random() * 5).toFixed(2));
    indicators = {
      '20D High': high20,
      '20D Low': low20,
      'Price > High': entryPrice > high20,
      'Volume': Math.floor(Math.random() * 1000000 + 100000),
    };
  } else if (strategyName === 'Bollinger Bands') {
    const upperBand = parseFloat((entryPrice + Math.random() * 10).toFixed(2));
    const lowerBand = parseFloat((entryPrice - Math.random() * 10).toFixed(2));
    const middleBand = parseFloat(((upperBand + lowerBand) / 2).toFixed(2));
    indicators = {
      'Upper Band': upperBand,
      'Middle Band': middleBand,
      'Lower Band': lowerBand,
      'Price > Upper': entryPrice > upperBand,
      'Price < Lower': entryPrice < lowerBand,
    };
  } else if (strategyName === 'MACD Strategy') {
    const macd = parseFloat((Math.random() * 4 - 2).toFixed(2));
    const signal = parseFloat((Math.random() * 4 - 2).toFixed(2));
    indicators = {
      'MACD': macd,
      'Signal': signal,
      'MACD > Signal': macd > signal,
      'Histogram': parseFloat((macd - signal).toFixed(2)),
    };
  } else if (strategyName === 'Pairs Trading') {
    const spread = parseFloat((Math.random() * 10 - 5).toFixed(2));
    const zScore = parseFloat((Math.random() * 4 - 2).toFixed(2));
    indicators = {
      'Spread': spread,
      'Z-Score': zScore,
      'Z-Score > 2': Math.abs(zScore) > 2,
      'Mean Spread': parseFloat((Math.random() * 5).toFixed(2)),
    };
  }

  return {
    id: `trade-live-${Date.now()}-${index}`,
    entryDate: entryDate.toISOString().split('T')[0] + ' ' + entryDate.toTimeString().split(' ')[0],
    exitDate: exitDate.toISOString().split('T')[0] + ' ' + exitDate.toTimeString().split(' ')[0],
    direction: direction,
    entryPrice: entryPrice,
    exitPrice: exitPrice,
    quantity: quantity,
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPercent: parseFloat(pnlPercent.toFixed(2)),
    duration: duration,
    signal: direction === 'Long' ? 'Buy' : 'Sell',
    brokerage: parseFloat((Math.random() * 10).toFixed(2)),
    slippage: parseFloat((Math.random() * 0.5).toFixed(2)),
    indicators: indicators,
  };
}

function calculateCombinedMetrics(performanceData: StrategyPerformance[]): StrategyPerformance['metrics'] {
  const emptyMetric: MetricData = { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 };
  if (performanceData.length === 0) {
    return {
      daily: emptyMetric,
      weekly: emptyMetric,
      monthly: emptyMetric,
      quarterly: emptyMetric,
      yearly: emptyMetric,
      overall: emptyMetric,
    };
  }

  const combined = {
    daily: combineMetrics(performanceData.map(p => p.metrics.daily)),
    weekly: combineMetrics(performanceData.map(p => p.metrics.weekly)),
    monthly: combineMetrics(performanceData.map(p => p.metrics.monthly)),
    quarterly: combineMetrics(performanceData.map(p => p.metrics.quarterly)),
    yearly: combineMetrics(performanceData.map(p => p.metrics.yearly)),
    overall: combineMetrics(performanceData.map(p => p.metrics.overall)),
  };

  return combined;
}

function combineMetrics(metrics: MetricData[]): MetricData {
  const count = metrics.length;
  const winRate = parseFloat((metrics.reduce((sum, m) => sum + m.winRate, 0) / count).toFixed(2));
  return {
    return: parseFloat((metrics.reduce((sum, m) => sum + m.return, 0) / count).toFixed(2)),
    sharpeRatio: parseFloat((metrics.reduce((sum, m) => sum + m.sharpeRatio, 0) / count).toFixed(2)),
    maxDrawdown: parseFloat(Math.min(...metrics.map(m => m.maxDrawdown)).toFixed(2)),
    winRate,
    lossRate: parseFloat((100 - winRate).toFixed(2)),
    totalTrades: metrics.reduce((sum, m) => sum + m.totalTrades, 0),
    profitFactor: parseFloat((metrics.reduce((sum, m) => sum + m.profitFactor, 0) / count).toFixed(2)),
    expectancy: parseFloat((metrics.reduce((sum, m) => sum + m.expectancy, 0) / count).toFixed(2)),
    avgWin: parseFloat((metrics.reduce((sum, m) => sum + m.avgWin, 0) / count).toFixed(2)),
    avgLoss: parseFloat((metrics.reduce((sum, m) => sum + m.avgLoss, 0) / count).toFixed(2)),
  };
}
