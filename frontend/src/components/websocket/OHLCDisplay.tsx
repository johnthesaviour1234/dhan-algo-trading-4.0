import { BarChart3 } from 'lucide-react';
import type { OHLCData } from '../WebSocketDataPanel';

interface OHLCDisplayProps {
  data: OHLCData;
}

export function OHLCDisplay({ data }: OHLCDisplayProps) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-green-600" />
        <h4 className="text-gray-900">OHLC (Type 3)</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Symbol</span>
          <span className="text-gray-900">{data.symbol}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-green-200">
          <div>
            <div className="text-xs text-gray-600 mb-1">Open</div>
            <div className="text-gray-900">₹{data.open.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">High</div>
            <div className="text-green-700">₹{data.high.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Low</div>
            <div className="text-red-700">₹{data.low.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Close</div>
            <div className="text-gray-900">₹{data.close.toFixed(2)}</div>
          </div>
        </div>

        {/* Visual range bar */}
        <div className="pt-2">
          <div className="text-xs text-gray-600 mb-1">Range</div>
          <div className="relative h-2 bg-gray-200 rounded-full">
            <div 
              className="absolute h-full bg-gradient-to-r from-red-500 to-green-500 rounded-full"
              style={{
                left: `${((data.low - data.low) / (data.high - data.low)) * 100}%`,
                width: `${((data.high - data.low) / (data.high - data.low)) * 100}%`
              }}
            ></div>
            <div 
              className="absolute w-2 h-2 bg-blue-600 rounded-full -top-0 transform -translate-x-1/2"
              style={{
                left: `${((data.close - data.low) / (data.high - data.low)) * 100}%`
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
