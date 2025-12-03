import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import type { LTPData } from '../WebSocketDataPanel';

interface LTPDisplayProps {
  data: LTPData;
}

export function LTPDisplay({ data }: LTPDisplayProps) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-600" />
        <h4 className="text-gray-900">LTP Update (Type 1)</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Symbol</span>
          <span className="text-gray-900">{data.symbol}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">LTP</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl ${data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{data.ltp.toFixed(2)}
            </span>
            {data.change >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Change</span>
          <span className={data.change >= 0 ? 'text-green-600' : 'text-red-600'}>
            {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} ({data.changePer.toFixed(2)}%)
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200">
          <div>
            <div className="text-xs text-gray-600">LTQ</div>
            <div className="text-gray-900">{data.ltq}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Volume</div>
            <div className="text-gray-900">{data.volume.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">ATP</div>
            <div className="text-gray-900">₹{data.atp.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">OI</div>
            <div className="text-gray-900">{data.oi.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
