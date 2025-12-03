import { FileText, TrendingUp, TrendingDown } from 'lucide-react';
import type { QuoteData } from '../WebSocketDataPanel';

interface QuoteDisplayProps {
  data: QuoteData;
}

export function QuoteDisplay({ data }: QuoteDisplayProps) {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-orange-600" />
        <h4 className="text-gray-900">Quote (Type 5)</h4>
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
        
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-orange-200">
          <div>
            <div className="text-xs text-gray-600">Open</div>
            <div className="text-gray-900 text-sm">₹{data.open.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">High</div>
            <div className="text-green-700 text-sm">₹{data.high.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Low</div>
            <div className="text-red-700 text-sm">₹{data.low.toFixed(2)}</div>
          </div>
        </div>

        <div className="pt-2 border-t border-orange-200">
          <div className="text-xs text-gray-600">Previous Close</div>
          <div className="text-gray-900">₹{data.prevClose.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
