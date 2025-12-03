import { Calendar } from 'lucide-react';
import type { WeekHighLowData } from '../WebSocketDataPanel';

interface WeekHighLowDisplayProps {
  data: WeekHighLowData;
}

export function WeekHighLowDisplay({ data }: WeekHighLowDisplayProps) {
  const range = data.weekHigh52 - data.weekLow52;
  const currentPosition = ((data.currentPrice - data.weekLow52) / range) * 100;
  
  return (
    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 border border-teal-200">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-teal-600" />
        <h4 className="text-gray-900">52-Week High/Low (Type 36)</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Symbol</span>
          <span className="text-gray-900">{data.symbol}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-teal-200">
          <div>
            <div className="text-xs text-gray-600 mb-1">52W High</div>
            <div className="text-green-700">₹{data.weekHigh52.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">52W Low</div>
            <div className="text-red-700">₹{data.weekLow52.toFixed(2)}</div>
          </div>
        </div>

        <div className="pt-2 border-t border-teal-200">
          <div className="text-xs text-gray-600 mb-1">Current Price</div>
          <div className="text-gray-900 mb-2">₹{data.currentPrice.toFixed(2)}</div>
          
          {/* Visual range indicator */}
          <div className="relative h-3 bg-gradient-to-r from-red-300 via-yellow-300 to-green-300 rounded-full">
            <div 
              className="absolute w-3 h-3 bg-blue-600 rounded-full transform -translate-x-1/2 shadow-md border-2 border-white"
              style={{ left: `${currentPosition}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-600">
            <span>Low</span>
            <span>{currentPosition.toFixed(1)}% from low</span>
            <span>High</span>
          </div>
        </div>

        <div className="pt-2 border-t border-teal-200 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>From 52W Low:</span>
            <span className="text-green-600">
              +{(((data.currentPrice - data.weekLow52) / data.weekLow52) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>From 52W High:</span>
            <span className="text-red-600">
              {(((data.currentPrice - data.weekHigh52) / data.weekHigh52) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
