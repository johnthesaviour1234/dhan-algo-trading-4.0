import { TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign } from 'lucide-react';
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
          
          <div className="grid grid-cols-6 gap-3">
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