import { ArrowUpDown } from 'lucide-react';
import type { TopBidAskData } from '../WebSocketDataPanel';

interface TopBidAskDisplayProps {
  data: TopBidAskData;
}

export function TopBidAskDisplay({ data }: TopBidAskDisplayProps) {
  return (
    <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-lg p-4 border border-cyan-200">
      <div className="flex items-center gap-2 mb-3">
        <ArrowUpDown className="w-4 h-4 text-cyan-600" />
        <h4 className="text-gray-900">Top Bid/Ask (Type 6)</h4>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Symbol</span>
          <span className="text-gray-900">{data.symbol}</span>
        </div>
        
        {/* Best Bid/Ask */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cyan-200">
          <div className="bg-green-50 rounded p-2 border border-green-200">
            <div className="text-xs text-gray-600 mb-1">Best Bid</div>
            <div className="text-green-700">₹{data.bestBuyPrice.toFixed(2)}</div>
            <div className="text-xs text-gray-600 mt-1">Qty: {data.buyQtyAtBest}</div>
          </div>
          <div className="bg-red-50 rounded p-2 border border-red-200">
            <div className="text-xs text-gray-600 mb-1">Best Ask</div>
            <div className="text-red-700">₹{data.bestAskPrice.toFixed(2)}</div>
            <div className="text-xs text-gray-600 mt-1">Qty: {data.sellQtyAtBest}</div>
          </div>
        </div>

        {/* Total Buy/Sell */}
        <div className="pt-2 border-t border-cyan-200">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-green-700">Total Buy: {data.totalBuyPer.toFixed(1)}%</span>
            <span className="text-red-700">Total Sell: {data.totalSellPer.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
            <div 
              className="bg-green-500 transition-all duration-300" 
              style={{ width: `${data.totalBuyPer}%` }}
            ></div>
            <div 
              className="bg-red-500 transition-all duration-300" 
              style={{ width: `${data.totalSellPer}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-600">
            <span>{data.totalBuy.toLocaleString()}</span>
            <span>{data.totalSell.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
