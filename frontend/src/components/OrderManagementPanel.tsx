import { useState, useEffect } from 'react';
import { ShoppingCart, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  // Order form state
  const [orderForm, setOrderForm] = useState({
    symbol: 'IDEA',
    securityId: '14366',
    quantity: 1,
    orderType: 'MARKET' as 'MARKET' | 'LIMIT',
    productType: 'INTRADAY' as 'INTRADAY' | 'CNC',
    price: 0
  });
  const [orderLoading, setOrderLoading] = useState(false);

  // Place order function
  const placeOrder = async (transactionType: 'BUY' | 'SELL') => {
    setOrderLoading(true);
    try {
      let token = localStorage.getItem('dhan_access_token');

      if (!token) {
        const res = await fetch('http://localhost:3001/api/access-token');
        if (res.ok) {
          const data = await res.json();
          token = data.token;
          if (token) localStorage.setItem('dhan_access_token', token);
        } else {
          alert('⚠️ Please set access token first');
          return;
        }
      }

      if (!token) {
        alert('⚠️ Access token not available');
        return;
      }

      const orderPayload = {
        dhanClientId: "1102850909",
        transactionType,
        exchangeSegment: "NSE_EQ",
        productType: orderForm.productType,
        orderType: orderForm.orderType,
        validity: "DAY",
        securityId: orderForm.securityId,
        quantity: orderForm.quantity.toString(),
        disclosedQuantity: "",
        price: orderForm.orderType === 'LIMIT' ? orderForm.price.toString() : "",
        triggerPrice: "",
        afterMarketOrder: false
      };

      console.log('📤 Placing order:', orderPayload);

      const res = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log('✅ Order placed:', data);
        alert(`✅ Order ${transactionType}\n\nOrder ID: ${data.orderId}\nStatus: ${data.orderStatus}\n\nOrder will appear below via WebSocket`);
      } else {
        throw new Error(data.error || 'Order failed');
      }
    } catch (error: any) {
      console.error('❌ Order error:', error);
      alert(`❌ Order failed: ${error.message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  // WebSocket connection to backend order feed proxy
  useEffect(() => {
    console.log('🔌 Connecting to order feed WebSocket...');
    const ws = new WebSocket('ws://localhost:3001/ws/orderFeed');

    ws.onopen = () => {
      console.log('✅ Connected to order feed');
      setConnectionStatus('connected');
    };

    ws.onmessage = async (event) => {
      try {
        let messageText: string;

        // Handle different message types
        if (event.data instanceof Blob) {
          // Binary message (Blob) - convert to text
          console.log('📥 Received Blob message, size:', event.data.size);
          messageText = await event.data.text();
        } else if (typeof event.data === 'string') {
          // Text message
          messageText = event.data;
        } else {
          console.warn('⚠️ Unknown message type:', typeof event.data);
          return;
        }

        // Check if message is base64 encoded (starts with common base64 patterns)
        // Base64 typically doesn't start with '{' or valid JSON chars
        let jsonString: string;
        if (messageText && !messageText.trim().startsWith('{') && messageText.match(/^[A-Za-z0-9+/=]+$/)) {
          // Looks like base64, decode it
          console.log('🔓 Decoding base64 message...');
          try {
            jsonString = atob(messageText);
            console.log('✅ Base64 decoded successfully');
          } catch (e) {
            console.error('❌ Base64 decode failed:', e);
            jsonString = messageText; // Use as-is if decode fails
          }
        } else {
          jsonString = messageText;
        }

        // Parse JSON
        const message = JSON.parse(jsonString);
        console.log('📨 Parsed message:', message);

        // Handle connection ready message
        if (message.type === 'connection_ready') {
          console.log('✅', message.message);
          return;
        }

        // Handle error messages
        if (message.error) {
          console.error('❌ Order feed error:', message.error);
          setConnectionStatus('error');
          return;
        }

        // Handle order alerts
        if (message.Type === 'order_alert' && message.Data) {
          console.log('📊 Order alert received:', message.Data.symbol, message.Data.status);
          processOrderMessage(message);
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
        console.error('   Raw data:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('🔒 Disconnected from order feed');
      setConnectionStatus('disconnected');
    };

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(''); // Empty message for heartbeat
        console.log('📤 Heartbeat sent');
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
    };
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
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Qty:</label>
          <input
            type="number"
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Type:</label>
          <select
            value={orderForm.orderType}
            onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value as 'MARKET' | 'LIMIT' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="MARKET">Market</option>
            <option value="LIMIT">Limit</option>
          </select>
        </div>

        {orderForm.orderType === 'LIMIT' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Price:</label>
            <input
              type="number"
              value={orderForm.price}
              onChange={(e) => setOrderForm({ ...orderForm, price: Number(e.target.value) })}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
              min="0"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Product:</label>
          <select
            value={orderForm.productType}
            onChange={(e) => setOrderForm({ ...orderForm, productType: e.target.value as 'INTRADAY' | 'CNC' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="INTRADAY">Intraday</option>
            <option value="CNC">CNC</option>
          </select>
        </div>

        <div className="flex-1"></div>

        <button
          onClick={() => placeOrder('BUY')}
          disabled={orderLoading}
          className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {orderLoading ? '...' : '🟢 BUY'}
        </button>

        <button
          onClick={() => placeOrder('SELL')}
          disabled={orderLoading}
          className="px-8 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {orderLoading ? '...' : '🔴 SELL'}
        </button>
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
                      <span className={`inline-flex px-2 py-1 rounded text-white text-xs ${order.txn_type === 'B' ? 'bg-green-600' : 'bg-red-600'
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
      className={`px-4 py-2 rounded-lg border transition-colors ${active
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