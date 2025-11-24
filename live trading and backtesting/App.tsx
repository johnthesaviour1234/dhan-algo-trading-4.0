import { useState } from 'react';
import { TradingChart } from './components/TradingChart';
import { OrderManagementPanel } from './components/OrderManagementPanel';
import { BacktestingPanel } from './components/BacktestingPanel';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-gray-900">Algorithmic Trading Platform</h1>
        <p className="text-gray-600">Backtesting & Live Trading</p>
      </header>
      
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        <TradingChart />
        <OrderManagementPanel />
        <BacktestingPanel />
      </main>
    </div>
  );
}