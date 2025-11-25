// Store the latest headers
let capturedHeaders = {};

console.log("🔧 Dhan Header Capturer: Service Worker Loaded");
console.log("📍 Monitoring URLs: https://*.dhan.co/*");

// Listen for requests to the target URL
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Log all requests to any dhan.co subdomain for debugging
        if (details.url.includes('dhan.co')) {
            console.log('🌐 Request detected:', details.url);
        }

        // Handle getData API requests (existing logic)
        if (details.url.includes('/getData')) {
            const headers = {};
            details.requestHeaders.forEach((header) => {
                headers[header.name] = header.value;
            });

            // Filter for specific headers we need
            const payload = {};

            // We'll just capture all relevant ones or specific ones
            // The user request showed: Auth, Authorization, Bid, Cid

            details.requestHeaders.forEach(h => {
                if (['Auth', 'Authorization', 'Bid', 'Cid', 'Security-Token', 'Src', 'Host', 'Origin', 'Referer'].includes(h.name)) {
                    payload[h.name] = h.value;
                }
            });

            console.log('📊 Captured getData Headers:', payload);

            // Send to local backend
            fetch('http://localhost:3001/api/capture-headers/getData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
                .then(response => console.log('✅ getData headers sent to backend:', response.status))
                .catch(error => console.error('❌ Error sending getData headers:', error));
        }

        // Handle WebSocket order feed connection (NEW)
        // WebSocket connections start as HTTPS requests with Upgrade: websocket header
        if (details.url.includes('order-feed.dhan.co')) {
            console.log('🔌 Order feed URL detected:', details.url);
            console.log('📋 All headers:', details.requestHeaders.map(h => h.name));

            // Check if this is a WebSocket upgrade request
            const upgradeHeader = details.requestHeaders.find(h =>
                h.name.toLowerCase() === 'upgrade' && h.value.toLowerCase() === 'websocket'
            );

            if (upgradeHeader) {
                console.log('✨ WebSocket upgrade request confirmed!');

                const url = new URL(details.url);
                const payload = {
                    timestamp: new Date().toISOString(),
                    fullUrl: details.url
                };

                // Capture relevant headers
                details.requestHeaders.forEach(h => {
                    if (['Host', 'Origin', 'Sec-WebSocket-Key', 'Sec-WebSocket-Version',
                        'Sec-WebSocket-Extensions', 'Upgrade', 'Connection', 'User-Agent'].includes(h.name)) {
                        payload[h.name] = h.value;
                    }
                });

                // Capture query parameters (src and id)
                payload.queryParams = {
                    src: url.searchParams.get('src'),
                    id: url.searchParams.get('id')
                };

                console.log('📡 Captured Order Feed Headers:', JSON.stringify(payload, null, 2));

                // Send to backend
                fetch('http://localhost:3001/api/capture-headers/orderFeed', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                    .then(response => {
                        console.log('✅ Order feed headers sent to backend:', response.status);
                        return response.json();
                    })
                    .then(data => console.log('📥 Backend response:', data))
                    .catch(error => console.error('❌ Error sending order feed headers:', error));
            } else {
                console.log('⚠️ Not a WebSocket upgrade request (no Upgrade: websocket header)');
            }
        }
    },
    { urls: ["https://*.dhan.co/*"] }, // WebSocket upgrades come through as HTTPS
    ["requestHeaders", "extraHeaders"]
);

console.log("✅ Event listener registered successfully");

// Listen for messages from content script (WebSocket interception)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Message received from content script:', message.type);

    if (message.type === 'websocket-detected') {
        console.log('🔌 WebSocket detected from content script:', message.data);

        // Send to backend
        fetch('http://localhost:3001/api/capture-headers/orderFeed', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message.data)
        })
            .then(response => {
                console.log('✅ Order feed data sent to backend:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('📥 Backend response:', data);
                sendResponse({ success: true, backend: data });
            })
            .catch(error => {
                console.error('❌ Error sending to backend:', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate we'll send response asynchronously
        return true;
    }

    if (message.type === 'websocket-handshake') {
        console.log('📨 WebSocket handshake message captured:', message.data.message.substring(0, 100) + '...');

        // Store the handshake message
        // We could send this to backend separately or log it
        console.log('✅ 703B handshake message captured successfully');

        sendResponse({ success: true });
        return true;
    }
});

console.log("✅ Message listener registered for content script communication");
