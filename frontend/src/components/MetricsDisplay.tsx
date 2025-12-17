import { TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign, Wallet, Calculator, Percent, RefreshCw } from 'lucide-react';
import type { StrategyPerformance } from './BacktestingPanel';

interface MetricsDisplayProps {
  metrics: StrategyPerformance['metrics'];
}

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
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
          <div className="text-gray-700 mb-3">{label} Performance</div>

          {/* Original Metrics (based on Initial Capital) */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            <MetricCard
              icon={<DollarSign className="w-4 h-4" />}
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
              icon={<TrendingUp className="w-4 h-4" />}
              label="Profit Factor"
              value={metrics[key].profitFactor.toFixed(2)}
              positive={metrics[key].profitFactor > 1}
            />
          </div>

          {/* NEW: Invested Capital Metrics (based on Actual Investment) */}
          <div className="border-t border-gray-300 pt-3 mt-3">
            <div className="text-xs text-amber-600 font-medium mb-2 flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              Invested Capital Metrics (Actual Trade Investment)
            </div>
            <div className="grid grid-cols-5 gap-3">
              <MetricCard
                icon={<Wallet className="w-4 h-4" />}
                label="Total Invested"
                value={`₹${metrics[key].totalInvestedCapital?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
              />

              <MetricCard
                icon={<Calculator className="w-4 h-4" />}
                label="Avg Invested/Trade"
                value={`₹${metrics[key].avgInvestedCapital?.toFixed(2) || '0.00'}`}
              />

              <MetricCard
                icon={<Percent className="w-4 h-4" />}
                label="Return on Invested"
                value={`${(metrics[key].returnOnInvested || 0) > 0 ? '+' : ''}${(metrics[key].returnOnInvested || 0).toFixed(2)}%`}
                positive={(metrics[key].returnOnInvested || 0) > 0}
              />

              <MetricCard
                icon={<TrendingDown className="w-4 h-4" />}
                label="Drawdown (Invested)"
                value={`${(metrics[key].maxDrawdownOnInvested || 0).toFixed(2)}%`}
                positive={(metrics[key].maxDrawdownOnInvested || 0) > -10}
              />

              <MetricCard
                icon={<RefreshCw className="w-4 h-4" />}
                label="Recovery (Invested)"
                value={(metrics[key].recoveryFactorOnInvested || 0).toFixed(2)}
                positive={(metrics[key].recoveryFactorOnInvested || 0) > 1}
              />
            </div>
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
    if (positive === undefined) return 'text-gray-600';
    return positive ? 'text-green-600' : 'text-red-600';
  };

  const getBgColor = () => {
    if (positive === undefined) return 'bg-gray-100';
    return positive ? 'bg-green-50' : 'bg-red-50';
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className={`inline-flex p-2 rounded-lg ${getBgColor()} mb-2`}>
        <div className={getColor()}>{icon}</div>
      </div>
      <div className="text-gray-600 mb-1">{label}</div>
      <div className={`${getColor()}`}>{value}</div>
    </div>
  );
}