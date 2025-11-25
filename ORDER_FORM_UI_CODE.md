# Order Placement - Final UI Code

## Add this after line 352 in OrderManagementPanel.tsx

```typescript
      {/* Order Placement Form */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Qty:</label>
          <input
            type="number"
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({...orderForm, quantity: Number(e.target.value)})}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Type:</label>
          <select
            value={orderForm.orderType}
            onChange={(e) => setOrderForm({...orderForm, orderType: e.target.value as 'MARKET' | 'LIMIT'})}
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
              onChange={(e) => setOrderForm({...orderForm, price: Number(e.target.value)})}
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
            onChange={(e) => setOrderForm({...orderForm, productType: e.target.value as 'INTRADAY' | 'CNC'})}
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
```

## Location
Insert between:
- Line 352: `</div>`  (closing stats section)
- Line 354: `{/* Filters */}`

The UI code goes here to display order form between stats and filters.
