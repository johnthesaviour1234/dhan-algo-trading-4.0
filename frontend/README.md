# Dhan Algo Trading Frontend

A modern React-based frontend for algorithmic trading with backtesting and live trading capabilities.

## Features

- **Trading Chart**: Interactive candlestick chart powered by lightweight-charts
- **Backtesting Panel**: Test multiple trading strategies with historical data
- **Live Trading Panel**: Monitor and execute strategies in real-time
- **Strategy Management**: Add, remove, and compare multiple strategies
- **Performance Metrics**: View comprehensive metrics across different timeframes (daily, weekly, monthly, quarterly, yearly, overall)
- **Trade Execution Details**: Detailed trade history with indicators, P&L, and more

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **lightweight-charts** for financial charting
- **lucide-react** for icons
- **shadcn/ui** component library

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd "E:\warp projects\dhan algo trading 3.0\frontend"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

Create a production build:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── BacktestingPanel.tsx
│   │   ├── LiveTradingPanel.tsx
│   │   ├── MetricsDisplay.tsx
│   │   ├── StrategyCard.tsx
│   │   └── TradingChart.tsx
│   ├── lib/
│   │   └── utils.ts         # Utility functions
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Available Strategies

The application comes with 6 pre-configured trading strategies:

1. **SMA Crossover** - Trend following strategy using moving average crossovers
2. **RSI Mean Reversion** - Mean reversion strategy based on RSI indicator
3. **Breakout Strategy** - Momentum strategy based on price breakouts
4. **Bollinger Bands** - Volatility-based trading strategy
5. **MACD Strategy** - Trend following strategy using MACD indicator
6. **Pairs Trading** - Statistical arbitrage strategy

## Usage

### Backtesting

1. Select a date range for backtesting
2. Add one or more strategies by clicking on them
3. Click "Run Backtest" to execute
4. View combined portfolio performance and individual strategy metrics
5. Expand strategies to see detailed trade execution history

### Live Trading

1. Select strategies you want to run
2. Click "Start Live Trading"
3. Monitor real-time performance updates
4. Stop trading at any time

## Performance Metrics

Each strategy displays the following metrics across multiple timeframes:

- **Return**: Total percentage return
- **Sharpe Ratio**: Risk-adjusted return measure
- **Max Drawdown**: Maximum peak-to-trough decline
- **Win Rate**: Percentage of profitable trades
- **Total Trades**: Number of executed trades
- **Profit Factor**: Ratio of gross profit to gross loss

## Trade Details

For each trade, the following information is displayed:

- Entry and exit dates
- Signal type (Buy/Sell)
- Direction (Long/Short)
- Strategy-specific indicators
- Entry and exit prices
- Quantity
- Brokerage and slippage costs
- P&L (absolute and percentage)
- Trade duration

## Design System

The application uses a custom design system based on:

- Figma design specifications
- shadcn/ui component library
- Tailwind CSS utility classes
- Custom CSS variables for theming

## Future Enhancements

- Backend integration for real data
- Real-time WebSocket connections
- Custom strategy builder
- Advanced charting indicators
- Portfolio optimization tools
- Risk management features
- Export functionality for reports

## License

This project is private and proprietary.
