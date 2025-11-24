import { useState, useEffect } from 'react';
import { ShoppingCart, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface OrderData {
  msg_code: number;
  msg_len: number;
  exchange: string;
  segment: string;
  source: string;
  security_id: string;
  client_id: string;
  exch_order_no: string;
  order_no: string;
  product: string;
  txn_type: string;
  order_type: string;
  validity: string;
  disc_quantity: number;
  dq_qty_rem: number;
  remaining_quantity: number;
  quantity: number;
  traded_qty: number;
  price: number;
  trigger_price: number;
  serial_no: number;
  traded_price: number;
  avg_traded_price: number;
  algo_ord_no: number;
  strategy_id: number;
  off_mkt_flag: string;
  order_date_time: string;
  exch_order_time: string;
  last_updated_time: string;
  remarks: string;
  mkt_type: string;
  reason_description: string;
  leg_no: number;
  mkt_pro_flag: string;
  mkt_pro_value: number;
  participant_type: string;
  settlor: string;
  GTCFlag: string;
  encash_flag: string;
  pan_no: string;
  group_id: number;
  instrument: string;
  symbol: string;
  product_name: string;
  status: string;
  lot_size: number;
  fSLTrail: number;
  trailing_jump: number;
  fSLTickValue: number;
  sl_abstick_value: number;
  fPRTickValue: number;
  pr_abstick_value: number;
  strike_price: number;
  expiry_date: string;
  opt_type: string;
  display_name: string;
  isin: string;
  series: string;
  good_till_days_date: string;
  sIntrumentType: string;
  ref_ltp: number;
  tick_size: number;
  algo_id: string;
  sPlatform: string;
  sChannel: string;
  multiplier: number;
  underlying_symbol: string;
}

interface OrderMessage {
  Data: OrderData;
  Type: string;
}

interface ProcessedOrder {
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

export function OrderManagementPanel() {
  const [orders, setOrders] = useState<ProcessedOrder[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'traded' | 'rejected'>('all');

  // Simulate receiving order messages in real-time
  useEffect(() => {
    // Mock data based on the provided messages
    const mockMessages: OrderMessage[] = [
      {
        Data: {
          msg_code: 23, msg_len: 1056, exchange: "NSE", segment: "E", source: "W",
          security_id: "14366", client_id: "1102850909", exch_order_no: "1100000032471839",
          order_no: "34125112418233", product: "I", txn_type: "B", order_type: "MKT",
          validity: "DAY", disc_quantity: 0, dq_qty_rem: 0, remaining_quantity: 1,
          quantity: 1, traded_qty: 0, price: 0, trigger_price: 0, serial_no: 1,
          traded_price: 0, avg_traded_price: 0, algo_ord_no: 0, strategy_id: 0,
          off_mkt_flag: "0", order_date_time: "2025-11-24 11:42:24",
          exch_order_time: "2025-11-24 11:42:24", last_updated_time: "2025-11-24 11:42:24",
          remarks: "NR", mkt_type: "NL", reason_description: "CONFIRMED", leg_no: 1,
          mkt_pro_flag: "N", mkt_pro_value: 0, participant_type: "B", settlor: "90133",
          GTCFlag: "N", encash_flag: "N", pan_no: "PWWPS5212K", group_id: 34,
          instrument: "EQUITY", symbol: "IDEA", product_name: "INTRADAY", status: "Pending",
          lot_size: 1, fSLTrail: 0, trailing_jump: 0, fSLTickValue: 0, sl_abstick_value: 0,
          fPRTickValue: 0, pr_abstick_value: 0, strike_price: 0, expiry_date: "0001-01-01 00:00:00",
          opt_type: "XX", display_name: "Vodafone Idea", isin: "INE669E01016", series: "EQ",
          good_till_days_date: "2025-11-24", sIntrumentType: "EQ", ref_ltp: 10.09,
          tick_size: 0.01, algo_id: "0", sPlatform: "chartFull", sChannel: "NA",
          multiplier: 1, underlying_symbol: "IDEA"
        },
        Type: "order_alert"
      }
    ];

    // Simulate real-time order updates
    let orderIndex = 0;
    const interval = setInterval(() => {
      if (orderIndex < 10) { // Generate 10 mock orders
        const newOrder = generateMockOrder(orderIndex);
        processOrderMessage(newOrder);
        orderIndex++;
      }
    }, 5000); // New order every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const processOrderMessage = (message: OrderMessage) => {
    const data = message.Data;
    const processedOrder: ProcessedOrder = {
      order_no: data.order_no,
      symbol: data.symbol,
      display_name: data.display_name,
      txn_type: data.txn_type,
      order_type: data.order_type,
      quantity: data.quantity,
      traded_qty: data.traded_qty,
      remaining_quantity: data.remaining_quantity,
      price: data.price,
      traded_price: data.traded_price,
      avg_traded_price: data.avg_traded_price,
      status: data.status,
      order_date_time: data.order_date_time,
      last_updated_time: data.last_updated_time,
      reason_description: data.reason_description,
      exchange: data.exchange,
      product_name: data.product_name,
      serial_no: data.serial_no,
    };

    setOrders(prevOrders => {
      const existingIndex = prevOrders.findIndex(o => o.order_no === processedOrder.order_no);
      if (existingIndex >= 0) {
        // Update existing order
        const updated = [...prevOrders];
        updated[existingIndex] = processedOrder;
        return updated;
      } else {
        // Add new order at the beginning
        return [processedOrder, ...prevOrders];
      }
    });
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'pending') return order.status === 'Pending';
    if (filter === 'traded') return order.status === 'Traded';
    if (filter === 'rejected') return order.status === 'Rejected';
    return true;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'Pending').length,
    traded: orders.filter(o => o.status === 'Traded').length,
    rejected: orders.filter(o => o.status === 'Rejected').length,
    buy: orders.filter(o => o.txn_type === 'B').length,
    sell: orders.filter(o => o.txn_type === 'S').length,
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-gray-900">Order Management</h3>
            <p className="text-gray-600">Real-time order execution tracking</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <StatCard label="Total Orders" value={stats.total} />
          <StatCard label="Buy" value={stats.buy} color="green" />
          <StatCard label="Sell" value={stats.sell} color="red" />
          <StatCard label="Pending" value={stats.pending} color="yellow" />
          <StatCard label="Traded" value={stats.traded} color="blue" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All Orders"
          count={stats.total}
        />
        <FilterButton
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          label="Pending"
          count={stats.pending}
        />
        <FilterButton
          active={filter === 'traded'}
          onClick={() => setFilter('traded')}
          label="Traded"
          count={stats.traded}
        />
        <FilterButton
          active={filter === 'rejected'}
          onClick={() => setFilter('rejected')}
          label="Rejected"
          count={stats.rejected}
        />
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-gray-700">Order No</th>
                <th className="text-left py-3 px-4 text-gray-700">Symbol</th>
                <th className="text-left py-3 px-4 text-gray-700">Type</th>
                <th className="text-left py-3 px-4 text-gray-700">Order Type</th>
                <th className="text-right py-3 px-4 text-gray-700">Quantity</th>
                <th className="text-right py-3 px-4 text-gray-700">Traded</th>
                <th className="text-right py-3 px-4 text-gray-700">Remaining</th>
                <th className="text-right py-3 px-4 text-gray-700">Avg Price</th>
                <th className="text-left py-3 px-4 text-gray-700">Time</th>
                <th className="text-left py-3 px-4 text-gray-700">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.order_no} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-sm">{order.order_no}</td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="text-gray-900">{order.symbol}</div>
                        <div className="text-xs text-gray-500">{order.display_name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded text-white text-xs ${
                        order.txn_type === 'B' ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {order.txn_type === 'B' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{order.order_type}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{order.quantity}</td>
                    <td className="py-3 px-4 text-right text-green-600">{order.traded_qty}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{order.remaining_quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      {order.avg_traded_price > 0 ? `₹${order.avg_traded_price.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{order.order_date_time}</td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{order.reason_description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color?: 'green' | 'red' | 'blue' | 'yellow';
}

function StatCard({ label, value, color }: StatCardProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'green': return 'bg-green-50 text-green-700';
      case 'red': return 'bg-red-50 text-red-700';
      case 'blue': return 'bg-blue-50 text-blue-700';
      case 'yellow': return 'bg-yellow-50 text-yellow-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className={`px-4 py-2 rounded-lg ${getColorClasses()}`}>
      <div className="text-xs mb-1">{label}</div>
      <div className="text-xl">{value}</div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

function FilterButton({ active, onClick, label, count }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border transition-colors ${
        active
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label} <span className="ml-1">({count})</span>
    </button>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status.toLowerCase()) {
      case 'traded':
        return { icon: <CheckCircle className="w-4 h-4" />, bg: 'bg-green-100', text: 'text-green-700', label: 'Traded' };
      case 'pending':
        return { icon: <Clock className="w-4 h-4" />, bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' };
      case 'rejected':
        return { icon: <XCircle className="w-4 h-4" />, bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' };
      case 'partial':
        return { icon: <AlertCircle className="w-4 h-4" />, bg: 'bg-blue-100', text: 'text-blue-700', label: 'Partial' };
      default:
        return { icon: <AlertCircle className="w-4 h-4" />, bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${config.bg} ${config.text}`}>
      {config.icon}
      <span className="text-xs">{config.label}</span>
    </div>
  );
}

// Mock order generator for demo purposes
function generateMockOrder(index: number): OrderMessage {
  const symbols = ['IDEA', 'RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICI', 'SBIN', 'WIPRO'];
  const displayNames = ['Vodafone Idea', 'Reliance Industries', 'Tata Consultancy Services', 'Infosys', 'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Wipro'];
  const statuses = ['Pending', 'Traded', 'Rejected', 'Pending', 'Traded'];
  const txnTypes = ['B', 'S'];
  
  const symbolIndex = Math.floor(Math.random() * symbols.length);
  const txnType = txnTypes[Math.floor(Math.random() * txnTypes.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const quantity = Math.floor(Math.random() * 100) + 1;
  const traded_qty = status === 'Traded' ? quantity : (status === 'Pending' ? 0 : Math.floor(quantity / 2));
  const price = parseFloat((Math.random() * 1000 + 50).toFixed(2));
  
  const now = new Date();
  const orderTime = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;

  return {
    Data: {
      msg_code: 23,
      msg_len: 1056,
      exchange: "NSE",
      segment: "E",
      source: "W",
      security_id: `${14300 + index}`,
      client_id: "1102850909",
      exch_order_no: `1100000032${471839 + index}`,
      order_no: `${34125112418233 + index}`,
      product: "I",
      txn_type: txnType,
      order_type: "MKT",
      validity: "DAY",
      disc_quantity: 0,
      dq_qty_rem: 0,
      remaining_quantity: quantity - traded_qty,
      quantity: quantity,
      traded_qty: traded_qty,
      price: 0,
      trigger_price: 0,
      serial_no: status === 'Traded' ? 2 : 1,
      traded_price: status === 'Traded' ? price : 0,
      avg_traded_price: status === 'Traded' ? price : 0,
      algo_ord_no: 0,
      strategy_id: 0,
      off_mkt_flag: "0",
      order_date_time: orderTime,
      exch_order_time: orderTime,
      last_updated_time: orderTime,
      remarks: "NR",
      mkt_type: "NL",
      reason_description: status === 'Traded' ? "TRADE CONFIRMED" : (status === 'Rejected' ? "ORDER REJECTED" : "CONFIRMED"),
      leg_no: 1,
      mkt_pro_flag: "N",
      mkt_pro_value: 0,
      participant_type: "B",
      settlor: "90133",
      GTCFlag: "N",
      encash_flag: "N",
      pan_no: "PWWPS5212K",
      group_id: 34,
      instrument: "EQUITY",
      symbol: symbols[symbolIndex],
      product_name: "INTRADAY",
      status: status,
      lot_size: 1,
      fSLTrail: 0,
      trailing_jump: 0,
      fSLTickValue: 0,
      sl_abstick_value: 0,
      fPRTickValue: 0,
      pr_abstick_value: 0,
      strike_price: 0,
      expiry_date: "0001-01-01 00:00:00",
      opt_type: "XX",
      display_name: displayNames[symbolIndex],
      isin: "INE669E01016",
      series: "EQ",
      good_till_days_date: now.toISOString().split('T')[0],
      sIntrumentType: "EQ",
      ref_ltp: price,
      tick_size: 0.01,
      algo_id: "0",
      sPlatform: "chartFull",
      sChannel: "NA",
      multiplier: 1,
      underlying_symbol: symbols[symbolIndex]
    },
    Type: "order_alert"
  };
}