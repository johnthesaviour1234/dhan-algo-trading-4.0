# Algorithmic Trading Platform

A full-stack algorithmic trading platform with backtesting capabilities and live trading support.

## Features

- **TradingView Lightweight Charts** - Professional candlestick charts with real-time updates
- **Multiple Timeframes** - 1m, 5m, 15m, 1H, 4H, 1D support
- **Backtesting Engine** - Test your strategies on historical data
- **Real-time Data** - WebSocket connection for live price updates
- **Strategy Configuration** - Configurable parameters for different trading strategies
- **Performance Metrics** - Win rate, profit factor, Sharpe ratio, max drawdown

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- TradingView Lightweight Charts
- Tailwind CSS
- shadcn/ui components

### Backend
- Node.js + Express
- WebSocket (ws)
- REST API

## Getting Started

### Prerequisites
- Node.js v20.19+ or v22.12+ (required for Vite)
- npm or yarn

### Installation

1. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   Backend will run on `http://localhost:3001`

2. **Start Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

3. **Open your browser**
   Navigate to `http://localhost:5173`

## Project Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TradingChart.tsx      # Main chart component
│   │   │   ├── BacktestingPanel.tsx  # Backtest configuration & results
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── styles/
│   │   │   └── globals.css           # Global styles with design tokens
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── tailwind.config.js
│
└── backend/
    ├── src/
    │   └── index.js                  # Express server with WebSocket
    ├── package.json
    └── .env.example

```

## API Endpoints

### REST API

- `GET /api/health` - Health check endpoint
- `GET /api/market-data?symbol=NIFTY&timeframe=1D&limit=100` - Get historical OHLC data
- `POST /api/backtest` - Run backtest with strategy configuration

### WebSocket

- `ws://localhost:3001` - Real-time price updates

## Strategy Architecture (Updated 2025-12-12)

The project uses an **isolated strategy architecture** where each strategy is self-contained.

```
frontend/src/strategies/
├── BaseStrategy.ts           # Interface all strategies implement
├── README.md                 # Developer documentation
├── index.ts                  # Strategy exports
└── EMA_3_15_Simple/          # Example isolated strategy
    ├── index.ts              # Strategy implementation
    └── types.ts              # Strategy-specific types
```

**Current Strategies:**
| Strategy | Type | Version |
|----------|------|---------|
| EMA 3/15 Simple | Crossover | 1.0.0 |

**Adding New Strategies:**
1. Read `frontend/src/strategies/README.md`
2. Create folder `strategies/[NEW_STRATEGY]/`
3. Implement `BaseStrategy` interface
4. Define strategy-specific analytics and export format

See [Strategy README](frontend/src/strategies/README.md) for detailed documentation.

## Configuration

### Customizing the Chart

The TradingView Lightweight Charts configuration can be modified in `TradingChart.tsx`:
- Colors (upColor, downColor)
- Grid styling
- Timeframes
- Technical indicators

## Notes

- Current implementation uses mock data
- Backend generates random OHLC data for demonstration
- Real market data integration will be added in future updates
- Dhan API integration pending

## Next Steps

1. Integrate real market data from Dhan API
2. Implement actual strategy backtesting logic
3. Add more technical indicators to charts
4. Add trade execution capabilities
5. Database integration for strategy persistence
6. User authentication and portfolio management

## License

MIT
