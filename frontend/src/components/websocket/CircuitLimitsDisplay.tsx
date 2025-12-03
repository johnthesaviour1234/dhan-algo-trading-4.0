import { Shield } from 'lucide-react';
import type { CircuitLimitData } from '../WebSocketDataPanel';

interface CircuitLimitsDisplayProps {
  data: CircuitLimitData;
}

export function CircuitLimitsDisplay({ data }: CircuitLimitsDisplayProps) {
  const range = data.upperLimit - data.lowerLimit;
  const currentPosition = ((data.currentPrice - data.lowerLimit) / range) * 100;
  
  return (
    <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-lg p-4 border border-rose-200">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-rose-600" />
        <h4 className="text-gray-900">Circuit Limits (Type 33)</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Symbol</span>
          <span className="text-gray-900">{data.symbol}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-rose-200">
          <div>
            <div className="text-xs text-gray-600 mb-1">Upper Limit</div>
            <div className="text-green-700">₹{data.upperLimit.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Lower Limit</div>
            <div className="text-red-700">₹{data.lowerLimit.toFixed(2)}</div>
          </div>
        </div>

        <div className="pt-2 border-t border-rose-200">
          <div className="text-xs text-gray-600 mb-1">Current Price</div>
          <div className="text-gray-900 mb-2">₹{data.currentPrice.toFixed(2)}</div>
          
          {/* Visual range indicator */}
          <div className="relative h-3 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full">
            <div 
              className="absolute w-3 h-3 bg-blue-600 rounded-full transform -translate-x-1/2 shadow-md"
              style={{ left: `${currentPosition}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-600">
            <span>Lower</span>
            <span>{currentPosition.toFixed(1)}% of range</span>
            <span>Upper</span>
          </div>
        </div>
      </div>
    </div>
  );
}
