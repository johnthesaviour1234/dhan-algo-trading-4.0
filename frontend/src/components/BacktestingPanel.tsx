import { useState } from 'react';
import { Play, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign, Plus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { StrategyCard } from './StrategyCard';
import { LiveTradingPanel } from './LiveTradingPanel';
import { backtestDataFetcher, BacktestSymbolConfig } from '../lib/BacktestDataFetcher';
import { backtestEngine, StrategyConfig } from '../lib/BacktestEngine';
import type { TradeCosts } from '../utils/BrokerageCalculator';

export interface MetricData {
  return: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  lossRate: number;    // 100% - Win Rate
  totalTrades: number;
  profitFactor: number;
  expectancy: number;  // (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
  avgWin: number;      // Average winning trade (₹)
  avgLoss: number;     // Average losing trade (₹)
}

export interface Trade {
  id: string;
  entryDate: string;
  exitDate: string;
  direction: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;  // P&L before costs
  pnl: number;       // Net P&L after all costs
  pnlPercent: number;
  duration: string;
  signal: 'Buy' | 'Sell';
  slippage: number;
  costs: TradeCosts;  // Detailed cost breakdown
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
  calculations?: import('../types/CalculationRow').CalculationRow[];
}

// Real strategy configurations that map to the BacktestEngine
interface AvailableStrategy {
  id: string;
  name: string;
  type: string;
  engineConfig: StrategyConfig;
}

const availableStrategies: AvailableStrategy[] = [
  {
    id: '1',
    name: 'SMA 3/15 Crossover',
    type: 'trend',
    engineConfig: {
      name: 'SMA 3/15 Crossover',
      type: 'sma-crossover',
      direction: 'long',
      params: { fastPeriod: 3, slowPeriod: 15 }
    }
  },
  {
    id: '2',
    name: 'SMA 5/20 Crossover',
    type: 'trend',
    engineConfig: {
      name: 'SMA 5/20 Crossover',
      type: 'sma-crossover',
      direction: 'long',
      params: { fastPeriod: 5, slowPeriod: 20 }
    }
  },
  {
    id: '3',
    name: 'EMA 3/15 Crossover',
    type: 'trend',
    engineConfig: {
      name: 'EMA 3/15 Crossover',
      type: 'ema-crossover',
      direction: 'long',
      params: { fastPeriod: 3, slowPeriod: 15 }
    }
  },
  {
    id: '4',
    name: 'EMA 9/21 Crossover',
    type: 'trend',
    engineConfig: {
      name: 'EMA 9/21 Crossover',
      type: 'ema-crossover',
      direction: 'long',
      params: { fastPeriod: 9, slowPeriod: 21 }
    }
  },
  {
    id: '5',
    name: 'SMA 10/50 Crossover',
    type: 'trend',
    engineConfig: {
      name: 'SMA 10/50 Crossover',
      type: 'sma-crossover',
      direction: 'long',
      params: { fastPeriod: 10, slowPeriod: 50 }
    }
  },
  {
    id: '6',
    name: 'EMA 12/26 Crossover',
    type: 'trend',
    engineConfig: {
      name: 'EMA 12/26 Crossover',
      type: 'ema-crossover',
      direction: 'long',
      params: { fastPeriod: 12, slowPeriod: 26 }
    }
  },
  {
    id: '7',
    name: 'EMA 3/15 + Candlestick',
    type: 'pattern',
    engineConfig: {
      name: 'EMA 3/15 + Candlestick',
      type: 'ema-candlestick',
      direction: 'long',
      params: { fastPeriod: 3, slowPeriod: 15, adxPeriod: 14, adxThreshold: 25 }
    }
  },
  {
    id: '8',
    name: 'EMA 15/60 + Candlestick',
    type: 'pattern',
    engineConfig: {
      name: 'EMA 15/60 + Candlestick',
      type: 'ema-candlestick',
      direction: 'long',
      params: { fastPeriod: 15, slowPeriod: 60, adxPeriod: 14, adxThreshold: 25 }
    }
  },
  {
    id: '9',
    name: 'EMA Scalping (8/13/21/34)',
    type: 'scalping',
    engineConfig: {
      name: 'EMA Scalping (8/13/21/34)',
      type: 'ema-scalping',
      direction: 'long',
      params: {
        rsiPeriod: 7,
        targetProfitPercent: 0.015,  // 1.5% target (1:1.5 R:R)
        stopLossPercent: 0.01        // 1% stop loss
      }
    }
  },
];

// Symbol configuration for backtesting (same as chart)
const symbolConfig: BacktestSymbolConfig = {
  symbol: 'RELIANCE',
  exchange: 'NSE',
  segment: 'E',
  secId: 14366,
  interval: '1', // 1 minute
};

interface SelectedStrategy extends AvailableStrategy {
  strategyId: string;
}

interface BacktestingPanelProps {
  orders: import('../App').ProcessedOrder[];
  setOrders: React.Dispatch<React.SetStateAction<import('../App').ProcessedOrder[]>>;
}

export function BacktestingPanel({ orders, setOrders }: BacktestingPanelProps) {
  const [activeTab, setActiveTab] = useState<'backtesting' | 'live'>('backtesting');

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('backtesting')}
          className={`px-6 py-3 rounded-md transition-all ${activeTab === 'backtesting'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          Backtesting
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`px-6 py-3 rounded-md transition-all ${activeTab === 'live'
            ? 'bg-white text-green-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          Live Trading
        </button>
      </div>

      {/* Content */}
      {activeTab === 'backtesting' ? <BacktestingContent /> : <LiveTradingPanel orders={orders} setOrders={setOrders} />}
    </div>
  );
}

function BacktestingContent() {
  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [selectedStrategies, setSelectedStrategies] = useState<SelectedStrategy[]>([]);
  const [performanceData, setPerformanceData] = useState<StrategyPerformance[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [error, setError] = useState<string | null>(null);

  const addStrategy = (strategyTemplate: AvailableStrategy) => {
    const newStrategy: SelectedStrategy = {
      ...strategyTemplate,
      strategyId: `${strategyTemplate.id}-${Date.now()}`,
    };
    setSelectedStrategies([...selectedStrategies, newStrategy]);
  };

  const removeStrategy = (id: string) => {
    setSelectedStrategies(selectedStrategies.filter(s => s.strategyId !== id));
    setPerformanceData(performanceData.filter(p => p.strategyId !== id));
  };

  const runBacktest = async () => {
    if (selectedStrategies.length === 0) return;

    setIsRunning(true);
    setError(null);
    setProgress({ percent: 0, message: 'Starting backtest...' });

    try {
      // Parse dates
      const fromDate = new Date(startDate);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999);

      console.log(`🧪 [Backtest] Running from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      console.log(`🧪 [Backtest] Strategies: ${selectedStrategies.map(s => s.name).join(', ')}`);

      // Step 1: Fetch historical data
      setProgress({ percent: 10, message: 'Fetching historical data...' });

      const ohlcData = await backtestDataFetcher.fetchBacktestData(
        fromDate,
        toDate,
        symbolConfig,
        (percent, message) => {
          // Scale progress from 10-60% during data fetch
          setProgress({ percent: 10 + Math.floor(percent * 0.5), message });
        }
      );

      if (ohlcData.length === 0) {
        throw new Error('No historical data available for the selected date range');
      }

      console.log(`📊 [Backtest] Fetched ${ohlcData.length} candles`);
      setProgress({ percent: 60, message: `Processing ${ohlcData.length} candles...` });

      // Step 2: Run backtest for each strategy
      const results: StrategyPerformance[] = [];

      for (let i = 0; i < selectedStrategies.length; i++) {
        const strategy = selectedStrategies[i];
        const progressPercent = 60 + Math.floor(((i + 1) / selectedStrategies.length) * 35);

        setProgress({
          percent: progressPercent,
          message: `Running ${strategy.name}... (${i + 1}/${selectedStrategies.length})`
        });

        // Run the backtest engine
        const { trades, metrics } = backtestEngine.runBacktest(
          ohlcData,
          strategy.engineConfig,
          1 // quantity
        );

        // Convert BacktestTrade to Trade interface
        const convertedTrades: Trade[] = trades.map(t => ({
          ...t,
          indicators: t.indicators
        }));

        results.push({
          strategyId: strategy.strategyId,
          strategyName: strategy.name,
          strategyType: strategy.type,
          metrics: metrics,
          trades: convertedTrades,
        });

        console.log(`✅ [Backtest] ${strategy.name}: ${trades.length} trades`);
      }

      setProgress({ percent: 100, message: 'Backtest complete!' });
      setPerformanceData(results);
      setHasResults(true);

    } catch (err: any) {
      console.error('❌ [Backtest] Error:', err);
      setError(err.message || 'An error occurred during backtesting');
    } finally {
      setIsRunning(false);
    }
  };

  const calculateCombinedMetrics = (): StrategyPerformance['metrics'] => {
    if (performanceData.length === 0) {
      return {
        daily: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
        weekly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
        monthly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
        quarterly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
        yearly: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
        overall: { return: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, lossRate: 0, totalTrades: 0, profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
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
      const avgLossRate = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].lossRate, 0) / performanceData.length;
      const totalTrades = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].totalTrades, 0);
      const avgProfitFactor = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].profitFactor, 0) / performanceData.length;
      const avgExpectancy = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].expectancy, 0) / performanceData.length;
      const avgWin = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].avgWin, 0) / performanceData.length;
      const avgLoss = performanceData.reduce((sum, p) => sum + p.metrics[timeframe].avgLoss, 0) / performanceData.length;

      combined[timeframe] = {
        return: avgReturn,
        sharpeRatio: avgSharpe,
        maxDrawdown: maxDrawdown,
        winRate: avgWinRate,
        lossRate: avgLossRate,
        totalTrades: totalTrades,
        profitFactor: avgProfitFactor,
        expectancy: avgExpectancy,
        avgWin: avgWin,
        avgLoss: avgLoss,
      };
    });

    return combined;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-gray-900">Backtesting Panel</h2>
        <p className="text-gray-600">Run strategies against real historical data</p>
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

      {/* Symbol Info */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <span className="font-medium">Symbol:</span> {symbolConfig.symbol} ({symbolConfig.exchange})
          <span className="mx-2">•</span>
          <span className="font-medium">Interval:</span> {symbolConfig.interval} minute
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
                <span className="text-gray-700">{strategy.name}</span>
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

      {/* Progress Bar */}
      {isRunning && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700">{progress.message}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium">Error</div>
          <div className="text-red-600">{error}</div>
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
            <Loader2 className="w-5 h-5 animate-spin" />
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

          <div className="grid grid-cols-10 gap-2">
            <MetricCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Return"
              value={`${metrics[key].return > 0 ? '+' : ''}${metrics[key].return.toFixed(2)}%`}
              positive={metrics[key].return > 0}
            />

            <MetricCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Expectancy"
              value={`₹${metrics[key].expectancy.toFixed(2)}`}
              positive={metrics[key].expectancy > 0}
            />

            <MetricCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Avg Win"
              value={`₹${metrics[key].avgWin.toFixed(2)}`}
              positive={true}
            />

            <MetricCard
              icon={<TrendingDown className="w-4 h-4" />}
              label="Avg Loss"
              value={`₹${metrics[key].avgLoss.toFixed(2)}`}
              positive={false}
            />

            <MetricCard
              icon={<Target className="w-4 h-4" />}
              label="Win Rate"
              value={`${metrics[key].winRate.toFixed(2)}%`}
              positive={metrics[key].winRate > 50}
            />

            <MetricCard
              icon={<Target className="w-4 h-4" />}
              label="Loss Rate"
              value={`${metrics[key].lossRate.toFixed(2)}%`}
              positive={metrics[key].lossRate < 50}
            />

            <MetricCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Profit Factor"
              value={metrics[key].profitFactor.toFixed(2)}
              positive={metrics[key].profitFactor > 1}
            />

            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Sharpe"
              value={metrics[key].sharpeRatio.toFixed(2)}
              positive={metrics[key].sharpeRatio > 1}
            />

            <MetricCard
              icon={<TrendingDown className="w-4 h-4" />}
              label="Max DD"
              value={`${metrics[key].maxDrawdown.toFixed(2)}%`}
              positive={metrics[key].maxDrawdown > -10}
            />

            <MetricCard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Trades"
              value={metrics[key].totalTrades.toString()}
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