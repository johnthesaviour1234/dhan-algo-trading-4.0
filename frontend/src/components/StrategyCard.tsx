import { Trash2, PieChart, Download } from 'lucide-react';
import type { StrategyPerformance } from './BacktestingPanel';
import { useState } from 'react';
import { CalculationsTable } from './CalculationsTable';
import { HTFCalculationsTable } from './HTFCalculationsTable';

interface StrategyCardProps {
  performance: StrategyPerformance;
  onRemove: () => void;
  totalStrategies: number;
  dateRange?: { start: string; end: string };
}

export function StrategyCard({ performance, onRemove, totalStrategies, dateRange }: StrategyCardProps) {
  const contribution = (100 / totalStrategies).toFixed(1);
  const [showTrades, setShowTrades] = useState(false);
  const [viewMode, setViewMode] = useState<'trades' | 'calculations'>('trades');
  const hasAdvancedAnalytics = performance.advancedAnalytics !== undefined;

  // Check if strategy supports calculations
  const strategyType = performance.strategyName.includes('EMA') ? 'EMA' :
    performance.strategyName.includes('SMA') ? 'SMA' : null;
  const isEMAStrategy = strategyType !== null;
  const isBreakoutStrategy = performance.strategyType === 'breakout';
  const isCalculationStrategy = isEMAStrategy || isBreakoutStrategy;
  const hasCalculationData = performance.calculations && performance.calculations.length > 0;
  const hasHTFCalculationData = performance.htfCalculations && performance.htfCalculations.length > 0;

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
      // Advanced analytics - includes v1.3.0 analytics for loss analysis
      advancedAnalytics: {
        hourlyPerformance: performance.advancedAnalytics?.hourlyPerformance || [],
        // v1.3.0: New analytics for loss analysis
        durationAnalysis: performance.advancedAnalytics?.durationAnalysis,
        grossVsNetAnalysis: performance.advancedAnalytics?.grossVsNetAnalysis,
        marketConditionAnalysis: performance.advancedAnalytics?.marketConditionAnalysis,
      },
      // Capital tracking
      capitalInfo: performance.capitalInfo || {
        initialCapital: 100,
        finalCapital: 100 + performance.trades.reduce((sum, t) => sum + t.pnl, 0),
        netPnL: performance.trades.reduce((sum, t) => sum + t.pnl, 0),
        returnPercent: (performance.trades.reduce((sum, t) => sum + t.pnl, 0) / 100) * 100
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

      {/* Capital Info */}
      {performance.capitalInfo && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-gray-500 text-xs">Initial Capital</div>
              <div className="text-blue-600 font-bold">₹{performance.capitalInfo.initialCapital}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Final Capital</div>
              <div className={`font-bold ${performance.capitalInfo.finalCapital >= performance.capitalInfo.initialCapital ? 'text-green-600' : 'text-red-600'}`}>
                ₹{performance.capitalInfo.finalCapital.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Net P&L</div>
              <div className={`font-bold ${performance.capitalInfo.netPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.capitalInfo.netPnL >= 0 ? '+' : ''}₹{performance.capitalInfo.netPnL.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Return</div>
              <div className={`font-bold ${performance.capitalInfo.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.capitalInfo.returnPercent >= 0 ? '+' : ''}{performance.capitalInfo.returnPercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* v1.3.0: Duration Analysis */}
      {performance.advancedAnalytics?.durationAnalysis && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <div className="text-purple-700 font-medium mb-2 text-sm">📊 Duration Analysis</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-gray-500 text-xs">≤1 min</div>
              <div className="text-gray-700 text-sm">{performance.advancedAnalytics.durationAnalysis.under1min.trades} trades</div>
              <div className={`font-bold text-sm ${performance.advancedAnalytics.durationAnalysis.under1min.winRate > 5 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.advancedAnalytics.durationAnalysis.under1min.winRate.toFixed(1)}% win
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">1-5 min</div>
              <div className="text-gray-700 text-sm">{performance.advancedAnalytics.durationAnalysis.between1and5min.trades} trades</div>
              <div className={`font-bold text-sm ${performance.advancedAnalytics.durationAnalysis.between1and5min.winRate > 5 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.advancedAnalytics.durationAnalysis.between1and5min.winRate.toFixed(1)}% win
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">&gt;5 min</div>
              <div className="text-gray-700 text-sm">{performance.advancedAnalytics.durationAnalysis.over5min.trades} trades</div>
              <div className={`font-bold text-sm ${performance.advancedAnalytics.durationAnalysis.over5min.winRate > 5 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.advancedAnalytics.durationAnalysis.over5min.winRate.toFixed(1)}% win
              </div>
            </div>
          </div>
        </div>
      )}

      {/* v1.3.0: Gross vs Net Analysis */}
      {performance.advancedAnalytics?.grossVsNetAnalysis && (
        <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
          <div className="text-amber-700 font-medium mb-2 text-sm">💰 Gross vs Net Analysis</div>
          <div className="grid grid-cols-5 gap-2 text-center text-sm">
            <div>
              <div className="text-gray-500 text-xs">Gross PnL</div>
              <div className={`font-bold ${performance.advancedAnalytics.grossVsNetAnalysis.totalGrossPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{performance.advancedAnalytics.grossVsNetAnalysis.totalGrossPnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Costs</div>
              <div className="text-orange-600 font-bold">
                ₹{performance.advancedAnalytics.grossVsNetAnalysis.totalCosts.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Net PnL</div>
              <div className={`font-bold ${performance.advancedAnalytics.grossVsNetAnalysis.totalNetPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{performance.advancedAnalytics.grossVsNetAnalysis.totalNetPnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Gross Win%</div>
              <div className="text-gray-700 font-bold">{performance.advancedAnalytics.grossVsNetAnalysis.grossWinRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Net Win%</div>
              <div className="text-gray-700 font-bold">{performance.advancedAnalytics.grossVsNetAnalysis.netWinRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* v1.3.0: Market Condition Analysis */}
      {performance.advancedAnalytics?.marketConditionAnalysis && (
        <div className="mb-4 p-3 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-lg border border-cyan-200">
          <div className="text-cyan-700 font-medium mb-2 text-sm">🌊 Market Condition Analysis (EMA Gap)</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-2 bg-red-50 rounded border border-red-200">
              <div className="text-red-700 text-xs font-medium">Sideways (Gap &lt; 0.1%)</div>
              <div className="text-gray-700 text-sm">{performance.advancedAnalytics.marketConditionAnalysis.tradesWithEmaGapUnder0_1} trades</div>
              <div className={`font-bold ${performance.advancedAnalytics.marketConditionAnalysis.winRateWithEmaGapUnder0_1 > 10 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.advancedAnalytics.marketConditionAnalysis.winRateWithEmaGapUnder0_1.toFixed(1)}% win rate
              </div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded border border-green-200">
              <div className="text-green-700 text-xs font-medium">Trending (Gap ≥ 0.1%)</div>
              <div className="text-gray-700 text-sm">{performance.advancedAnalytics.marketConditionAnalysis.tradesWithEmaGapOver0_1} trades</div>
              <div className={`font-bold ${performance.advancedAnalytics.marketConditionAnalysis.winRateWithEmaGapOver0_1 > 10 ? 'text-green-600' : 'text-red-600'}`}>
                {performance.advancedAnalytics.marketConditionAnalysis.winRateWithEmaGapOver0_1.toFixed(1)}% win rate
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Reason Breakdown - inline */}
      {performance.advancedAnalytics?.exitReasons && (
        <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
          <div className="text-orange-700 font-medium mb-2 text-sm">🚪 Exit Reasons</div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div>
              <div className="text-gray-500 text-xs">Signal</div>
              <div className="text-blue-600 font-bold">{performance.advancedAnalytics.exitReasons.signal || 0}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Market Close</div>
              <div className="text-purple-600 font-bold">{performance.advancedAnalytics.exitReasons.marketClose || 0}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Stop Loss</div>
              <div className="text-red-600 font-bold">{(performance.advancedAnalytics.exitReasons as any).stopLoss || 0}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Take Profit</div>
              <div className="text-green-600 font-bold">{(performance.advancedAnalytics.exitReasons as any).takeProfit || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Hourly Performance - inline */}
      {performance.advancedAnalytics?.hourlyPerformance && performance.advancedAnalytics.hourlyPerformance.length > 0 && (
        <div className="mb-4 p-3 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-slate-200">
          <div className="text-slate-700 font-medium mb-2 text-sm">⏰ Hourly Performance (IST)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 px-2">Hour</th>
                  <th className="text-right py-1 px-2">Trades</th>
                  <th className="text-right py-1 px-2">Win%</th>
                  <th className="text-right py-1 px-2">Avg P&L</th>
                  <th className="text-right py-1 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {performance.advancedAnalytics.hourlyPerformance.filter(h => h.trades > 0).map(hp => (
                  <tr key={hp.hour} className="border-b border-gray-100">
                    <td className="py-1 px-2 text-gray-700">{hp.hour}</td>
                    <td className="py-1 px-2 text-right">{hp.trades}</td>
                    <td className={`py-1 px-2 text-right ${hp.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                      {hp.winRate.toFixed(1)}%
                    </td>
                    <td className={`py-1 px-2 text-right ${hp.avgPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{hp.avgPnl.toFixed(2)}
                    </td>
                    <td className={`py-1 px-2 text-right ${hp.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{hp.totalPnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Real-Time Calculations / HTF Calculations */}
      {showTrades && viewMode === 'calculations' && isCalculationStrategy && (
        isBreakoutStrategy ? (
          // HTF Calculations for breakout strategies
          hasHTFCalculationData ? (
            <HTFCalculationsTable calculations={performance.htfCalculations!} />
          ) : (
            <div className="border-t border-gray-200 pt-6">
              <h5 className="text-gray-900 mb-4">HTF Calculations</h5>
              <div className="text-center py-8 text-gray-500">
                No HTF calculation data available. Run a backtest first.
              </div>
            </div>
          )
        ) : isEMAStrategy ? (
          // EMA/SMA Calculations
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
        ) : null
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