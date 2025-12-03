import { History } from 'lucide-react';
import type { PrevCloseOIData } from '../WebSocketDataPanel';

interface PrevCloseOIDisplayProps {
  data: PrevCloseOIData;
}

export function PrevCloseOIDisplay({ data }: PrevCloseOIDisplayProps) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-violet-600" />
        <h4 className="text-gray-900">Prev Close & OI (Type 32)</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Symbol</span>
          <span className="text-gray-900">{data.symbol}</span>
        </div>
        
        <div className="pt-2 border-t border-violet-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Prev Close</span>
            <span className="text-gray-900">₹{data.prevClose.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-violet-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">Prev OI</div>
              <div className="text-gray-900 text-sm">{data.prevOI.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Current OI</div>
              <div className="text-gray-900 text-sm">{data.currentOI.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-violet-200">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">OI Change</span>
            <div className="text-right">
              <div className={data.oiChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {data.oiChange >= 0 ? '+' : ''}{data.oiChange.toLocaleString()}
              </div>
              <div className={`text-xs ${data.oiPerChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.oiPerChange >= 0 ? '+' : ''}{data.oiPerChange.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
