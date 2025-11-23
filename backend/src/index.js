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

// Store captured headers by type
const headersStore = {
  getData: {},
  orders: {} // Future proofing
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Capture headers endpoint
app.post('/api/capture-headers/:type', (req, res) => {
  const { type } = req.params;
  const headers = req.body;

  if (!headersStore[type] && type !== 'getData') {
    headersStore[type] = {};
  }

  // Update headers for this type
  headersStore[type] = { ...headersStore[type], ...headers };

  console.log(`📥 Captured headers for ${type}:`, Object.keys(headers));
  res.json({ success: true, message: `Headers captured for ${type}` });
});

// Market data proxy endpoint
app.post('/api/getData', async (req, res) => {
  try {
    const payload = req.body;

    // Get stored headers for getData
    const capturedHeaders = headersStore['getData'] || {};

    // Check if we have critical auth headers
    const hasAuth = capturedHeaders.Auth || capturedHeaders.Authorization;
    if (!hasAuth) {
      console.warn('⚠️  No authentication headers found. Rejecting request to avoid 401.');
      return res.status(400).json({
        error: 'No authentication headers captured yet. Please refresh the Dhan page to capture headers.'
      });
    }

    // Construct headers for the real API call
    const headers = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Origin': 'https://tv-web.dhan.co',
      'Referer': 'https://tv-web.dhan.co/',
      ...capturedHeaders
    };

    // Log the full request being sent (truncate long tokens)
    console.log('\n🔄 Proxying request to Dhan...');
    console.log('📤 Request Payload:', JSON.stringify(payload, null, 2));
    console.log('📋 Request Headers:');
    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 50) {
        console.log(`   ${key}: ${value.substring(0, 50)}...`);
      } else {
        console.log(`   ${key}: ${value}`);
      }
    });

    const response = await fetch('https://ticks.dhan.co/getData', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Dhan API responded with ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Log truncated response
    const responsePreview = {
      success: data.success,
      dataKeys: data.data ? Object.keys(data.data) : [],
      dataLength: data.data?.t ? data.data.t.length : 0,
      firstTime: data.data?.Time?.[0],
      lastTime: data.data?.Time?.[data.data.Time?.length - 1]
    };
    console.log('✅ Received data from Dhan:', JSON.stringify(responsePreview));
    console.log('---\n');

    res.json(data);
  } catch (error) {
    console.error('❌ Error proxying to Dhan:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Legacy mock endpoint (kept for reference or fallback if needed)
app.get('/api/market-data-mock', (req, res) => {
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
