import { useState } from 'react';
import { TradingChart } from './components/TradingChart';
import { BacktestingPanel } from './components/BacktestingPanel';
import { OrderManagementPanel } from './components/OrderManagementPanel';
import { AccessTokenInput } from './components/AccessTokenInput';
import { ToastContainer } from './components/Toast';

// Order type from OrderManagementPanel
export interface ProcessedOrder {
  order_no: string;
  symbol: string;
  display_name: string;
  txn_type: string;
  order_type: string;
  quantity: number;
  traded_qty: number;
  remaining_quantity: number;
  price: number;
  traded_price: number;
  avg_traded_price: number;
  status: string;
  order_date_time: string;
  last_updated_time: string;
  reason_description: string;
  exchange: string;
  product_name: string;
  serial_no: number;
}

export default function App() {
  // Centralized orders state - single source of truth
  const [orders, setOrders] = useState<ProcessedOrder[]>([]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-gray-900">Algorithmic Trading Platform</h1>
        <p className="text-gray-600">Backtesting & Live Trading</p>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        <TradingChart />
        <AccessTokenInput />
        <OrderManagementPanel orders={orders} setOrders={setOrders} />
        <BacktestingPanel orders={orders} setOrders={setOrders} />
      </main>
    </div>
  );
}
