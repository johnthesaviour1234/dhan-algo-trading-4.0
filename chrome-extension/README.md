# Dhan WebSocket Header Capturer

Chrome extension to capture WebSocket connection headers and messages from Dhan's price feed and order feed.

## Purpose
Captures WebSocket headers and handshake messages from Dhan and forwards them to a local backend server for algorithmic trading.

## Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## Usage

### For Price Feed WebSocket (Recommended)
**Visit this specific URL for the cleanest capture:**
```
https://web.dhan.co/Charts?exch=NSE&seg=E&secid=14366
```

**Why this URL?**
- Creates only ONE WebSocket connection for price-feed
- Avoids duplicate subscriptions from multiple connections
- Cleaner data capture

**What it captures:**
- WebSocket connection headers
- 703B handshake message
- 129B subscription messages (unique by security ID)

### For Order Feed WebSocket
Visit any orders page:
```
https://web.dhan.co/index/orders/Today
```

## How It Works

1. **Background Script** (`background.js`):
   - Intercepts HTTP requests via `webRequest.onBeforeSendHeaders`
   - Captures headers for WebSocket upgrade requests
   - Sends headers to backend at `http://localhost:3001`

2. **Content Script** (`content.js`):
   - Runs in MAIN world (page context)
   - Overrides `window.WebSocket` constructor
   - Intercepts WebSocket connections to:
     - `order-feed.dhan.co` (order updates)
     - `price-feed-web.dhan.co` (price updates)
   - Captures outgoing messages (handshake and subscriptions)
   - Sends captured data to backend

3. **Captured Data**:
   - **priceFeedWeb**: Connection headers
   - **priceFeedWebHandshake**: 703B initialization message
   - **priceFeedWebSubscriptions**: Object of 129B messages keyed by security ID
   - **orderFeed**: Connection headers for order feed
   - **orderFeedHandshake**: 703B message for orders

## Backend Integration

The extension sends captured data to:
```
POST http://localhost:3001/api/capture-headers/:type
```

Types:
- `priceFeedWeb` - Price feed connection headers
- `priceFeedWebHandshake` - 703B handshake
- `priceFeedWebSubscriptions` - 129B subscriptions (deduplicated by security ID)
- `orderFeed` - Order feed connection headers
- `orderFeedHandshake` - 703B order handshake

## Console Logs

When working correctly, you'll see:
```javascript
🔧 Dhan WebSocket Interceptor: Script loaded in MAIN world
🚀 WebSocket constructor called: wss://price-feed-web.dhan.co/
✨ PRICE FEED WEBSOCKET DETECTED!
📍 URL: wss://price-feed-web.dhan.co/
📡 Sent connection metadata to backend
📨 Intercepted 703B handshake message
📨 Intercepted 129B subscription for security: 14366
```

## Permissions

- **webRequest**: Intercept WebSocket upgrade requests
- **declarativeNetRequest**: Modify request headers
- **storage**: Store captured data
- **host_permissions**: 
  - `https://*.dhan.co/*` (Dhan website)
  - `http://localhost:3001/*` (Backend server)

## File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (intercepts requests)
├── content.js            # Content script (overrides WebSocket)
└── README.md             # This file
```

## Troubleshooting

**Extension not capturing:**
1. Make sure backend is running: `cd backend && npm run dev`
2. Check console for errors: F12 → Console tab
3. Verify you're on the correct URL (Charts page)
4. Reload the extension: chrome://extensions → Reload icon

**Multiple subscriptions:**
- Visit the specific chart URL above (not other Dhan pages)
- Other pages create multiple WebSocket connections
- Backend deduplicates by security ID automatically

**No WebSocket detected:**
- Ensure you're visiting the Charts page for price feed
- Check console logs for "WebSocket constructor called"
- Verify extension is enabled and active

## Development

To modify:
1. Edit `background.js` or `content.js`
2. Go to `chrome://extensions`
3. Click reload icon on the extension
4. Refresh the Dhan page

## Security Notes

- Extension only captures headers, not authentication tokens
- Data is sent to localhost only (not external servers)
- Runs in isolated MAIN world for clean WebSocket interception
