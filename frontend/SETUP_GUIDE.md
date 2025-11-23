# Frontend Setup Guide

## Quick Start (Windows)

The easiest way to get started is to use the provided batch scripts:

### Option 1: Using Batch Scripts

1. **Setup (First Time Only)**
   - Double-click `setup.bat` in the frontend folder
   - This will install all dependencies
   - Wait for the installation to complete

2. **Run Development Server**
   - Double-click `run-dev.bat`
   - The browser should open automatically at http://localhost:5173
   - If not, manually open your browser and navigate to http://localhost:5173

### Option 2: Using Command Line

If you prefer using the command line or if the batch scripts don't work:

1. **Open Command Prompt or PowerShell**
   ```
   Right-click on Windows Start Menu → Choose "Terminal" or "Command Prompt"
   ```

2. **Navigate to Frontend Directory**
   ```cmd
   cd "E:\warp projects\dhan algo trading 3.0\frontend"
   ```

3. **Install Dependencies**
   ```cmd
   npm install
   ```

4. **Start Development Server**
   ```cmd
   npm run dev
   ```

5. **Open Browser**
   - Navigate to http://localhost:5173

## Troubleshooting

### PowerShell Execution Policy Error

If you see an error about execution policies when running npm commands in PowerShell:

**Solution 1: Use Command Prompt instead**
- Open Command Prompt (cmd) instead of PowerShell
- Run the commands there

**Solution 2: Use the batch scripts**
- The batch scripts will work regardless of PowerShell policies

**Solution 3: Temporarily bypass the policy (Admin required)**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Node.js Not Found

If you get an error that npm or node is not found:

1. Install Node.js from https://nodejs.org/ (LTS version recommended)
2. Restart your terminal/command prompt
3. Try the commands again

### Port Already in Use

If port 5173 is already in use:

1. The terminal will show an error
2. Vite will automatically try the next available port (5174, 5175, etc.)
3. Check the terminal output for the actual port number

### Dependency Installation Fails

If `npm install` fails:

1. Clear npm cache:
   ```cmd
   npm cache clean --force
   ```

2. Delete `node_modules` folder (if it exists):
   ```cmd
   rmdir /s /q node_modules
   ```

3. Try installing again:
   ```cmd
   npm install
   ```

## What's Included

### Project Structure
```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui library components
│   │   ├── BacktestingPanel.tsx
│   │   ├── LiveTradingPanel.tsx
│   │   ├── MetricsDisplay.tsx
│   │   ├── StrategyCard.tsx
│   │   └── TradingChart.tsx
│   ├── lib/
│   │   └── utils.ts        # Helper utilities
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── index.html              # HTML template
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS config
├── tsconfig.json           # TypeScript config
├── setup.bat               # Setup script (Windows)
└── run-dev.bat            # Run script (Windows)
```

### Key Features Implemented

1. **Trading Chart**
   - Interactive candlestick chart using lightweight-charts
   - Historical price data visualization
   - Responsive design

2. **Backtesting Panel**
   - Date range selection
   - Multiple strategy selection
   - Run backtests with mock data
   - Combined portfolio metrics
   - Individual strategy breakdown
   - Detailed trade execution history

3. **Live Trading Panel**
   - Real-time strategy monitoring (simulated)
   - Live performance updates
   - Start/Stop trading controls
   - Combined and individual metrics

4. **6 Pre-configured Strategies**
   - SMA Crossover
   - RSI Mean Reversion
   - Breakout Strategy
   - Bollinger Bands
   - MACD Strategy
   - Pairs Trading

5. **Performance Metrics**
   - Return percentage
   - Sharpe Ratio
   - Max Drawdown
   - Win Rate
   - Total Trades
   - Profit Factor
   - Across 6 timeframes: Daily, Weekly, Monthly, Quarterly, Yearly, Overall

6. **UI Components**
   - Full shadcn/ui component library included
   - Tailwind CSS for styling
   - Responsive design
   - Professional trading interface

## Next Steps

### Current State
- ✅ Frontend fully set up
- ✅ All components from Figma design implemented
- ✅ Mock data for testing
- ✅ Responsive UI
- ❌ Backend integration (pending)

### To Add Backend Integration

When you're ready to connect to the backend:

1. **Update API endpoints in components**
   - Replace mock data generation with actual API calls
   - Add fetch/axios for HTTP requests

2. **Add WebSocket for live updates**
   - Real-time price data
   - Live trading updates
   - Strategy execution notifications

3. **Environment variables**
   - Create `.env` file for API URLs
   - Add backend URL configuration

4. **Authentication**
   - Add login/signup flows
   - Token management
   - Protected routes

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run lint
```

## Browser Compatibility

The application works best in modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Support

For any issues or questions:
1. Check the troubleshooting section above
2. Review the README.md for feature documentation
3. Inspect browser console for errors (F12 in most browsers)

## Notes

- The application currently uses mock/simulated data
- All trades and metrics are randomly generated for demonstration
- Backend integration is required for real trading functionality
- The design exactly matches the Figma specifications provided
