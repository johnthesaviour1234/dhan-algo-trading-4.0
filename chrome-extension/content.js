// Content script running in MAIN world (page context)
// With world: "MAIN", this runs directly in the page's JavaScript context
//
// RECOMMENDED URLS:
// - Price Feed: https://web.dhan.co/Charts?exch=NSE&seg=E&secid=14366
// - Order Feed: https://web.dhan.co/index/orders/Today

console.log('🔧 Dhan WebSocket Interceptor: Script loaded in MAIN world');

// Store the original WebSocket constructor
const OriginalWebSocket = window.WebSocket;

// Override the WebSocket constructor
window.WebSocket = function (url, protocols) {
    console.log('🚀 WebSocket constructor called:', url);

    // Check if this is the order feed WebSocket
    if (url.includes('order-feed.dhan.co')) {
        console.log('✨ ORDER FEED WEBSOCKET DETECTED!');
        console.log('📍 URL:', url);

        try {
            // Parse the URL
            const wsUrl = new URL(url);

            // Extract all information
            const payload = {
                url: url,
                host: wsUrl.host,
                hostname: wsUrl.hostname,
                origin: window.location.origin,
                pathname: wsUrl.pathname,
                search: wsUrl.search,
                queryParams: {
                    src: wsUrl.searchParams.get('src'),
                    id: wsUrl.searchParams.get('id')
                },
                timestamp: new Date().toISOString(),
                protocols: protocols,
                userAgent: navigator.userAgent
            };

            console.log('📡 Captured order feed data:', JSON.stringify(payload, null, 2));

            // Send to backend directly (since we're in page context, we can't use chrome.runtime)
            // We'll use fetch to send directly to our backend
            fetch('http://localhost:3001/api/capture-headers/orderFeed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
                .then(response => {
                    console.log('✅ Order feed data sent to backend:', response.status);
                    return response.json();
                })
                .then(data => console.log('📥 Backend response:', data))
                .catch(error => console.error('❌ Error sending to backend:', error));

        } catch (error) {
            console.error('❌ Error capturing WebSocket:', error);
        }
    }
    // Handle WebSocket price feed connection (NEW)
    else if (url.includes('price-feed-web.dhan.co')) {
        console.log('✨ PRICE FEED WEB WEBSOCKET DETECTED!');
        console.log('📍 URL:', url);

        try {
            // Parse the URL
            const wsUrl = new URL(url);

            // Extract all information
            const payload = {
                fullUrl: url,
                url: url,
                host: wsUrl.host,
                hostname: wsUrl.hostname,
                origin: window.location.origin,
                pathname: wsUrl.pathname,
                search: wsUrl.search,
                timestamp: new Date().toISOString(),
                protocols: protocols,
                userAgent: navigator.userAgent
            };

            console.log('📡 Captured price feed web data:', JSON.stringify(payload, null, 2));

            // Send to backend directly
            fetch('http://localhost:3001/api/capture-headers/priceFeedWeb', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
                .then(response => {
                    console.log('✅ Price feed web data sent to backend:', response.status);
                    return response.json();
                })
                .then(data => console.log('📥 Backend response:', data))
                .catch(error => console.error('❌ Error sending to backend:', error));

        } catch (error) {
            console.error('❌ Error capturing WebSocket:', error);
        }
    }
    else {
        console.log('ℹ️ Other WebSocket:', url.substring(0, 50) + '...');
    }

    // Create the actual WebSocket connection using the original constructor
    const ws = new OriginalWebSocket(url, protocols);

    // Intercept the first message sent (the 703B handshake)
    if (url.includes('order-feed.dhan.co')) {
        const originalSend = ws.send.bind(ws);
        let firstMessageCaptured = false;

        ws.send = function (data) {
            if (!firstMessageCaptured) {
                console.log('📨 First WebSocket message (703B handshake) being sent');
                console.log('📨 Data type:', typeof data, data instanceof ArrayBuffer ? 'ArrayBuffer' : data instanceof Blob ? 'Blob' : 'Other');
                console.log('📨 Data length:', data.length || data.size || data.byteLength);

                // Try to capture the data
                if (data instanceof ArrayBuffer) {
                    const uint8Array = new Uint8Array(data);
                    const base64 = btoa(String.fromCharCode.apply(null, uint8Array));
                    console.log('📨 Handshake (base64):', base64.substring(0, 100) + '...');
                    console.log('📨 Full handshake length:', base64.length);

                    // Send handshake to backend
                    fetch('http://localhost:3001/api/capture-headers/orderFeedHandshake', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: base64,
                            length: data.byteLength,
                            timestamp: new Date().toISOString()
                        })
                    })
                        .then(response => console.log('✅ Handshake sent to backend:', response.status))
                        .catch(error => console.error('❌ Error sending handshake:', error));

                } else if (typeof data === 'string') {
                    console.log('📨 Handshake (string):', data.substring(0, 100));

                    fetch('http://localhost:3001/api/capture-headers/orderFeedHandshake', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: data,
                            length: data.length,
                            timestamp: new Date().toISOString()
                        })
                    })
                        .then(response => console.log('✅ Handshake sent to backend:', response.status))
                        .catch(error => console.error('❌ Error sending handshake:', error));
                }

                firstMessageCaptured = true;
            }

            // Call the original send method
            return originalSend(data);
        };

        // Also log when connection opens
        ws.addEventListener('open', () => {
            console.log('✅ Order feed WebSocket connection opened');
        });

        ws.addEventListener('message', (event) => {
            console.log('📥 WebSocket message received, size:',
                event.data.length || event.data.size || event.data.byteLength);
        });

        ws.addEventListener('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });

        ws.addEventListener('close', () => {
            console.log('🔒 WebSocket connection closed');
        });
    }

    // Intercept messages for price-feed-web (NEW)
    if (url.includes('price-feed-web.dhan.co')) {
        const originalSend = ws.send.bind(ws);
        let messageCount = 0;

        ws.send = function (data) {
            messageCount++;
            const dataLength = data.byteLength || data.length || data.size;

            console.log(`📨 [Price Feed Web] Message #${messageCount} being sent`);
            console.log('📨 Data type:', typeof data, data instanceof ArrayBuffer ? 'ArrayBuffer' : data instanceof Blob ? 'Blob' : 'Other');
            console.log('📨 Data length:', dataLength);

            // Convert to base64
            let base64 = null;
            if (data instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(data);
                base64 = btoa(String.fromCharCode.apply(null, uint8Array));
            } else if (typeof data === 'string') {
                base64 = btoa(data);
            }

            if (base64) {
                // Determine message type based on length
                if (dataLength === 703 && messageCount === 1) {
                    // First 703B message - Handshake
                    console.log('📨 [703B HANDSHAKE] Captured!');
                    console.log('📨 Base64 preview:', base64.substring(0, 100) + '...');

                    fetch('http://localhost:3001/api/capture-headers/priceFeedWebHandshake', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: base64,
                            length: dataLength,
                            messageNumber: messageCount,
                            timestamp: new Date().toISOString()
                        })
                    })
                        .then(response => console.log('✅ [703B] Handshake sent to backend:', response.status))
                        .catch(error => console.error('❌ Error sending handshake:', error));

                } else if (dataLength === 129) {
                    // 129B subscription messages
                    console.log(`📨 [129B SUBSCRIPTION #${messageCount - 1}] Captured!`);
                    console.log('📨 Base64:', base64);

                    fetch('http://localhost:3001/api/capture-headers/priceFeedWebSubscriptions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: base64,
                            length: dataLength,
                            messageNumber: messageCount,
                            subscriptionIndex: messageCount - 1, // First 129B is subscription #1
                            timestamp: new Date().toISOString()
                        })
                    })
                        .then(response => console.log(`✅ [129B #${messageCount - 1}] Subscription sent to backend:`, response.status))
                        .catch(error => console.error('❌ Error sending subscription:', error));

                } else {
                    // Unknown message type
                    console.log(`⚠️ [UNKNOWN ${dataLength}B] Message type, still logging...`);
                    console.log('📨 Base64 preview:', base64.substring(0, 100) + '...');
                }
            }

            // Call the original send method
            return originalSend(data);
        };

        // Add event listeners for debugging
        ws.addEventListener('open', () => {
            console.log('✅ Price feed web WebSocket connection opened');
        });

        ws.addEventListener('message', (event) => {
            console.log('📥 [Price Feed Web] Message received, size:',
                event.data.length || event.data.size || event.data.byteLength);
        });

        ws.addEventListener('error', (error) => {
            console.error('❌ [Price Feed Web] WebSocket error:', error);
        });

        ws.addEventListener('close', () => {
            console.log('🔒 [Price Feed Web] WebSocket connection closed');
        });
    }

    return ws;
};

// Copy over any static properties
Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
window.WebSocket.prototype = OriginalWebSocket.prototype;

console.log('✅ WebSocket constructor overridden successfully in page context');
