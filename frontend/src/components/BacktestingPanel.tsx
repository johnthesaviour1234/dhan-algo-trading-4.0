import { useState } from 'react';
import { Calendar, Play, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { StrategyCard } from './StrategyCard';
import { LiveTradingPanel } from './LiveTradingPanel';

export interface MetricData {
  return: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
}

export interface Trade {
  id: string;
  entryDate: string;
  exitDate: string;
  direction: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  duration: string;
  signal: 'Buy' | 'Sell';
  brokerage: number;
  slippage: number;
  indicators?: Record<string, number | boolean | string>;
}

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  strategyType: string;
  metrics: {
    daily: MetricData;
    weekly: MetricData;
    monthly: MetricData;
    quarterly: MetricData;
    yearly: MetricData;
    overall: MetricData;
  };
  trades: Trade[];
}

const availableStrategies = [
  { id: '1', name: 'SMA Crossover', type: 'trend' },
  { id: '2', name: 'RSI Mean Reversion', type: 'mean-reversion' },
  { id: '3', name: 'Breakout Strategy', type: 'momentum' },
  { id: '4', name: 'Bollinger Bands', type: 'volatility' },
  { id: '5', name: 'MACD Strategy', type: 'trend' },
  { id: '6', name: 'Pairs Trading', type: 'statistical' },
];

export function BacktestingPanel() {
  const [activeTab, setActiveTab] = useState<'backtesting' | 'live'>('backtesting');
  
  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('backtesting')}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === 'backtesting'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Backtesting
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === 'live'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Live Trading
        </button>
      </div>

      {/* Content */}
      {activeTab === 'backtesting' ? <BacktestingContent /> : <LiveTradingPanel />}
    </div>
  );
}

