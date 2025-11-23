// Store the latest headers
let capturedHeaders = {};

console.log("Dhan Header Capturer: Service Worker Loaded");

// Listen for requests to the target URL
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Log all requests to any dhan.co subdomain
        console.log('Request detected:', details.url);

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

            console.log('Captured Headers:', payload);

            // Send to local backend
            fetch('http://localhost:3001/api/capture-headers/getData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
                .then(response => console.log('Headers sent to backend:', response.status))
                .catch(error => console.error('Error sending headers:', error));
        }
    },
    { urls: ["https://*.dhan.co/*"] },
    ["requestHeaders", "extraHeaders"]
);
