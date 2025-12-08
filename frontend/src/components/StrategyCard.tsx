import { Trash2, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign, PieChart } from 'lucide-react';
import type { StrategyPerformance, Trade } from './BacktestingPanel';
import { useState } from 'react';
import { CalculationsTable } from './CalculationsTable';

interface StrategyCardProps {
  performance: StrategyPerformance;
  onRemove: () => void;
  totalStrategies: number;
}

export function StrategyCard({ performance, onRemove, totalStrategies }: StrategyCardProps) {
  const contribution = (100 / totalStrategies).toFixed(1);
  const [showTrades, setShowTrades] = useState(false);
  const [viewMode, setViewMode] = useState<'trades' | 'calculations'>('trades');

  // Check if strategy supports calculations (EMA/SMA strategies)
  const strategyType = performance.strategyName.includes('EMA') ? 'EMA' :
    performance.strategyName.includes('SMA') ? 'SMA' : null;
  const isCalculationStrategy = strategyType !== null;  // Show tabs for EMA/SMA strategies
  const hasCalculationData = performance.calculations && performance.calculations.length > 0;

  const timeframes: Array<{ key: keyof StrategyPerformance['metrics']; label: string }> = [
    { key: 'overall', label: 'Overall' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'daily', label: 'Daily' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <h4 className="text-gray-900 mb-1">{performance.strategyName}</h4>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-gray-600">
              <PieChart className="w-4 h-4" />
              <span>Portfolio Contribution: {contribution}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCalculationStrategy && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setViewMode('trades'); setShowTrades(true); }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'trades'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Trades
              </button>
              <button
                onClick={() => { setViewMode('calculations'); setShowTrades(true); }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'calculations'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Calculations
              </button>
            </div>
          )}
          <button
            onClick={() => setShowTrades(!showTrades)}
            className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showTrades ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={onRemove}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>
      </div>

      {/* Metrics by Timeframe */}
      <div className="space-y-3 mb-6">
        {timeframes.map(({ key, label }) => (
          <div key={key} className="bg-gray-50 rounded-lg p-4">
            <div className="text-gray-700 mb-3">{label}</div>

            <div className="grid grid-cols-7 gap-3">
              <MiniMetric
                label="Return"
                value={`${performance.metrics[key].return > 0 ? '+' : ''}${performance.metrics[key].return.toFixed(2)}%`}
                positive={performance.metrics[key].return > 0}
              />

              <MiniMetric
                label="Expectancy"
                value={`₹${performance.metrics[key].expectancy.toFixed(2)}`}
                positive={performance.metrics[key].expectancy > 0}
              />

              <MiniMetric
                label="Sharpe"
                value={performance.metrics[key].sharpeRatio.toFixed(2)}
                positive={performance.metrics[key].sharpeRatio > 1}
              />

              <MiniMetric
                label="Max DD"
                value={`${performance.metrics[key].maxDrawdown.toFixed(2)}%`}
                positive={performance.metrics[key].maxDrawdown > -10}
              />

              <MiniMetric
                label="Win Rate"
                value={`${performance.metrics[key].winRate.toFixed(2)}%`}
                positive={performance.metrics[key].winRate > 50}
              />

              <MiniMetric
                label="Trades"
                value={performance.metrics[key].totalTrades.toString()}
              />

              <MiniMetric
                label="Profit Factor"
                value={performance.metrics[key].profitFactor.toFixed(2)}
                positive={performance.metrics[key].profitFactor > 1}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Trade Execution Details / Calculations */}
      {showTrades && viewMode === 'trades' && (
        <div className="border-t border-gray-200 pt-6">
          <h5 className="text-gray-900 mb-4">Trade Execution Details ({performance.trades.length} trades)</h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 text-gray-700">Entry Date</th>
                  <th className="text-left py-3 px-3 text-gray-700">Exit Date</th>
                  <th className="text-left py-3 px-3 text-gray-700">Signal</th>
                  <th className="text-left py-3 px-3 text-gray-700">Direction</th>

                  {/* Dynamic Indicator Columns */}
                  {performance.trades[0]?.indicators && Object.keys(performance.trades[0].indicators).map((key) => (
                    <th key={key} className="text-right py-3 px-3 text-gray-700">{key}</th>
                  ))}

                  <th className="text-right py-3 px-3 text-gray-700">Entry Price</th>
                  <th className="text-right py-3 px-3 text-gray-700">Exit Price</th>
                  <th className="text-right py-3 px-3 text-gray-700">Quantity</th>
                  <th className="text-right py-3 px-3 text-gray-700">Total Cost</th>
                  <th className="text-right py-3 px-3 text-gray-700">Slippage</th>
                  <th className="text-right py-3 px-3 text-gray-700">P&L</th>
                  <th className="text-right py-3 px-3 text-gray-700">P&L %</th>
                  <th className="text-right py-3 px-3 text-gray-700">Duration</th>
                </tr>
              </thead>
              <tbody>
                {performance.trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 text-gray-600">{trade.entryDate}</td>
                    <td className="py-3 px-3 text-gray-600">{trade.exitDate}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-white text-xs ${trade.signal === 'Buy' ? 'bg-blue-600' : 'bg-orange-600'
                        }`}>
                        {trade.signal}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-white text-xs ${trade.direction === 'Long' ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                        {trade.direction}
                      </span>
                    </td>

                    {/* Dynamic Indicator Values */}
                    {trade.indicators && Object.entries(trade.indicators).map(([key, value]) => (
                      <td key={key} className="py-3 px-3 text-right text-gray-600">
                        {typeof value === 'boolean' ? (
                          <span className={`inline-flex px-2 py-0.5 rounded text-white text-xs ${value ? 'bg-green-600' : 'bg-gray-400'
                            }`}>
                            {value ? '✓' : '✗'}
                          </span>
                        ) : typeof value === 'number' ? (
                          value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        ) : (
                          value
                        )}
                      </td>
                    ))}

                    <td className="py-3 px-3 text-right text-gray-600">₹{trade.entryPrice.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-gray-600">₹{trade.exitPrice.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{trade.quantity}</td>
                    <td className="py-3 px-3 text-right text-gray-600">₹{trade.costs?.totalCost?.toFixed(2) ?? '0.00'}</td>
                    <td className="py-3 px-3 text-right text-gray-600">₹{trade.slippage?.toFixed(2) ?? '0.00'}</td>
                    <td className={`py-3 px-3 text-right ${(trade.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{trade.pnl?.toFixed(2) ?? '0.00'}
                    </td>
                    <td className={`py-3 px-3 text-right ${(trade.pnlPercent ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(trade.pnlPercent ?? 0) >= 0 ? '+' : ''}{trade.pnlPercent?.toFixed(2) ?? '0.00'}%
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600">{trade.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Real-Time Calculations */}
      {showTrades && viewMode === 'calculations' && isCalculationStrategy && (
        hasCalculationData ? (
          <CalculationsTable
            calculations={performance.calculations!}
            strategyType={strategyType!}
          />
        ) : (
          <div className="border-t border-gray-200 pt-6">
            <h5 className="text-gray-900 mb-4">Real-Time Calculations</h5>
            <div className="text-center py-8 text-gray-500">
              Waiting for strategy to generate calculations...
              <p className="text-sm mt-2">Calculations will appear as candles complete.</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

interface MiniMetricProps {
  label: string;
  value: string;
  positive?: boolean;
}

function MiniMetric({ label, value, positive }: MiniMetricProps) {
  const getColor = () => {
    if (positive === undefined) return 'text-gray-900';
    return positive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="bg-white rounded p-3 border border-gray-200">
      <div className="text-gray-600 mb-1">{label}</div>
      <div className={getColor()}>{value}</div>
    </div>
  );
}