function BacktestingContent() {
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [selectedStrategies, setSelectedStrategies] = useState<typeof availableStrategies>([]);
  const [performanceData, setPerformanceData] = useState<StrategyPerformance[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const addStrategy = (strategyTemplate: typeof availableStrategies[0]) => {
    const newStrategy: StrategyPerformance = {
      strategyId: `${strategyTemplate.id}-${Date.now()}`,
      strategyName: strategyTemplate.name,
      strategyType: strategyTemplate.type,
      metrics: generateMockMetrics(),
      trades: [],
    };
    setSelectedStrategies([...selectedStrategies, newStrategy]);
  };

  const removeStrategy = (id: string) => {
    setSelectedStrategies(selectedStrategies.filter(s => s.strategyId !== id));
    setPerformanceData(performanceData.filter(p => p.strategyId !== id));
  };

  const runBacktest = () => {
    if (selectedStrategies.length === 0) return;
    
    setIsRunning(true);
    
    // Simulate backtesting
    setTimeout(() => {
      const results = selectedStrategies.map(strategy => {
        const trades = generateMockTradesForStrategy(strategy.strategyName);
        return {
          strategyId: strategy.strategyId,
          strategyName: strategy.strategyName,
          strategyType: strategy.strategyType,
          metrics: generateMockMetrics(),
          trades: trades,
        };
      });
      
      setPerformanceData(results);
      setHasResults(true);
      setIsRunning(false);
    }, 2000);
  };

  const calculateCombinedMetrics = (): StrategyPerformance['metrics'] => {
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

    const timeframes: Array<keyof StrategyPerformance['metrics']> = [
      'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'overall'
    ];

    const combined = {} as StrategyPerformance['metrics'];

    timeframes.forEach(timeframe => {
      const avgReturn = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].return, 0) / performanceData.length;
      const avgSharpe = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].sharpeRatio, 0) / performanceData.length;
      const maxDrawdown = Math.min(...performanceData.map(p => p.metrics[timeframe].maxDrawdown));
      const avgWinRate = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].winRate, 0) / performanceData.length;
      const totalTrades = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].totalTrades, 0);
      const avgProfitFactor = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].profitFactor, 0) / performanceData.length;

      combined[timeframe] = {
        return: avgReturn,
        sharpeRatio: avgSharpe,
        maxDrawdown: maxDrawdown,
        winRate: avgWinRate,
        totalTrades: totalTrades,
        profitFactor: avgProfitFactor,
      };
    });

    return combined;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-gray-900">Backtesting Panel</h2>
        <p className="text-gray-600">Configure and run backtests</p>
      </div>

      {/* Date Selection */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="start-date" className="block text-gray-700 mb-2">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-gray-700 mb-2">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Strategy Selection */}
      <div className="mb-6">
        <label className="block text-gray-700 mb-2">Add Strategies</label>
        <div className="flex flex-wrap gap-2">
          {availableStrategies.map(strategy => (
            <button
              key={strategy.id}
              onClick={() => addStrategy(strategy)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {strategy.name}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Strategies */}
      {selectedStrategies.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-gray-700 mb-3">
            Selected Strategies ({selectedStrategies.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedStrategies.map(strategy => (
              <div
                key={strategy.strategyId}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg"
              >
                <span className="text-gray-700">{strategy.strategyName}</span>
                <button
                  onClick={() => removeStrategy(strategy.strategyId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={runBacktest}
        disabled={selectedStrategies.length === 0 || isRunning}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isRunning ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Running Backtest...
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Run Backtest
          </>
        )}
      </button>

      {/* Results */}
      {hasResults && performanceData.length > 0 && (
        <div className="mt-8 space-y-6">
          {/* Combined Metrics */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-gray-900">Combined Portfolio Performance</h3>
                <p className="text-gray-600">Aggregated metrics across all strategies</p>
              </div>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-5 h-5" />
                    Collapse Strategies
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    Expand Strategies
                  </>
                )}
              </button>
            </div>

            <MetricsDisplay metrics={calculateCombinedMetrics()} />
          </div>

          {/* Individual Strategies */}
          {isExpanded && (
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <div>
                <h3 className="text-gray-900 mb-1">Individual Strategy Performance</h3>
                <p className="text-gray-600">Detailed breakdown and contribution analysis</p>
              </div>
              {performanceData.map(performance => (
                <StrategyCard
                  key={performance.strategyId}
                  performance={performance}
                  onRemove={() => removeStrategy(performance.strategyId)}
                  totalStrategies={performanceData.length}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateMockMetrics(): StrategyPerformance['metrics'] {
  const generateMetric = (): MetricData => ({
    return: parseFloat((Math.random() * 40 - 10).toFixed(2)),
    sharpeRatio: parseFloat((Math.random() * 3).toFixed(2)),
    maxDrawdown: parseFloat((-Math.random() * 20).toFixed(2)),
    winRate: parseFloat((40 + Math.random() * 30).toFixed(2)),
    totalTrades: Math.floor(Math.random() * 500 + 50),
    profitFactor: parseFloat((0.8 + Math.random() * 2).toFixed(2)),
  });

  return {
    daily: generateMetric(),
    weekly: generateMetric(),
    monthly: generateMetric(),
    quarterly: generateMetric(),
    yearly: generateMetric(),
    overall: generateMetric(),
  };
}

function generateMockTradesForStrategy(strategyName: string): Trade[] {
  const trades: Trade[] = [];
  const tradeCount = Math.floor(Math.random() * 50 + 10);
  const start = new Date('2024-01-01');

  for (let i = 0; i < tradeCount; i++) {
    const entryDate = new Date(start);
    entryDate.setDate(start.getDate() + Math.floor(Math.random() * 300));
    const exitDate = new Date(entryDate);
    exitDate.setDate(entryDate.getDate() + Math.floor(Math.random() * 30 + 1));

    const direction = Math.random() > 0.5 ? 'Long' : 'Short';
    const entryPrice = parseFloat((Math.random() * 100 + 50).toFixed(2));
    const priceChange = (Math.random() * 20 - 10);
    const exitPrice = parseFloat((entryPrice + (direction === 'Long' ? priceChange : -priceChange)).toFixed(2));
    const quantity = Math.floor(Math.random() * 100 + 10);
    
    const pnl = direction === 'Long' 
      ? (exitPrice - entryPrice) * quantity 
      : (entryPrice - exitPrice) * quantity;
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'Long' ? 1 : -1);
    
    const durationDays = Math.floor((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = durationDays === 1 ? '1 day' : `${durationDays} days`;

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

    trades.push({
      id: `trade-${i}`,
      entryDate: entryDate.toISOString().split('T')[0],
      exitDate: exitDate.toISOString().split('T')[0],
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
    });
  }

  return trades.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
}

interface MetricsDisplayProps {
  metrics: StrategyPerformance['metrics'];
}

function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  const timeframes: Array<{ key: keyof StrategyPerformance['metrics']; label: string }> = [
    { key: 'overall', label: 'Overall' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'daily', label: 'Daily' },
  ];

  return (
    <div className="space-y-3">
      {timeframes.map(({ key, label }) => (
        <div key={key} className="bg-gray-50 rounded-lg p-4">
          <div className="text-gray-700 mb-3">{label}</div>
          
          <div className="grid grid-cols-6 gap-3">
            <MetricCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Return"
              value={`${metrics[key].return > 0 ? '+' : ''}${metrics[key].return.toFixed(2)}%`}
              positive={metrics[key].return > 0}
            />
            
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Sharpe Ratio"
              value={metrics[key].sharpeRatio.toFixed(2)}
              positive={metrics[key].sharpeRatio > 1}
            />
            
            <MetricCard
              icon={<TrendingDown className="w-4 h-4" />}
              label="Max Drawdown"
              value={`${metrics[key].maxDrawdown.toFixed(2)}%`}
              positive={metrics[key].maxDrawdown > -10}
            />
            
            <MetricCard
              icon={<Target className="w-4 h-4" />}
              label="Win Rate"
              value={`${metrics[key].winRate.toFixed(2)}%`}
              positive={metrics[key].winRate > 50}
            />
            
            <MetricCard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Total Trades"
              value={metrics[key].totalTrades.toString()}
            />
            
            <MetricCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Profit Factor"
              value={metrics[key].profitFactor.toFixed(2)}
              positive={metrics[key].profitFactor > 1}
            />
          </div>
        </div>
      ))}
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
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <div className="flex items-center gap-2 text-gray-600 mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className={getColor()}>{value}</div>
    </div>
  );
}