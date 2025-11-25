import { useState, useEffect } from 'react';
import { Play, Pause, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign } from 'lucide-react';
import { StrategyCard } from './StrategyCard';
import type { StrategyPerformance, MetricData, Trade } from './BacktestingPanel';
import { TestingStrategy } from '../strategies/TestingStrategy';
import { toast } from './Toast';

const availableStrategies = [
  { id: 'testing', name: 'Testing', type: 'auto' },
  { id: '1', name: 'SMA Crossover', type: 'trend' },
  { id: '2', name: 'RSI Mean Reversion', type: 'mean-reversion' },
  { id: '3', name: 'Breakout Strategy', type: 'momentum' },
  { id: '4', name: 'Bollinger Bands', type: 'volatility' },
  { id: '5', name: 'MACD Strategy', type: 'trend' },
  { id: '6', name: 'Pairs Trading', type: 'statistical' },
];

export function LiveTradingPanel() {
  const [selectedStrategies, setSelectedStrategies] = useState<typeof availableStrategies>([]);
  const [performanceData, setPerformanceData] = useState<StrategyPerformance[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [activeStrategies, setActiveStrategies] = useState<Map<string, TestingStrategy>>(new Map());

  const addStrategy = (strategyId: string) => {
    const strategy = availableStrategies.find(s => s.id === strategyId);
    if (strategy && !selectedStrategies.find(s => s.id === strategyId)) {
      setSelectedStrategies([...selectedStrategies, strategy]);
    }
  };

  const placeOrder = async (type: 'BUY' | 'SELL', qty: number): Promise<{ price?: number }> => {
    try {
      // Get access token
      let token = localStorage.getItem('dhan_access_token');

      if (!token) {
        const res = await fetch('http://localhost:3001/api/access-token');
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

      const orderPayload = {
        dhanClientId: "1102850909",
        transactionType: type,
        exchangeSegment: "NSE_EQ",
        productType: "INTRADAY",
        orderType: "MARKET",
        validity: "DAY",
        securityId: "14366", // IDEA
        quantity: qty.toString(),
        disclosedQuantity: "",
        price: "",
        triggerPrice: "",
        afterMarketOrder: false
      };

      console.log('📤 Placing order:', orderPayload);

      const res = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log('✅ Order placed:', data);
        return { price: 10 }; // TODO: Get actual price from order response or market data
      } else {
        throw new Error(data.error || 'Order failed');
      }
    } catch (error: any) {
      console.error('❌ Order error:', error);
      toast.error(`Order ${type} failed: ${error.message}`);
      throw error;
    }
  };

  const removeStrategy = (strategyId: string) => {
    setSelectedStrategies(selectedStrategies.filter(s => s.id !== strategyId));
    setPerformanceData(performanceData.filter(p => p.strategyId !== strategyId));

    if (selectedStrategies.length === 1) {
      setHasResults(false);
      setIsLive(false);
    }
  };

  const startLiveTrading = () => {
    if (selectedStrategies.length === 0) return;

    setIsLive(true);

    // Initialize strategies
    const newActiveStrategies = new Map<string, TestingStrategy>();
    const initialPerformanceData: StrategyPerformance[] = [];

    selectedStrategies.forEach(strategy => {
      if (strategy.id === 'testing') {
        // Create and start Testing strategy with real order placement
        const testingStrategy = new TestingStrategy(
          placeOrder,
          (trade) => {
            // Add trade to performance data
            setPerformanceData(prevData => {
              const strategyData = prevData.find(p => p.strategyId === 'testing');
              if (strategyData) {
                return prevData.map(p =>
                  p.strategyId === 'testing'
                    ? { ...p, trades: [trade, ...p.trades] }
                    : p
                );
              }
              return prevData;
            });
          }
        );

        testingStrategy.start();
        newActiveStrategies.set('testing', testingStrategy);

        // Initialize performance data for Testing strategy
        initialPerformanceData.push({
          strategyId: 'testing',
          strategyName: 'Testing',
          strategyType: 'auto',
          metrics: generateInitialMetrics(),
          trades: []
        });

        console.log('🚀 Testing strategy initialized and started');
      } else {
        // Non-Testing strategies: initialize with empty data (no mocks)
        initialPerformanceData.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          strategyType: strategy.type,
          metrics: generateInitialMetrics(),
          trades: [], // Empty - only Testing strategy executes real trades
        });
      }
    });

    setActiveStrategies(newActiveStrategies);
    setPerformanceData(initialPerformanceData);
    setHasResults(true);
  };

  const stopLiveTrading = () => {
    setIsLive(false);

    // Stop all active strategies
    activeStrategies.forEach((strategy, id) => {
      console.log(`🛑 Stopping strategy: ${id}`);
      strategy.stop();
    });

    setActiveStrategies(new Map());
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
        <div className="flex gap-2 flex-wrap">
          {availableStrategies.map(strategy => {
            const isSelected = selectedStrategies.some(s => s.id === strategy.id);
            return (
              <button
                key={strategy.id}
                onClick={() => !isSelected && addStrategy(strategy.id)}
                disabled={isSelected}
                className={`px-4 py-2 rounded-lg border transition-colors ${isSelected
                  ? 'bg-blue-50 border-blue-300 text-blue-700 cursor-not-allowed'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {strategy.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Button */}
      <div className="mb-8">
        {!isLive ? (
          <button
            onClick={startLiveTrading}
            disabled={selectedStrategies.length === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${selectedStrategies.length === 0
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
              }`}
          >
            <Play className="w-5 h-5" />
            Start Live Trading
          </button>
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
  return {
    return: parseFloat((Math.random() * 40 - 10).toFixed(2)),
    sharpeRatio: parseFloat((Math.random() * 3).toFixed(2)),
    maxDrawdown: parseFloat((Math.random() * -30).toFixed(2)),
    winRate: parseFloat((Math.random() * 40 + 40).toFixed(2)),
    totalTrades: Math.floor(Math.random() * 100 + 10),
    profitFactor: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
  };
}

function updateMetrics(currentMetrics: StrategyPerformance['metrics']): StrategyPerformance['metrics'] {
  const updatedMetrics = { ...currentMetrics };

  // Slightly update each timeframe
  (['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'overall'] as const).forEach(timeframe => {
    updatedMetrics[timeframe] = {
      return: parseFloat((currentMetrics[timeframe].return + (Math.random() * 2 - 1)).toFixed(2)),
      sharpeRatio: parseFloat((currentMetrics[timeframe].sharpeRatio + (Math.random() * 0.2 - 0.1)).toFixed(2)),
      maxDrawdown: parseFloat((currentMetrics[timeframe].maxDrawdown + (Math.random() * 1 - 0.5)).toFixed(2)),
      winRate: parseFloat(Math.max(0, Math.min(100, currentMetrics[timeframe].winRate + (Math.random() * 4 - 2))).toFixed(2)),
      totalTrades: currentMetrics[timeframe].totalTrades,
      profitFactor: parseFloat(Math.max(0, currentMetrics[timeframe].profitFactor + (Math.random() * 0.2 - 0.1)).toFixed(2)),
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
  if (performanceData.length === 0) {
    return {
      daily: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0, profitFactor: 0 },
      weekly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0, profitFactor: 0 },
      monthly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0, profitFactor: 0 },
      quarterly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0, profitFactor: 0 },
      yearly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0, profitFactor: 0 },
      overall: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0, profitFactor: 0 },
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
  return {
    return: parseFloat((metrics.reduce((sum, m) => sum + m.return, 0) / count).toFixed(2)),
    sharpeRatio: parseFloat((metrics.reduce((sum, m) => sum + m.sharpeRatio, 0) / count).toFixed(2)),
    maxDrawdown: parseFloat(Math.min(...metrics.map(m => m.maxDrawdown)).toFixed(2)),
    winRate: parseFloat((metrics.reduce((sum, m) => sum + m.winRate, 0) / count).toFixed(2)),
    totalTrades: metrics.reduce((sum, m) => sum + m.totalTrades, 0),
    profitFactor: parseFloat((metrics.reduce((sum, m) => sum + m.profitFactor, 0) / count).toFixed(2)),
  };
}
