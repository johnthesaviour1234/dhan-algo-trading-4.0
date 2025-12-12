import { Trash2, PieChart, Download } from 'lucide-react';
import type { StrategyPerformance } from './BacktestingPanel';
import { useState } from 'react';
import { CalculationsTable } from './CalculationsTable';

interface StrategyCardProps {
  performance: StrategyPerformance;
  onRemove: () => void;
  totalStrategies: number;
  dateRange?: { start: string; end: string };
}

export function StrategyCard({ performance, onRemove, totalStrategies, dateRange }: StrategyCardProps) {
  const contribution = (100 / totalStrategies).toFixed(1);
  const [showTrades, setShowTrades] = useState(false);
  const [viewMode, setViewMode] = useState<'trades' | 'calculations' | 'analytics'>('trades');
  const hasAdvancedAnalytics = performance.advancedAnalytics !== undefined;

  // Check if strategy supports calculations (EMA/SMA strategies)
  const strategyType = performance.strategyName.includes('EMA') ? 'EMA' :
    performance.strategyName.includes('SMA') ? 'SMA' : null;
  const isCalculationStrategy = strategyType !== null;  // Show tabs for EMA/SMA strategies
  const hasCalculationData = performance.calculations && performance.calculations.length > 0;

  // Download analytics function
  const downloadAnalytics = () => {
    // Calculate summary stats for verification
    const totalGrossPnl = performance.trades.reduce((sum, t) => sum + t.grossPnl, 0);
    const totalNetPnl = performance.trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalCosts = performance.trades.reduce((sum, t) => sum + (t.costs?.totalCost || 0), 0);
    const totalSlippage = performance.trades.reduce((sum, t) => sum + (t.slippage || 0), 0);

    const exportData = {
      exportDate: new Date().toISOString(),
      backtestPeriod: {
        start: dateRange?.start || 'Unknown',
        end: dateRange?.end || 'Unknown',
        note: 'These dates define the TUNING SET. Use a different date range for VALIDATION.'
      },
      strategyInfo: {
        name: performance.strategyName,
        type: performance.strategyType,
        totalTrades: performance.trades.length
      },
      // ALL 16 METRICS for each timeframe
      metrics: {
        daily: performance.metrics.daily,
        weekly: performance.metrics.weekly,
        monthly: performance.metrics.monthly,
        quarterly: performance.metrics.quarterly,
        yearly: performance.metrics.yearly,
        overall: performance.metrics.overall
      },
      // Advanced analytics - simplified (only hourlyPerformance for simple strategies)
      advancedAnalytics: {
        hourlyPerformance: performance.advancedAnalytics?.hourlyPerformance || []
      },
      // Trade summary with verification data
      tradeSummary: {
        winningTrades: performance.trades.filter(t => t.pnl > 0).length,
        losingTrades: performance.trades.filter(t => t.pnl <= 0).length,
        totalGrossPnl: parseFloat(totalGrossPnl.toFixed(2)),
        totalNetPnl: parseFloat(totalNetPnl.toFixed(2)),
        totalCosts: parseFloat(totalCosts.toFixed(2)),
        totalSlippage: parseFloat(totalSlippage.toFixed(2)),
        verificationCheck: {
          calculatedNetPnl: parseFloat((totalGrossPnl - totalCosts - totalSlippage).toFixed(2)),
          actualNetPnl: parseFloat(totalNetPnl.toFixed(2)),
          difference: parseFloat(Math.abs(totalNetPnl - (totalGrossPnl - totalCosts - totalSlippage)).toFixed(2)),
          status: Math.abs(totalNetPnl - (totalGrossPnl - totalCosts - totalSlippage)) < 1 ? 'OK' : 'MISMATCH - CHECK CALCULATIONS'
        }
      },
      // FULL TRADE DETAILS for analysis
      trades: performance.trades.map((t, idx) => ({
        tradeNumber: idx + 1,
        entryDate: t.entryDate,
        exitDate: t.exitDate,
        direction: t.direction,
        signal: t.signal,
        exitReason: (t as any).exitReason || 'Unknown',
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        quantity: t.quantity,
        grossPnl: t.grossPnl,
        costs: {
          brokerage: t.costs?.brokerage || 0,
          stt: t.costs?.stt || 0,
          transactionCharges: t.costs?.transactionCharges || 0,
          gst: t.costs?.gst || 0,
          sebiCharges: t.costs?.sebiCharges || 0,
          stampDuty: t.costs?.stampDuty || 0,
          totalCost: t.costs?.totalCost || 0
        },
        slippage: t.slippage,
        netPnl: t.pnl,
        pnlPercent: t.pnlPercent,
        duration: t.duration,
        indicators: t.indicators || {}
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `backtest_${performance.strategyName.replace(/\s+/g, '_')}_${dateRange?.start || 'unknown'}_to_${dateRange?.end || 'unknown'}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              {hasAdvancedAnalytics && (
                <button
                  onClick={() => { setViewMode('analytics'); setShowTrades(true); }}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'analytics'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Analytics
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => setShowTrades(!showTrades)}
            className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showTrades ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={downloadAnalytics}
            className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Download analytics for interpretation and tuning"
          >
            <Download className="w-4 h-4" />
            Export
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

            <div className="grid grid-cols-8 gap-2 mb-2">
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
                label="Win Rate"
                value={`${performance.metrics[key].winRate.toFixed(2)}%`}
                positive={performance.metrics[key].winRate > 50}
              />

              <MiniMetric
                label="Profit Factor"
                value={performance.metrics[key].profitFactor.toFixed(2)}
                positive={performance.metrics[key].profitFactor > 1}
              />

              <MiniMetric
                label="Payoff Ratio"
                value={performance.metrics[key].payoffRatio.toFixed(2)}
                positive={performance.metrics[key].payoffRatio > 1}
              />

              <MiniMetric
                label="Recovery"
                value={performance.metrics[key].recoveryFactor.toFixed(2)}
                positive={performance.metrics[key].recoveryFactor > 1}
              />

              <MiniMetric
                label="Max DD"
                value={`${performance.metrics[key].maxDrawdown.toFixed(2)}%`}
                positive={performance.metrics[key].maxDrawdown > -10}
              />

              <MiniMetric
                label="Trades"
                value={performance.metrics[key].totalTrades.toString()}
              />
            </div>

            <div className="grid grid-cols-8 gap-2">
              <MiniMetric
                label="Avg Win"
                value={`₹${performance.metrics[key].avgWin.toFixed(2)}`}
                positive={true}
              />

              <MiniMetric
                label="Avg Loss"
                value={`₹${performance.metrics[key].avgLoss.toFixed(2)}`}
                positive={false}
              />

              <MiniMetric
                label="Loss Rate"
                value={`${performance.metrics[key].lossRate.toFixed(2)}%`}
                positive={performance.metrics[key].lossRate < 50}
              />

              <MiniMetric
                label="Sharpe"
                value={performance.metrics[key].sharpeRatio.toFixed(2)}
                positive={performance.metrics[key].sharpeRatio > 1}
              />

              <MiniMetric
                label="R:R Ratio"
                value={performance.metrics[key].riskRewardRatio.toFixed(2)}
                positive={performance.metrics[key].riskRewardRatio > 1}
              />

              <MiniMetric
                label="Max Win Streak"
                value={performance.metrics[key].maxConsecutiveWins.toString()}
                positive={true}
              />

              <MiniMetric
                label="Max Loss Streak"
                value={performance.metrics[key].maxConsecutiveLosses.toString()}
                positive={performance.metrics[key].maxConsecutiveLosses < 5}
              />

              <MiniMetric
                label="Time in Mkt"
                value={`${performance.metrics[key].timeInMarket.toFixed(1)}%`}
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

      {/* Advanced Analytics */}
      {showTrades && viewMode === 'analytics' && hasAdvancedAnalytics && performance.advancedAnalytics && (
        <div className="border-t border-gray-200 pt-6 space-y-6">
          <h5 className="text-gray-900">Advanced Analytics</h5>

          {/* Exit Reasons */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h6 className="text-gray-700 mb-3">Exit Reason Breakdown</h6>
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-white rounded p-3 border border-gray-200 text-center">
                <div className="text-gray-600 text-sm">Signal</div>
                <div className="text-blue-600 font-medium">{performance.advancedAnalytics?.exitReasons?.signal || 0}</div>
              </div>
              <div className="bg-white rounded p-3 border border-gray-200 text-center">
                <div className="text-gray-600 text-sm">Market Close</div>
                <div className="text-purple-600 font-medium">{performance.advancedAnalytics?.exitReasons?.marketClose || 0}</div>
              </div>
            </div>
          </div>

          {/* Hourly Performance */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h6 className="text-gray-700 mb-3">Hourly Performance (IST)</h6>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Hour</th>
                    <th className="text-right py-2 px-3">Trades</th>
                    <th className="text-right py-2 px-3">Win Rate</th>
                    <th className="text-right py-2 px-3">Avg P&L</th>
                    <th className="text-right py-2 px-3">Total P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.advancedAnalytics.hourlyPerformance.filter(h => h.trades > 0).map(hp => (
                    <tr key={hp.hour} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-700">{hp.hour}</td>
                      <td className="py-2 px-3 text-right">{hp.trades}</td>
                      <td className={`py-2 px-3 text-right ${hp.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {hp.winRate.toFixed(1)}%
                      </td>
                      <td className={`py-2 px-3 text-right ${hp.avgPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{hp.avgPnl.toFixed(2)}
                      </td>
                      <td className={`py-2 px-3 text-right ${hp.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{hp.totalPnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          {/* Note: Monte Carlo, Profit Distribution, and Slippage Sensitivity
              removed for simple strategies - only used for advanced strategies */}
        </div>
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