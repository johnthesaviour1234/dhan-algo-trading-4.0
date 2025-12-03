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
  orderFeed: {}, // WebSocket order feed headers  
  orderFeedHandshake: {}, // 703B handshake message
  priceFeedWeb: {}, // WebSocket price feed headers (NEW)
  priceFeedWebHandshake: {}, // 703B initialization message (NEW)
  priceFeedWebSubscriptions: {}, // Object of 129B subscription messages keyed by security ID (NEW)
  orders: {} // Future proofing
};

// Store access token for order placement
let accessToken = null;

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

  // Special handling for priceFeedWebSubscriptions - deduplicate by security ID
  const totalUnique = Object.keys(headersStore[type]).length;
  console.log(`📥 ${isNew ? 'New' : 'Updated'} subscription for security ID: ${securityId}`);
  console.log(`   Total unique subscriptions: ${totalUnique}`);

  return res.json({
    success: true,
    message: `Subscription for ${securityId} ${isNew ? 'added' : 'updated'}`,
    securityId: securityId,
    totalSubscriptions: totalUnique,
    isNew: isNew
  });
} catch (error) {
  console.error('❌ Error parsing subscription message:', error);
  // Fallback: store with timestamp if parsing fails
  const fallbackKey = `unknown_${Date.now()}`;
  headersStore[type][fallbackKey] = headers;
  return res.json({
    success: true,
    message: 'Subscription captured (parsing failed)',
    totalSubscriptions: Object.keys(headersStore[type]).length
  });
}
  }

// Special handling for handshakes - always replace with latest
if (type === 'priceFeedWebHandshake' || type === 'orderFeedHandshake') {
  headersStore[type] = headers; // Replace, don't merge
  console.log(`📥 Replaced ${type} with latest`);
  return res.json({ success: true, message: `${type} updated with latest` });
}

// Update headers for this type (normal behavior)
headersStore[type] = { ...headersStore[type], ...headers };

console.log(`📥 Captured headers for ${type}:`, Object.keys(headers));
res.json({ success: true, message: `Headers captured for ${type}` });
});

// Access token endpoints
app.post('/api/access-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token is required'
    });
  }

  accessToken = token;
  console.log('🔑 Access token stored');
  res.json({ success: true, message: 'Access token stored successfully' });
});

