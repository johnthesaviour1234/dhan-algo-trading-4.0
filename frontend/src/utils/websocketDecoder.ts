/**
 * WebSocket Binary Message Decoder
 * 
 * Decodes Dhan WebSocket price feed binary messages based on
 * WEBSOCKET_MESSAGE_DECODING_ANALYSIS.md
 */

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

export interface DecodedMessage {
    type: 'LTP' | 'MarketDepth' | 'OHLC' | 'Quote' | 'TopBidAsk' | 'PrevCloseOI' | 'CircuitLimits' | '52WeekHL' | 'OI' | 'Heartbeat';
    data: any;
}

/**
 * Dhan uses a custom epoch starting from 1980-01-01 00:00:00 UTC
 * (which is 1980-01-01 05:30:00 IST)
 * Reference: dhanfeeds/udf/dist/bundle2.1.37.js lines 14235-14243
 */
const DHAN_EPOCH_MS = new Date('1980-01-01T00:00:00Z').getTime(); // 315532800000

/**
 * Convert Dhan's timestamp (seconds since 1980 epoch) to ISO string
 * @param rawTimestamp - Uint32 timestamp from bytes 29-33 of binary message
 * @returns ISO 8601 date string
 */
function decodeDhanTimestamp(rawTimestamp: number): string {
    // Raw timestamp is seconds since 1980-01-01 00:00:00 UTC
    const timestampMs = rawTimestamp * 1000;
    const actualMs = DHAN_EPOCH_MS + timestampMs;
    return new Date(actualMs).toISOString();
}

export class WebSocketDecoder {
    /**
     * Parse WebSocket message buffer
     * Can contain multiple packets
     * @param data ArrayBuffer containing the binary message
     * @param filterSecurityId Optional security ID to filter logs (e.g., 14366 for Vodafone Idea)
     */
    parseMessage(data: ArrayBuffer, filterSecurityId?: number): DecodedMessage[] {
        const messages: DecodedMessage[] = [];
        let offset = 0;
        const totalLength = data.byteLength;

        // Skip single-byte heartbeat messages
        if (totalLength === 1) {
            messages.push({ type: 'Heartbeat', data: null });
            return messages;
        }

        while (offset < totalLength) {
            try {
                // Read packet header (11 bytes minimum)
                const exchange = new Uint8Array(data.slice(offset, offset + 1))[0];
                const securityId = new Uint32Array(data.slice(offset + 1, offset + 5))[0];
                const packetLength = new Uint8Array(data.slice(offset + 9, offset + 10))[0];
                const messageType = new Uint8Array(data.slice(offset + 10, offset + 11))[0];

                if (packetLength < 11) {
                    console.warn('Invalid packet length:', packetLength);
                    break;
                }

                const packet = data.slice(offset, offset + packetLength);

                // 🔍 DEBUG: Log raw packet hex for analysis (only for filtered security ID)
                const shouldLog = !filterSecurityId || securityId === filterSecurityId;
                if (shouldLog) {
                    const hexDump = Array.from(new Uint8Array(packet))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                    console.log(`🔍 DEBUG Packet | Type: ${messageType} | Exchange: ${exchange} | SecID: ${securityId} | Len: ${packetLength}`);
                    console.log(`   Raw Hex: ${hexDump}`);
                }

                // Decode based on message type
                switch (messageType) {
                    case 1:
                        messages.push({ type: 'LTP', data: this.decodeLTP(packet, exchange, securityId, shouldLog) });
                        break;
                    case 2:
                        messages.push({ type: 'MarketDepth', data: this.decodeMarketDepth(packet, exchange, securityId) });
                        break;
                    case 3:
                        messages.push({ type: 'OHLC', data: this.decodeOHLC(packet, exchange, securityId) });
                        break;
                    case 5:
                        messages.push({ type: 'Quote', data: this.decodeQuote(packet, exchange, securityId) });
                        break;
                    case 6:
                        messages.push({ type: 'TopBidAsk', data: this.decodeTopBidAsk(packet, exchange, securityId) });
                        break;
                    case 32:
                        messages.push({ type: 'PrevCloseOI', data: this.decodePrevCloseOI(packet, exchange, securityId) });
                        break;
                    case 33:
                        messages.push({ type: 'CircuitLimits', data: this.decodeCircuitLimits(packet, exchange, securityId) });
                        break;
                    case 36:
                        messages.push({ type: '52WeekHL', data: this.decode52WeekHL(packet, exchange, securityId) });
                        break;
                    case 37:
                        messages.push({ type: 'OI', data: this.decodeOI(packet, exchange, securityId) });
                        break;
                    case 14:
                        messages.push({ type: 'Heartbeat', data: null });
                        break;
                    default:
                        console.warn('Unknown message type:', messageType);
                }

                offset += packetLength;
            } catch (error) {
                console.error('Error parsing packet:', error);
                break;
            }
        }

        return messages;
    }

