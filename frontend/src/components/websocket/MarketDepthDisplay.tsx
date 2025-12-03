import { Layers } from 'lucide-react';
import type { MarketDepthData } from '../WebSocketDataPanel';

interface MarketDepthDisplayProps {
  data: MarketDepthData;
}

export function MarketDepthDisplay({ data }: MarketDepthDisplayProps) {
  const totalQty = data.totalBuy + data.totalSell;
  const buyPer = (data.totalBuy / totalQty) * 100;
  const sellPer = (data.totalSell / totalQty) * 100;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-purple-600" />
        <h4 className="text-gray-900">Market Depth (Type 2)</h4>
        <span className="text-sm text-gray-600 ml-auto">{data.symbol}</span>
      </div>

      {/* Total Buy/Sell Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-green-700">Buy: {buyPer.toFixed(1)}%</span>
          <span className="text-red-700">Sell: {sellPer.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
          <div 
            className="bg-green-500 transition-all duration-300" 
            style={{ width: `${buyPer}%` }}
          ></div>
          <div 
            className="bg-red-500 transition-all duration-300" 
            style={{ width: `${sellPer}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs mt-1 text-gray-600">
          <span>{data.totalBuy.toLocaleString()}</span>
          <span>{data.totalSell.toLocaleString()}</span>
        </div>
      </div>

      {/* Depth Table */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bids */}
        <div>
          <div className="text-xs text-gray-700 mb-2">Bids (5 Levels)</div>
          <table className="w-full text-xs">
            <thead className="bg-green-100 text-green-800">
              <tr>
                <th className="text-left py-1 px-2">Price</th>
                <th className="text-right py-1 px-2">Qty</th>
                <th className="text-right py-1 px-2">Orders</th>
              </tr>
            </thead>
            <tbody>
              {data.bids.map((bid, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 px-2 text-green-700">₹{bid.price.toFixed(2)}</td>
                  <td className="text-right py-1 px-2 text-gray-700">{bid.volume.toLocaleString()}</td>
                  <td className="text-right py-1 px-2 text-gray-600">{bid.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Asks */}
        <div>
          <div className="text-xs text-gray-700 mb-2">Asks (5 Levels)</div>
          <table className="w-full text-xs">
            <thead className="bg-red-100 text-red-800">
              <tr>
                <th className="text-left py-1 px-2">Price</th>
                <th className="text-right py-1 px-2">Qty</th>
                <th className="text-right py-1 px-2">Orders</th>
              </tr>
            </thead>
            <tbody>
              {data.asks.map((ask, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 px-2 text-red-700">₹{ask.price.toFixed(2)}</td>
                  <td className="text-right py-1 px-2 text-gray-700">{ask.volume.toLocaleString()}</td>
                  <td className="text-right py-1 px-2 text-gray-600">{ask.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