app.get('/api/access-token', (req, res) => {
  if (!accessToken) {
    return res.status(404).json({
      success: false,
      error: 'No access token stored'
    });
  }

  res.json({ success: true, token: accessToken });
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

// Order placement endpoint - Proxy to Dhan API
app.post('/api/orders', async (req, res) => {
  try {
    const orderPayload = req.body;

    // Get token from stored value or request header
    const token = accessToken || req.headers['access-token'];

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Access token required. Please set access token first.'
      });
    }

    console.log('\n📤 ===== PLACING ORDER =====');
    console.log('Order Payload:', JSON.stringify(orderPayload, null, 2));
    console.log('Using access token:', token.substring(0, 20) + '...');

    const response = await fetch('https://api.dhan.co/v2/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token
      },
      body: JSON.stringify(orderPayload)
    });
    const data = await response.json();

    // Check if Dhan API returned an error
    if (data.errorCode || data.errorType) {
      console.error('❌ Dhan API Error:', data.errorCode);
      console.error('   Error Type:', data.errorType);
      console.error('   Message:', data.errorMessage);
      console.log('===== END ORDER PLACEMENT =====\n');

      return res.status(400).json({
        success: false,
        error: data.errorMessage || 'Order placement failed',
        errorCode: data.errorCode,
        errorType: data.errorType,
        ...data
      });
    }

    console.log('✅ Order placed successfully');
    console.log('   Order ID:', data.orderId);
    console.log('   Status:', data.orderStatus);
    console.log('===== END ORDER PLACEMENT =====\n');

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('❌ Order placement error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Order by ID - Fetch single order details
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const token = accessToken || req.headers['access-token'];

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Access token not found'
      });
    }

    console.log(`\n📥 ===== FETCHING ORDER ${orderId} =====`);

    const response = await fetch(`https://api.dhan.co/v2/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token
      }
    });

    const order = await response.json();

    console.log('Response status:', response.status);

    if (!response.ok) {
      console.error('❌ Failed to fetch order:', order);
      return res.status(response.status).json({
        success: false,
        error: order.errorMessage || 'Failed to fetch order'
      });
    }

    console.log('✅ Order fetched successfully');
    console.log('Order Status:', order.orderStatus);
    console.log('Filled Qty:', order.filledQty, '/', order.quantity);
    console.log('===== END ORDER FETCH =====\n');

    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('❌ Order fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Order by Correlation ID - Backup lookup method
app.get('/api/orders/correlation/:correlationId', async (req, res) => {
  try {
    const { correlationId } = req.params;
    const token = accessToken || req.headers['access-token'];

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Access token not found'
      });
    }

    console.log(`\n📥 ===== FETCHING ORDER BY CORRELATION ID: ${correlationId} =====`);

    const response = await fetch(`https://api.dhan.co/v2/orders/external/${encodeURIComponent(correlationId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token
      }
    });

    const order = await response.json();

    console.log('Response status:', response.status);

    if (!response.ok) {
      console.error('❌ Failed to fetch order by correlation ID:', order);
      return res.status(response.status).json({
        success: false,
        error: order.errorMessage || 'Failed to fetch order'
      });
    }

    console.log('✅ Order fetched by correlation ID');
    console.log('Order Status:', order.orderStatus);
    console.log('Filled Qty:', order.filledQty, '/', order.quantity);
    console.log('===== END ORDER FETCH =====\n');

    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('❌ Order fetch by correlation ID error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Order Book - Fetch all orders from Dhan
app.get('/api/orders', async (req, res) => {
  try {
    const token = accessToken || req.headers['access-token'];

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Access token not found'
      });
    }

    console.log('\n📥 ===== FETCHING ORDER BOOK =====');
    console.log('Using access token:', token.substring(0, 20) + '...');

    const response = await fetch('https://api.dhan.co/v2/orders', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token
      }
    });

    const orders = await response.json();

    console.log('Response status:', response.status);
    console.log('Orders count:', Array.isArray(orders) ? orders.length : 'N/A');

    if (!response.ok) {
      console.error('❌ Failed to fetch order book:', orders);
      return res.status(response.status).json({
        success: false,
        error: orders.errorMessage || 'Failed to fetch orders'
      });
    }

    console.log('✅ Order book fetched successfully');
    console.log('===== DHAN API RESPONSE DETAILS =====');
    console.log('Response Type:', typeof orders);
    console.log('Is Array:', Array.isArray(orders));

    if (Array.isArray(orders) && orders.length > 0) {
      console.log('\n📊 SAMPLE ORDER DATA (First Order):');
      console.log(JSON.stringify(orders[0], null, 2));

      console.log('\n📋 ORDER FIELDS PRESENT:');
      const sampleFields = Object.keys(orders[0]);
      console.log('Fields:', sampleFields.join(', '));
      console.log('Total fields:', sampleFields.length);

      console.log('\n📦 ALL ORDERS DATA:');
      orders.forEach((order, index) => {
        console.log(`\nOrder #${index + 1}:`, JSON.stringify(order, null, 2));
      });
    } else if (!Array.isArray(orders)) {
      console.log('\n⚠️ Response is not an array, full response:');
      console.log(JSON.stringify(orders, null, 2));
    } else {
      console.log('\n📭 No orders found (empty array)');
    }

    console.log('===== END DHAN API RESPONSE =====\n');


    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('❌ Order book fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

// WebSocket Server for Order Feed Proxy
const wss = new WebSocketServer({ noServer: true });

// WebSocket Server for Price Feed Proxy (NEW)
const priceFeedWss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  console.log('📡 WebSocket upgrade request:', request.url);

  if (request.url === '/ws/orderFeed') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (request.url === '/ws/priceFeed') {
    priceFeedWss.handleUpgrade(request, socket, head, (ws) => {
      priceFeedWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle WebSocket connections
wss.on('connection', async (frontendWs) => {
  console.log('🔌 Frontend connected to order feed proxy');

  let dhanWs = null;

  try {
    // Get stored headers and handshake from chrome extension captures
    const orderFeedData = headersStore.orderFeed;
    const handshakeData = headersStore.orderFeedHandshake;

    console.log('📋 Order feed data:', orderFeedData ? 'Available' : 'Missing');
    console.log('📋 Handshake data:', handshakeData ? 'Available' : 'Missing');

    if (!orderFeedData || !orderFeedData.url) {
      const errorMsg = {
        error: 'No order feed data captured. Please visit https://web.dhan.co/index/orders/Today first.'
      };
      console.error('❌', errorMsg.error);
      frontendWs.send(JSON.stringify(errorMsg));
      frontendWs.close();
      return;
    }

    if (!handshakeData || !handshakeData.message) {
      const errorMsg = {
        error: 'No handshake message captured. Please refresh the Dhan orders page.'
      };
      console.error('❌', errorMsg.error);
      frontendWs.send(JSON.stringify(errorMsg));
      frontendWs.close();
      return;
    }

    // Import WebSocket client (dynamic import since we're using ES modules)
    const WebSocket = (await import('ws')).default;

    console.log('🔗 Connecting to Dhan:', orderFeedData.url);
    console.log('📋 WebSocket Connection Details:');
    console.log('   URL:', orderFeedData.url);
    console.log('   Host:', orderFeedData.host);
    console.log('   Origin:', orderFeedData.origin);
    console.log('   User-Agent:', orderFeedData.userAgent || 'Mozilla/5.0');
    console.log('   Query Params:', orderFeedData.queryParams);

    // Connect to real Dhan WebSocket with proper headers
    dhanWs = new WebSocket(orderFeedData.url, {
      headers: {
        'Host': orderFeedData.host,
        'Origin': orderFeedData.origin,
        'User-Agent': orderFeedData.userAgent || 'Mozilla/5.0'
      }
    });

    console.log('✅ WebSocket object created, waiting for connection...');

    // Handle Dhan connection open
    dhanWs.on('open', () => {
      console.log('✅ Connected to Dhan order feed');

      // Send 703B handshake message to Dhan
      try {
        const handshakeBuffer = Buffer.from(handshakeData.message, 'base64');
        dhanWs.send(handshakeBuffer);
        console.log('📨 Sent 703B handshake to Dhan');

        // Notify frontend that connection is ready
        frontendWs.send(JSON.stringify({
          type: 'connection_ready',
          message: 'Connected to order feed'
        }));
        console.log('📤 Sent connection_ready message to frontend');
      } catch (error) {
        console.error('❌ Error sending handshake:', error);
      }
    });

    // Forward messages from Dhan to frontend
    dhanWs.on('message', (data) => {
      try {
        console.log('\n📥 ===== MESSAGE FROM DHAN =====');
        console.log('   Data type:', typeof data);
        console.log('Data length:', data.length || data.byteLength);
        console.log('   Frontend WS state:', frontendWs.readyState, '(1=OPEN, 2=CLOSING, 3=CLOSED)');

        // Check if frontend connection is still open
        if (frontendWs.readyState === 1) { // WebSocket.OPEN = 1
          // Log message content
          if (data.length === 0) {
            console.log('   Content: <empty heartbeat>');
          } else {
            try {
              const parsed = JSON.parse(data.toString());
              const preview = JSON.stringify(parsed, null, 2).substring(0, 300);
              console.log('   Content (JSON):', preview + '...');
              if (parsed.Type === 'order_alert') {
                console.log('   📊 Order Alert:', parsed.Data?.symbol, parsed.Data?.status);
              }
            } catch (e) {
              console.log('   Content (Binary):', data.length, 'bytes');
              console.log('   First 50 bytes:', data.slice(0, 50));
            }
          }

          // Forward the message as-is (binary or text)
          frontendWs.send(data);
          console.log('   ✅ Message forwarded to frontend');
        } else {
          console.log('   ⚠️ Frontend not connected, message NOT forwarded');
          console.log('   Frontend state:', frontendWs.readyState);
        }
        console.log('===== END MESSAGE =====\n');
      } catch (error) {
        console.error('❌ Error forwarding message to frontend:', error);
        console.error('   Error stack:', error.stack);
      }
    });

    // Forward messages from frontend to Dhan (e.g., heartbeats)
    frontendWs.on('message', (data) => {
      try {
        console.log('\n📤 ===== MESSAGE FROM FRONTEND =====');
        console.log('   Data type:', typeof data);
        console.log('   Data length:', data.length || data.byteLength);
        console.log('   Dhan WS state:', dhanWs ? dhanWs.readyState : 'null', '(1=OPEN)');

        if (dhanWs && dhanWs.readyState === 1) { // WebSocket.OPEN = 1
          dhanWs.send(data);

          if (data.length === 0 || (typeof data === 'string' && data === '')) {
            console.log('   Content: <heartbeat>');
            console.log('   ✅ Heartbeat forwarded to Dhan');
          } else {
            console.log('   Content:', data.toString().substring(0, 200));
            console.log('   ✅ Message forwarded to Dhan:', data.length, 'bytes');
          }
        } else {
          console.log('   ⚠️ Dhan not connected, message NOT forwarded');
        }
        console.log('===== END MESSAGE =====\n');
      } catch (error) {
        console.error('❌ Error forwarding message to Dhan:', error);
        console.error('   Error stack:', error.stack);
      }
    });

    // Handle Dhan connection close
    dhanWs.on('close', (code, reason) => {
      console.log('🔒 Dhan connection closed:', code, reason.toString());
      if (frontendWs.readyState === 1) {
        frontendWs.close();
      }
    });

    // Handle frontend connection close
    frontendWs.on('close', () => {
      console.log('🔒 Frontend connection closed');
      if (dhanWs && dhanWs.readyState === 1) {
        dhanWs.close();
      }
    });

    // Handle Dhan connection errors
    dhanWs.on('error', (error) => {
      console.error('❌ Dhan WebSocket error:', error.message);
      if (frontendWs.readyState === 1) {
        frontendWs.send(JSON.stringify({
          error: `Dhan connection error: ${error.message}`
        }));
      }
    });

    // Handle frontend connection errors
    frontendWs.on('error', (error) => {
      console.error('❌ Frontend WebSocket error:', error.message);
    });

  } catch (error) {
    console.error('❌ Error setting up order feed proxy:', error);
    if (frontendWs.readyState === 1) {
      frontendWs.send(JSON.stringify({
        error: `Proxy setup error: ${error.message}`
      }));
    }
    frontendWs.close();
    if (dhanWs && dhanWs.readyState === 1) {
      dhanWs.close();
    }
  }
});

console.log('✅ WebSocket server ready on ws://localhost:' + PORT + '/ws/orderFeed');

// Handle Price Feed WebSocket connections (NEW)
priceFeedWss.on('connection', async (frontendWs) => {
  console.log('🔌 Frontend connected to price feed proxy');

  let dhanWs = null;

  try {
    // Get stored headers and messages from chrome extension captures
    const priceFeedData = headersStore.priceFeedWeb;
    const handshakeData = headersStore.priceFeedWebHandshake;
    const subscriptions = headersStore.priceFeedWebSubscriptions;

    console.log('📋 Price feed data:', priceFeedData ? 'Available' : 'Missing');
    console.log('📋 Handshake data:', handshakeData ? 'Available' : 'Missing');
    console.log('📋 Subscriptions:', subscriptions ? `${Object.keys(subscriptions).length} unique securities` : 'Missing');

    if (!priceFeedData || !priceFeedData.fullUrl) {
      const errorMsg = {
        error: 'No price feed data captured. Please visit https://web.dhan.co first to capture WebSocket connection.'
      };
      console.error('❌', errorMsg.error);
      frontendWs.send(JSON.stringify(errorMsg));
      frontendWs.close();
      return;
    }

    if (!handshakeData || !handshakeData.message) {
      const errorMsg = {
        error: 'No handshake message (703B) captured. Please refresh Dhan page.'
      };
      console.error('❌', errorMsg.error);
      frontendWs.send(JSON.stringify(errorMsg));
      frontendWs.close();
      return;
    }

    // Import WebSocket client
    const WebSocket = (await import('ws')).default;

    console.log('\n🔗 ===== CONNECTING TO DHAN PRICE FEED =====');
    console.log('📍 URL:', priceFeedData.fullUrl);
    console.log('📋 WebSocket Connection Headers:');
    console.log('   Host:', priceFeedData.Host || 'price-feed-web.dhan.co');
    console.log('   Origin:', priceFeedData.Origin || 'https://web.dhan.co');
    console.log('   User-Agent:', (priceFeedData['User-Agent'] || '').substring(0, 50) + '...');
    console.log('   Sec-WebSocket-Version:', priceFeedData['Sec-WebSocket-Version']);
    console.log('   Sec-WebSocket-Extensions:', priceFeedData['Sec-WebSocket-Extensions']);
    console.log('===== END CONNECTION DETAILS =====\n');

    // Connect to real Dhan WebSocket with proper headers
    dhanWs = new WebSocket(priceFeedData.fullUrl, {
      headers: {
        'Host': priceFeedData.Host || 'price-feed-web.dhan.co',
        'Origin': priceFeedData.Origin || 'https://web.dhan.co',
        'User-Agent': priceFeedData['User-Agent'] || 'Mozilla/5.0',
        'Sec-WebSocket-Version': priceFeedData['Sec-WebSocket-Version'] || '13',
        'Sec-WebSocket-Extensions': priceFeedData['Sec-WebSocket-Extensions'] || ''
      }
    });

    dhanWs.binaryType = 'arraybuffer';
    console.log('✅ WebSocket object created, waiting for connection...');

    // Handle Dhan connection open
    dhanWs.on('open', () => {
      console.log('✅ Connected to Dhan price feed');

      // Send 703B handshake message to Dhan
      try {
        const handshakeBuffer = Buffer.from(handshakeData.message, 'base64');
        dhanWs.send(handshakeBuffer);
        console.log('📨 Sent 703B handshake to Dhan');
        console.log('   Length:', handshakeBuffer.length, 'bytes');
        console.log('   Base64 preview:', handshakeData.message.substring(0, 50) + '...');

        // Send all subscription messages (129B each)
        const subscriptionsList = Object.values(subscriptions);
        if (subscriptionsList && subscriptionsList.length > 0) {
          console.log(`📨 Sending ${subscriptionsList.length} unique subscription messages...`);
          subscriptionsList.forEach((sub, index) => {
            const subBuffer = Buffer.from(sub.message, 'base64');
            dhanWs.send(subBuffer);
            console.log(`   ✅ Subscription #${index + 1}:`, subBuffer.length, 'bytes');
          });
          console.log(`✅ All ${subscriptionsList.length} subscriptions sent successfully`);
        } else {
          console.warn('⚠️ No subscription messages found. Price feed will not receive updates.');
        }

        // Notify frontend that connection is ready
        frontendWs.send(JSON.stringify({
          type: 'connection_ready',
          message: 'Connected to price feed',
          subscriptions: subscriptionsList ? subscriptionsList.length : 0
        }));
        console.log('📤 Sent connection_ready message to frontend');
      } catch (error) {
        console.error('❌ Error sending handshake/subscriptions:', error);
      }
    });

    // Forward messages from Dhan to frontend (BINARY)
    dhanWs.on('message', (data) => {
      try {
        const dataLength = data.length || data.byteLength;

        // Skip heartbeat messages
        if (dataLength === 1) {
          console.log('💓 Heartbeat received from Dhan');
          return;
        }

        console.log('\n📥 ===== MESSAGE FROM DHAN =====');
        console.log('   Data type:', data instanceof Buffer ? 'Buffer' : typeof data);
        console.log('   Data length:', dataLength, 'bytes');
        console.log('   Frontend WS state:', frontendWs.readyState, '(1=OPEN)');

        // Check if frontend connection is still open
        if (frontendWs.readyState === 1) { // WebSocket.OPEN = 1
          // Forward the binary message as-is
          frontendWs.send(data);
          console.log('   ✅ Binary message forwarded to frontend');
        } else {
          console.log('   ⚠️ Frontend not connected, message NOT forwarded');
        }
        console.log('===== END MESSAGE =====\n');
      } catch (error) {
        console.error('❌ Error forwarding message to frontend:', error);
        console.error('   Error stack:', error.stack);
      }
    });

    // Forward messages from frontend to Dhan (e.g., heartbeats)
    frontendWs.on('message', (data) => {
      try {
        if (dhanWs && dhanWs.readyState === 1) { // WebSocket.OPEN = 1
          dhanWs.send(data);

          if (data.length === 0 || (typeof data === 'string' && data === '')) {
            console.log('💓 Heartbeat forwarded to Dhan from frontend');
          } else {
            console.log('📤 Message forwarded to Dhan:', data.length, 'bytes');
          }
        }
      } catch (error) {
        console.error('❌ Error forwarding message to Dhan:', error);
      }
    });

    // Handle Dhan connection close
    dhanWs.on('close', (code, reason) => {
      console.log('🔒 Dhan price feed connection closed:', code, reason.toString());
      if (frontendWs.readyState === 1) {
        frontendWs.close();
      }
    });

    // Handle frontend connection close
    frontendWs.on('close', () => {
      console.log('🔒 Frontend price feed connection closed');
      if (dhanWs && dhanWs.readyState === 1) {
        dhanWs.close();
      }
    });

    // Handle Dhan connection errors
    dhanWs.on('error', (error) => {
      console.error('❌ Dhan price feed WebSocket error:', error.message);
      if (frontendWs.readyState === 1) {
        frontendWs.send(JSON.stringify({
          error: `Dhan connection error: ${error.message}`
        }));
      }
    });

    // Handle frontend connection errors
    frontendWs.on('error', (error) => {
      console.error('❌ Frontend price feed WebSocket error:', error.message);
    });

  } catch (error) {
    console.error('❌ Error setting up price feed proxy:', error);
    if (frontendWs.readyState === 1) {
      frontendWs.send(JSON.stringify({
        error: `Proxy setup error: ${error.message}`
      }));
    }
    frontendWs.close();
    if (dhanWs && dhanWs.readyState === 1) {
      dhanWs.close();
    }
  }
});

console.log('✅ WebSocket server ready on ws://localhost:' + PORT + '/ws/priceFeed');

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
