/**
 * useWebSocket Hook
 * 
 * Manages WebSocket connection to price feed proxy
 * and decodes binary messages
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { WebSocketDecoder } from '../utils/websocketDecoder';
import {
    LTPData,
    MarketDepthData,
    OHLCData,
    QuoteData,
    TopBidAskData,
    PrevCloseOIData,
    CircuitLimitData,
    WeekHighLowData
} from '../components/WebSocketDataPanel';

interface UseWebSocketReturn {
    isConnected: boolean;
    ltpData: LTPData | null;
    marketDepth: MarketDepthData | null;
    ohlcData: OHLCData | null;
    quoteData: QuoteData | null;
    topBidAsk: TopBidAskData | null;
    prevCloseOI: PrevCloseOIData | null;
    circuitLimits: CircuitLimitData | null;
    weekHighLow: WeekHighLowData | null;
    error: string | null;
}

export function useWebSocket(): UseWebSocketReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [ltpData, setLtpData] = useState<LTPData | null>(null);
    const [marketDepth, setMarketDepth] = useState<MarketDepthData | null>(null);
    const [ohlcData, setOhlcData] = useState<OHLCData | null>(null);
    const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
    const [topBidAsk, setTopBidAsk] = useState<TopBidAskData | null>(null);
    const [prevCloseOI, setPrevCloseOI] = useState<PrevCloseOIData | null>(null);
    const [circuitLimits, setCircuitLimits] = useState<CircuitLimitData | null>(null);
    const [weekHighLow, setWeekHighLow] = useState<WeekHighLowData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const decoder = useMemo(() => new WebSocketDecoder(), []);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        console.log('🔌 Initializing WebSocket connection to price feed...');

        const ws = new WebSocket('ws://localhost:3001/ws/priceFeed');
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ Connected to price feed proxy');
            setIsConnected(true);
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                // Check if message is JSON (connection status) or binary (market data)
                if (typeof event.data === 'string') {
                    const jsonData = JSON.parse(event.data);

                    if (jsonData.error) {
                        console.error('❌ Error from server:', jsonData.error);
                        setError(jsonData.error);
                        return;
                    }

                    if (jsonData.type === 'connection_ready') {
                        console.log('✅ Connection ready:', jsonData.message);
                        console.log('   Subscriptions:', jsonData.subscriptions);
                        return;
                    }
                } else if (event.data instanceof ArrayBuffer) {
                    // Binary message - decode it (filter for Vodafone Idea security ID: 14366)
                    const messages = decoder.parseMessage(event.data, 14366);

                    messages.forEach(msg => {
                        // Filter for Idea Vodafone only (security ID: 14366)
                        const isIdeaVodafone = msg.data && msg.data.securityId === '14366';

                        if (!isIdeaVodafone && msg.type !== 'Heartbeat') {
                            // Skip messages for other stocks
                            return;
                        }

                        switch (msg.type) {
                            case 'LTP':
                                console.log('📊 LTP Update (Idea Vodafone):', msg.data);
                                setLtpData(prev => {
                                    const newData = { ...msg.data, symbol: 'IDEA VODAFONE' } as LTPData;
                                    if (prev) {
                                        // Calculate change from previous
                                        newData.change = newData.ltp - prev.ltp;
                                        newData.changePer = ((newData.change / prev.ltp) * 100);
                                    }
                                    return newData;
                                });
                                break;

                            case 'MarketDepth':
                                console.log('📊 Market Depth Update (Idea Vodafone):', msg.data);
                                setMarketDepth({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case 'OHLC':
                                console.log('📊 OHLC Update (Idea Vodafone):', msg.data);
                                setOhlcData({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case 'Quote':
                                console.log('📊 Quote Update (Idea Vodafone):', msg.data);
                                setQuoteData({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case 'TopBidAsk':
                                console.log('📊 Top Bid/Ask Update (Idea Vodafone):', msg.data);
                                setTopBidAsk({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case 'PrevCloseOI':
                                console.log('📊 Prev Close/OI Update (Idea Vodafone):', msg.data);
                                setPrevCloseOI({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case 'CircuitLimits':
                                console.log('📊 Circuit Limits Update (Idea Vodafone):', msg.data);
                                setCircuitLimits({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case '52WeekHL':
                                console.log('📊 52-Week H/L Update (Idea Vodafone):', msg.data);
                                setWeekHighLow({ ...msg.data, symbol: 'IDEA VODAFONE' });
                                break;

                            case 'Heartbeat':
                                // Silent heartbeat
                                break;

                            default:
                                console.log('📊 Other message type:', msg.type);
                        }
                    });
                }
            } catch (err) {
                console.error('❌ Error processing message:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        };

        ws.onerror = (event) => {
            console.error('❌ WebSocket error:', event);
            setError('WebSocket connection error');
        };

        ws.onclose = () => {
            console.log('🔒 Disconnected from price feed');
            setIsConnected(false);
        };

        // Cleanup on unmount
        return () => {
            console.log('🔌 Cleaning up WebSocket connection');
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [decoder]);

    return {
        isConnected,
        ltpData,
        marketDepth,
        ohlcData,
        quoteData,
        topBidAsk,
        prevCloseOI,
        circuitLimits,
        weekHighLow,
        error
    };
}
