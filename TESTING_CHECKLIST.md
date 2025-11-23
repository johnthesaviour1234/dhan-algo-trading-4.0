# Testing Checklist

Use this checklist to verify that all features are working correctly.

## Prerequisites
- [ ] Node.js v20.19+ or v22.12+ installed
- [ ] Backend dependencies installed (`cd backend && npm install`)
- [ ] Frontend dependencies installed (`cd frontend && npm install`)

## Backend Tests

### Server Startup
- [ ] Backend starts without errors (`cd backend && npm run dev`)
- [ ] Server logs show "Backend server running on http://localhost:3001"
- [ ] No error messages in console

### API Endpoints
- [ ] Health check works: `http://localhost:3001/api/health`
  - Should return `{ "status": "ok", "timestamp": "..." }`
- [ ] Market data endpoint works: `http://localhost:3001/api/market-data?symbol=NIFTY&timeframe=1D&limit=10`
  - Should return JSON with symbol, timeframe, and data array
  - Data should contain OHLC candles with time, open, high, low, close, volume

### WebSocket
- [ ] WebSocket server starts
- [ ] Connection message appears when client connects
- [ ] Price updates are sent every second

## Frontend Tests

### Server Startup
- [ ] Frontend starts without errors (`cd frontend && npm run dev`)
- [ ] Dev server runs on `http://localhost:5173`
- [ ] No compilation errors
- [ ] No TypeScript errors

### UI Components

#### Header
- [ ] Header displays "Algorithmic Trading Platform"
- [ ] Subtitle displays "Backtesting & Live Trading"
- [ ] Styling is correct (white background, border)

#### Trading Chart
- [ ] Chart component renders
- [ ] Candlestick chart displays with data
- [ ] Chart has proper dimensions (500px height)
- [ ] Timeframe buttons are visible (1m, 5m, 15m, 1H, 4H, 1D)
- [ ] Symbol input field displays "NIFTY"
- [ ] Green and red candles are visible
- [ ] Grid lines are visible

#### Chart Interactions
- [ ] Click different timeframe buttons
  - Chart should reload with new data
  - Selected button should be highlighted
- [ ] Change symbol in input field
  - Chart should update with new symbol
- [ ] Hover over chart
  - Crosshair appears
  - Price tooltip shows
- [ ] Resize browser window
  - Chart resizes responsively

#### Real-time Updates
- [ ] Open browser console
- [ ] Look for "WebSocket connected" message
- [ ] Watch chart for live candle updates (should update every second)
- [ ] Verify candles are moving/updating

#### Backtesting Panel

##### Configuration Section
- [ ] Configuration panel displays on the left
- [ ] Strategy dropdown shows options:
  - Moving Average Crossover
  - RSI Strategy
  - Bollinger Bands
  - MACD
- [ ] Symbol input works
- [ ] Start date picker works
- [ ] End date picker works
- [ ] Fast Period input accepts numbers
- [ ] Slow Period input accepts numbers
- [ ] Stop Loss input accepts decimals
- [ ] Take Profit input accepts decimals
- [ ] "Run Backtest" button is visible and clickable

##### Running Backtest
- [ ] Configure a strategy
- [ ] Click "Run Backtest" button
- [ ] Button changes to "Running..." and becomes disabled
- [ ] Loading spinner appears in results panel
- [ ] After 1-2 seconds, results appear

##### Results Display
- [ ] Results panel shows on the right (larger area)
- [ ] All 6 metric cards display:
  - Total Trades (number)
  - Win Rate (percentage in green)
  - Profit Factor (number)
  - Max Drawdown (percentage in red)
  - Net Profit (percentage in green)
  - Sharpe Ratio (number)
- [ ] Each metric card has:
  - Gray background
  - Label text
  - Large value text
  - Proper color coding
- [ ] Equity curve placeholder displays

### Styling Tests

#### Colors & Theme
- [ ] Background is light gray (#f9fafb or similar)
- [ ] Cards have white background
- [ ] Text is readable (proper contrast)
- [ ] Buttons have proper hover states
- [ ] Input fields have proper focus states

#### Responsive Layout
- [ ] Layout works on desktop (1920px)
- [ ] Layout works on laptop (1366px)
- [ ] Backtesting panel stacks on mobile (<768px)
- [ ] Chart is scrollable on small screens
- [ ] All text is readable at different sizes

## Integration Tests

### Frontend-Backend Communication
- [ ] Frontend successfully calls backend API
- [ ] No CORS errors in console
- [ ] Market data loads in chart
- [ ] Backtest results are received and displayed
- [ ] WebSocket connection is stable
- [ ] Real-time updates continue streaming

### Error Handling
- [ ] Start frontend without backend running
  - Should show connection error in console
  - UI should still render
- [ ] Enter invalid symbol
  - Chart should still attempt to load
- [ ] Submit backtest with invalid parameters
  - Should still submit and get results

## Performance Tests

- [ ] Chart renders in < 2 seconds
- [ ] Timeframe switching is instant
- [ ] Backtest completes in < 3 seconds
- [ ] No memory leaks (check browser dev tools)
- [ ] No excessive console warnings
- [ ] WebSocket doesn't lag or delay

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac)

## Production Readiness Checks

- [ ] No console.log statements (or minimal)
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] No compilation warnings
- [ ] Environment variables properly configured
- [ ] .env file is not committed (in .gitignore)
- [ ] README is accurate and complete

## Known Issues to Test

- [ ] Check if WebSocket reconnects after disconnect
- [ ] Verify chart cleanup on component unmount
- [ ] Test with very large datasets
- [ ] Test with rapid timeframe switching
- [ ] Test with multiple symbol changes

## Final Verification

- [ ] Application is ready for development
- [ ] Documentation is complete
- [ ] Code is properly structured
- [ ] All dependencies are installed
- [ ] Project can be handed off to another developer

---

## Test Results

**Date Tested**: _______________

**Tested By**: _______________

**Node Version**: _______________

**Browser**: _______________

**Overall Status**: ⬜ Pass / ⬜ Fail

**Notes**:
```
[Add any issues or observations here]
```

---

## Next Steps After Testing

If all tests pass:
1. ✅ Start building real features
2. ✅ Integrate Dhan API
3. ✅ Implement actual backtesting logic
4. ✅ Add more indicators and features

If tests fail:
1. ❌ Review error messages
2. ❌ Check console logs
3. ❌ Verify dependencies are installed
4. ❌ Ensure ports are not blocked
5. ❌ Check Node.js version compatibility
