// API Configuration
// Reads from environment variable or defaults to localhost
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// WebSocket URL (replace http:// with ws://)
export const WS_URL = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');

console.log('📡 API Configuration:', { API_URL, WS_URL });