    /**
     * Message Type 1: LTP Update (37 bytes)
     */
    private decodeLTP(buffer: ArrayBuffer, exchange: number, securityId: number, shouldLog: boolean = true): LTPData {
        const ltp = new Float32Array(buffer.slice(11, 15))[0];
        const ltq = new Uint16Array(buffer.slice(15, 17))[0];
        const volume = new Uint32Array(buffer.slice(17, 21))[0];
        const atp = new Float32Array(buffer.slice(21, 25))[0];
        const oi = new Uint32Array(buffer.slice(25, 29))[0];
        const rawTimestamp = new Uint32Array(buffer.slice(29, 33))[0];

        // Convert Dhan's custom epoch timestamp to actual ISO date
        const timestamp = decodeDhanTimestamp(rawTimestamp);

        if (shouldLog) {
            console.log(`   📊 LTP Decoded: ltp=${ltp.toFixed(2)} | ltq=${ltq} | vol=${volume} | atp=${atp.toFixed(2)} | oi=${oi} | rawTs=${rawTimestamp} → ${timestamp}`);
        }

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            ltp: parseFloat(ltp.toFixed(2)),
            ltq,
            volume,
            atp: parseFloat(atp.toFixed(2)),
            oi: oi === 4294967295 ? 0 : oi, // Check for invalid OI
            timestamp: timestamp, // Now uses converted timestamp
            change: 0, // Calculated separately
            changePer: 0 // Calculated separately
        };
    }

    /**
     * Message Type 2: Market Depth (51+ bytes for 5 levels)
     */
    private decodeMarketDepth(buffer: ArrayBuffer, exchange: number, securityId: number): MarketDepthData {
        const bids: Array<{ price: number; volume: number; orders: number }> = [];
        const asks: Array<{ price: number; volume: number; orders: number }> = [];
        let pos = 11;

        for (let i = 0; i < 5; i++) {
            const bidVolume = new Uint32Array(buffer.slice(pos, pos + 4))[0];
            pos += 4;
            const askVolume = new Uint32Array(buffer.slice(pos, pos + 4))[0];
            pos += 4;
            const bidOrders = new Uint16Array(buffer.slice(pos, pos + 2))[0];
            pos += 2;
            const askOrders = new Uint16Array(buffer.slice(pos, pos + 2))[0];
            pos += 2;
            const bidPrice = new Float32Array(buffer.slice(pos, pos + 4))[0];
            pos += 4;
            const askPrice = new Float32Array(buffer.slice(pos, pos + 4))[0];
            pos += 4;

            bids.push({ price: parseFloat(bidPrice.toFixed(2)), volume: bidVolume, orders: bidOrders });
            asks.push({ price: parseFloat(askPrice.toFixed(2)), volume: askVolume, orders: askOrders });
        }

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            bids,
            asks,
            totalBuy: bids.reduce((sum, b) => sum + b.volume, 0),
            totalSell: asks.reduce((sum, a) => sum + a.volume, 0)
        };
    }

    /**
     * Message Type 3: OHLC Update (27+ bytes)
     */
    private decodeOHLC(buffer: ArrayBuffer, exchange: number, securityId: number): OHLCData {
        const open = new Float32Array(buffer.slice(5, 9))[0] || new Float32Array(buffer.slice(15, 19))[0];
        const close = new Float32Array(buffer.slice(15, 19))[0];
        const high = new Float32Array(buffer.slice(19, 23))[0];
        const low = new Float32Array(buffer.slice(23, 27))[0];

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2))
        };
    }

    /**
     * Message Type 5: Quote Update (35+ bytes)
     */
    private decodeQuote(buffer: ArrayBuffer, exchange: number, securityId: number): QuoteData {
        const ltp = new Float32Array(buffer.slice(11, 15))[0];
        const open = new Float32Array(buffer.slice(15, 19))[0];
        const prevClose = new Float32Array(buffer.slice(19, 23))[0];
        const high = new Float32Array(buffer.slice(23, 27))[0];
        const low = new Float32Array(buffer.slice(27, 31))[0];
        const timestamp = new Uint32Array(buffer.slice(31, 35))[0];

        const change = ltp - prevClose;
        const changePer = (change / prevClose) * 100;

        console.log(`   📈 Quote Decoded: ltp=${ltp.toFixed(2)} | o=${open.toFixed(2)} | h=${high.toFixed(2)} | l=${low.toFixed(2)} | pc=${prevClose.toFixed(2)} | ts=${timestamp}`);

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            ltp: parseFloat(ltp.toFixed(2)),
            open: parseFloat(open.toFixed(2)),
            prevClose: parseFloat(prevClose.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePer: parseFloat(changePer.toFixed(2)),
            timestamp: new Date(timestamp * 1000).toISOString()
        };
    }

    /**
     * Message Type 6: Top Bid/Ask (35+ bytes)
     */
    private decodeTopBidAsk(buffer: ArrayBuffer, exchange: number, securityId: number): TopBidAskData {
        const totalSell = new Uint32Array(buffer.slice(11, 15))[0];
        const totalBuy = new Uint32Array(buffer.slice(15, 19))[0];
        const sellQtyAtBest = new Uint32Array(buffer.slice(19, 23))[0];
        const buyQtyAtBest = new Uint32Array(buffer.slice(23, 27))[0];
        const bestBuyPrice = new Float32Array(buffer.slice(27, 31))[0];
        const bestAskPrice = new Float32Array(buffer.slice(31, 35))[0];

        const totalQty = totalBuy + totalSell;
        const totalBuyPer = totalQty > 0 ? (totalBuy / totalQty) * 100 : 0;
        const totalSellPer = totalQty > 0 ? (totalSell / totalQty) * 100 : 0;

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            totalSell,
            totalBuy,
            sellQtyAtBest,
            buyQtyAtBest,
            bestBuyPrice: parseFloat(bestBuyPrice.toFixed(2)),
            bestAskPrice: parseFloat(bestAskPrice.toFixed(2)),
            totalBuyPer: parseFloat(totalBuyPer.toFixed(2)),
            totalSellPer: parseFloat(totalSellPer.toFixed(2))
        };
    }

    /**
     * Message Type 32: Previous Close & OI (19+ bytes)
     */
    private decodePrevCloseOI(buffer: ArrayBuffer, exchange: number, securityId: number): PrevCloseOIData {
        const prevClose = new Float32Array(buffer.slice(11, 15))[0];
        const prevOI = new Float32Array(buffer.slice(15, 19))[0];

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            prevClose: parseFloat(prevClose.toFixed(2)),
            prevOI: parseFloat(prevOI.toFixed(0)),
            currentOI: parseFloat(prevOI.toFixed(0)), // Will be updated by OI message
            oiChange: 0,
            oiPerChange: 0
        };
    }

    /**
     * Message Type 33: Circuit Limits (19+ bytes)
     */
    private decodeCircuitLimits(buffer: ArrayBuffer, exchange: number, securityId: number): CircuitLimitData {
        const upperLimit = new Float32Array(buffer.slice(11, 15))[0];
        const lowerLimit = new Float32Array(buffer.slice(15, 19))[0];

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            upperLimit: parseFloat(upperLimit.toFixed(2)),
            lowerLimit: parseFloat(lowerLimit.toFixed(2)),
            currentPrice: 0 // Will be updated by LTP/Quote messages
        };
    }

    /**
     * Message Type 36: 52-Week High/Low (19+ bytes)
     */
    private decode52WeekHL(buffer: ArrayBuffer, exchange: number, securityId: number): WeekHighLowData {
        const weekHigh52 = new Float32Array(buffer.slice(11, 15))[0];
        const weekLow52 = new Float32Array(buffer.slice(15, 19))[0];

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            symbol: `Security-${securityId}`,
            weekHigh52: parseFloat(weekHigh52.toFixed(2)),
            weekLow52: parseFloat(weekLow52.toFixed(2)),
            currentPrice: 0 // Will be updated by LTP/Quote messages
        };
    }

    /**
     * Message Type 37: OI Update Only (15+ bytes)
     */
    private decodeOI(buffer: ArrayBuffer, exchange: number, securityId: number) {
        const oi = new Uint32Array(buffer.slice(11, 15))[0];

        return {
            exchange: this.getExchangeName(exchange),
            securityId: securityId.toString(),
            oi
        };
    }

    /**
     * Get exchange name from exchange code
     */
    private getExchangeName(code: number): string {
        switch (code) {
            case 0: return 'IDX-NSE';
            case 1: return 'NSE';
            case 2: return 'BSE';
            case 3: return 'MCX';
            case 4: return 'BSE-COMM';
            case 5: return 'NSE-FNO';
            case 6: return 'NSE-CUR';
            case 7: return 'NCDEX';
            case 8: return 'BSE';
            case 9: return 'MCX-OPT';
            case 10: return 'NSE-FNO';
            default: return `Exchange-${code}`;
        }
    }
}
