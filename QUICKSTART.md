# Quick Start Guide

## Fast Start (Recommended)

Run this single command to start both servers:

```powershell
.\start-dev.ps1
```

This will open two terminal windows:
- Backend server on http://localhost:3001
- Frontend server on http://localhost:5173

## Manual Start

If you prefer to start servers manually:

### 1. Start Backend
```powershell
cd backend
npm run dev
```

### 2. Start Frontend (in a new terminal)
```powershell
cd frontend
npm run dev
```

## First Time Setup

If this is your first time running the project, make sure you've installed dependencies:

```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Important Notes

- **Node.js Version**: You need Node.js v20.19+ or v22.12+ for the frontend to work properly
- The backend runs on port **3001**
- The frontend runs on port **5173**
- WebSocket connection is on **ws://localhost:3001**

## What You'll See

1. **Chart Interface**: 
   - Interactive TradingView candlestick chart
   - Multiple timeframe selection (1m, 5m, 15m, 1H, 4H, 1D)
   - Symbol input field
   - Real-time price updates via WebSocket

2. **Backtesting Panel**:
   - Strategy selection dropdown
   - Date range selector
   - Parameter configuration
   - Results display with key metrics

## Testing the Application

1. Open http://localhost:5173 in your browser
2. The chart should load with NIFTY data
3. Try switching timeframes using the buttons
4. Configure a backtest strategy and click "Run Backtest"
5. View the results including win rate, profit factor, etc.

## Troubleshooting

### Backend won't start
- Check if port 3001 is available
- Verify all dependencies are installed: `npm install`

### Frontend won't start
- Check Node.js version: `node --version`
- Should be v20.19+ or v22.12+
- Check if port 5173 is available

### Chart not loading
- Ensure backend is running
- Check browser console for errors
- Verify WebSocket connection

### Cannot connect to WebSocket
- Ensure backend server is running
- Check if firewall is blocking port 3001

## Next Steps

After verifying everything works:

1. Explore the code structure
2. Customize chart styling in `TradingChart.tsx`
3. Add new strategies in `BacktestingPanel.tsx`
4. Integrate real market data from Dhan API
5. Implement actual backtesting logic

## Need Help?

Check the main README.md for more detailed information about:
- Project structure
- API endpoints
- Available features
- Development guidelines
