import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Market data endpoint (placeholder)
app.get('/api/market-data', (req, res) => {
  const { symbol = 'NIFTY', timeframe = '1D', limit = 100 } = req.query;
  
  // Generate mock OHLC data
  const data = generateMockOHLC(parseInt(limit));
  
  res.json({
    symbol,
    timeframe,
    data
  });
});

// Backtest endpoint (placeholder)
app.post('/api/backtest', (req, res) => {
  const { strategy, parameters, symbol, startDate, endDate } = req.body;
  
  // Mock backtest results
  res.json({
    success: true,
    results: {
      totalTrades: 45,
      winRate: 62.5,
      profitFactor: 1.85,
      maxDrawdown: -8.2,
      netProfit: 15.6,
      sharpeRatio: 1.42
    },
    equity: generateMockEquityCurve(100)
  });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});

// WebSocket server for real-time data
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📡 Client connected to WebSocket');
  
  // Send initial connection message
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  
  // Simulate real-time price updates
  const priceInterval = setInterval(() => {
    const mockPrice = {
      type: 'price-update',
      symbol: 'NIFTY',
      time: Date.now() / 1000,
      open: 19500 + Math.random() * 100,
      high: 19600 + Math.random() * 100,
      low: 19400 + Math.random() * 100,
      close: 19550 + Math.random() * 100,
      volume: Math.floor(Math.random() * 100000)
    };
    
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(mockPrice));
    }
  }, 1000);
  
  ws.on('close', () => {
    console.log('📴 Client disconnected from WebSocket');
    clearInterval(priceInterval);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(priceInterval);
  });
});

// Helper function to generate mock OHLC data
function generateMockOHLC(count) {
  const data = [];
  let basePrice = 19500;
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = count - 1; i >= 0; i--) {
    const time = now - (i * 24 * 60 * 60); // Daily bars
    const open = basePrice + (Math.random() - 0.5) * 100;
    const close = open + (Math.random() - 0.5) * 150;
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;
    
    data.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000)
    });
    
    basePrice = close;
  }
  
  return data;
}

// Helper function to generate mock equity curve
function generateMockEquityCurve(count) {
  const equity = [];
  let value = 100000;
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 0; i < count; i++) {
    value += (Math.random() - 0.45) * 500; // Slight upward bias
    equity.push({
      time: now - ((count - i) * 24 * 60 * 60),
      value: parseFloat(value.toFixed(2))
    });
  }
  
  return equity;
}
