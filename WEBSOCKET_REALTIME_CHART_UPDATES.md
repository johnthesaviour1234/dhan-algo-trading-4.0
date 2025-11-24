# WebSocket Real-Time Chart Updates - Complete Analysis

## Table of Contents
1. [Overview](#overview)
2. [WebSocket Connection Flow](#websocket-connection-flow)
3. [Message Type Classification](#message-type-classification)
4. [Real-Time Candle Update Mechanism](#real-time-candle-update-mechanism)
5. [Implementation Guide](#implementation-guide)
6. [Complete Code Examples](#complete-code-examples)

---

## Overview

Dhan's TradingView charts use a **binary WebSocket protocol** for real-time updates. After the 703-byte handshake and 129-byte subscription messages are sent, the WebSocket receives binary messages of **10 different types** that update various aspects of the chart and market data.

### Key Discovery

**Location**: `bundle2.1.37.js`, lines 13580-13640, function `updateRawBroadcast()`

This function is the **central message router** that:
1. Receives binary WebSocket messages
2. Parses the message type
3. Routes to appropriate handler
4. Updates chart data in real-time

---

## WebSocket Connection Flow

###  1. Connection Establishment

```javascript
// Lines 13736-13758 in bundle2.1.37.js
this.websocket = new WebSocket(pi)  // pi = wss://price-feed-tv.dhan.co/
this.websocket.binaryType = "arraybuffer"

this.websocket.onopen = () => {
    // Send 703-byte handshake
    let handshake = new ArrayBuffer(703)
    let view = new DataView(handshake)
    
    // Byte 0: Message type 41 (handshake)
    view.setUint8(0, 41)
    
    // Bytes 1-36: Client ID
    // Bytes 37-86: Token
    // Bytes 87-703: Additional data
    
    this.websocket.send(handshake)
}
```

### 2. Subscription

After handshake, subscribe to symbols:

```javascript
// Send 129-byte subscription message
let subscription = new ArrayBuffer(129)
let view = new DataView(subscription)

// Byte 0: Message type 21 (subscribe)
view.setUint8(0, 21)

// Byte 1-2: Message length (129)
view.setUint16(1, 129, true)  // little-endian

// Bytes 3-32: Client ID
// Bytes 33-82: Token
// Byte 83: Exchange/Segment code
// Bytes 84-108: Script code/SEC_ID

this.websocket.send(subscription)
```

### 3. Message Reception

```javascript
this.websocket.onmessage = (event) => {
    this.updateRawBroadcast(event)  // Main message handler
}
```

---

## Message Type Classification

### Complete Message Type Table

| Type | Name | Purpose | Update Frequency | Chart Impact |
|------|------|---------|------------------|--------------|
| **1** | **LTP (Last Traded Price)** | Current price update | Every tick (100-500ms) | ✅ Updates current candle close |
| **2** | **Market By Price (MBP)** | Bid/Ask depth | Every tick| ❌ No chart update |
| **3** | **OHLC Update** | Complete bar data | End of time period | ✅ Updates OHLC values |
| **5** | **Index Broadcast** | Index-specific data | Every tick | ✅ For index charts |
| **6** | **Top Bid/Ask** | Best bid/ask prices | Every tick | ❌ No chart update |
| **14** | **Heartbeat/Ping** | Keep-alive | Every 5-10 seconds | ❌ No chart update |
| **32** | **Previous Close** | Reference price | Once on connect | ❌ Reference only |
| **33** | **Circuit Limits** | Price boundaries | Once on connect | ❌ Reference only |
| **36** | **52-Week High/Low** | Year range | Once on connect | ❌ Reference only |
| **37** | **Open Interest (OI)** | OI updates | Every tick | ❌ No chart update |

### Message Structure (Binary)

Every message follows this structure:

```
Byte 0: Exchange Code (Uint8)
Bytes 1-4: Security ID (Uint32)
Bytes 5-8: Reserved
Byte 9: Message length (Uint8)
Byte 10: Message Type (Uint8)  ← This determines the handler
Bytes 11+: Type-specific payload
```

---

## Real-Time Candle Update Mechanism

### The Core Router: `updateRawBroadcast()`

**Location**: Lines 13580-13640

```javascript
updateRawBroadcast(messageEvent) {
    let data = messageEvent.data  // ArrayBuffer
    let dataLength = data.byteLength
    let offset = 0
    let buffer = data
    
    // Reset inactivity timer
    this.lastMessageTime = new Date()
    
    // Empty message check
    if (dataLength == 1) return
    
    let updatedSymbols = []
    
    // Parse all messages in the buffer (can contain multiple)
    while (offset < dataLength) {
        // Extract header
        let exchangeCode = new Uint8Array(buffer.slice(0, 1))[0]
        let securityId = new Uint32Array(buffer.slice(1, 5))[0]
        let messageLength = new Uint8Array(buffer.slice(9, 10))[0]
        
        // Validate message length
        if (messageLength < 11) return
        
        // Advance offset
        offset += messageLength
        
        // Extract message type (byte 10)
        let messageType = new Uint8Array(buffer.slice(10, 11))[0]
        
        // ✅ ROUTE TO APPROPRIATE HANDLER
        switch (messageType) {
            case 1:
                this.ltpBind(buffer)  // LTP update
                break
            case 2:
                this.updateMBP(buffer)  // Market by Price
                break
            case 3:
                this.updateOHLC(buffer)  // ⭐ OHLC update
                break
            case 5:
                this.bindIndexBC(buffer)  // Index broadcast
                break
            case 6:
                this.updateBidAsk(buffer)  // Bid/Ask
                break
            case 14:
                this.heartbeat()  // Keep-alive
                break
            case 32:
                this.updatePrevClose(buffer)  // Previous close
                break
            case 33:
                this.updateCircuitLimits(buffer)  // Circuit limits
                break
            case 36:
                this.update52WeekHL(buffer)  // 52-week high/low
                break
            case 37:
                this.updateOI(buffer)  // Open Interest
                break
        }
        
        // Move to next message in buffer
        buffer = data.slice(offset, dataLength)
        
        // Track updated symbols
        let symbolKey = this.getSegKey(exchangeCode, securityId)
        if (updatedSymbols.indexOf(symbolKey.tempkey) < 0) {
            updatedSymbols.push(symbolKey.tempkey)
        }
    }
    
    // ✅ TRIGGER CHART UPDATES FOR ALL AFFECTED SYMBOLS
    for (let i = 0; i < updatedSymbols.length; i++) {
        this.doChartUpdate(updatedSymbols[i])
    }
}
```

---

## Type 1: LTP Update (Most Critical for Charts)

### Binary Message Structure

```
Byte 0: Exchange Code (Uint8)
Bytes 1-4: Security ID (Uint32, little-endian)
Bytes 5-10: Reserved  
Byte 11-14: LTP Price (Float32)
Byte 15-18: Volume (Uint32)
Bytes 19-22: Additional data
```

### Handler: `ltpBind()`

```javascript
ltpBind(buffer) {
    // Parse binary data
    let exchangeCode = new Uint8Array(buffer.slice(0, 1))[0]
    let securityId = new Uint32Array(buffer.slice(1, 5))[0]
    let ltp = new Float32Array(buffer.slice(11, 15))[0]  // Last Traded Price
    let volume = new Uint32Array(buffer.slice(17, 21))[0]
    let timestamp = new Uint32Array(buffer.slice(25, 29))[0]
    
    // Convert to symbol key
    let symbolKey = this.getSegKey(exchangeCode, securityId).tempkey
    
    // Update in-memory data
    if (this.ltpMapData[symbolKey]) {
        this.ltpMapData[symbolKey].CUR_LTP = parseFloat(ltp).toFixed(2)
        this.ltpMapData[symbolKey].VOLUME = volume
        this.ltpMapData[symbolKey].LTT = this.convertTimestamp(timestamp)
        this.ltpMapData[symbolKey].new_tick = true  // Flag for chart update
    }
}
```

### Chart Update Trigger: `doChartUpdate()`

**Location**: Lines 13803-13806

```javascript
doChartUpdate(symbolKey) {
    // For each active chart subscription
    for (let chartId in this.chartsStramDataReq) {
        if (this.chartsStramDataReq[chartId].KEY == symbolKey) {
            let resolution = this.chartsStramDataReq[chartId].resolution
            let data = this.ltpMapData[symbolKey]
            
            // Choose update method based on resolution
            if (resolution.includes("S")) {
                // Seconds resolution
                this.updateChartsDataResol(this.chartsStramDataReq[chartId], data)
            } else {
                // Standard resolution (1min, 5min, etc.)
                this.updateChartsData(this.chartsStramDataReq[chartId], data)
            }
        }
    }
}
```

---

## Real-Time Candle Update Logic

### For Standard Resolutions (1, 5, 15, 30, 60 min, Daily)

**Function**: `updateChartsData()` (Lines 13854-13918)

```javascript
updateChartsData(chartSubscription, tickData) {
    let candleTime = 0
    let data = JSON.parse(JSON.stringify(tickData))  // Clone
    let cacheKey = "cache_" + chartSubscription.resolution
    let cachedCandle = chartSubscription.symbol[cacheKey]
    
    // For INTRADAY (I) resolutions
    if ("I" == getResolutionType(chartSubscription.resolution)) {
        // Parse timestamp
        data.LTT = new Date(data.LTT).setSeconds(0)
        data.LTT = new Date(data.LTT).getTime()
        candleTime = new Date(data.LTT).getTime()
        
        // For 5, 15, 25, 60 min - align to interval
        if (["5", "15", "25", "60"].includes(chartSubscription.resolution)) {
            let marketOpen = chartSubscription.symbol.session.split("-")
            let openHour = marketOpen[0].substring(0, 2)
            let openMin = marketOpen[0].substring(2, 4)
            let baseTime = new Date()
            baseTime = new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), openHour, openMin, 0)
            baseTime = baseTime.getTime() / 1000
            
            candleTime = data.LTT / 1000
            // Round down to interval boundary
            candleTime -= 60 * (candleTime % baseTime / 60 % parseInt(chartSubscription.resolution))
            candleTime *= 1000
        }
        
        // ✅ CHECK IF SAME CANDLE OR NEW CANDLE
        if (cachedCandle && cachedCandle.LTT == candleTime) {
            // ⭐ SAME CANDLE - UPDATE EXISTING
            
            // First tick of this second?
            if (cachedCandle.FIRST_TICK) {
                cachedCandle.PRV_VOL = data.VOLUME - cachedCandle.VOL
                cachedCandle.VOL = 0
                cachedCandle.FIRST_TICK = false
            }
            
            // Accumulate volume (only new volume since last tick)
            if (data.VOLUME != cachedCandle.PRV_VOL) {
                cachedCandle.VOL += 1 * Number(data.VOLUME - cachedCandle.PRV_VOL)
            }
            cachedCandle.PRV_VOL = data.VOLUME
            
            // Update High
            if (data.CUR_LTP > cachedCandle.HIGH) {
                cachedCandle.HIGH = Math.max(data.CUR_LTP, cachedCandle.HIGH)
            }
            
            // Update Low
            if (data.CUR_LTP < cachedCandle.LOW) {
                cachedCandle.LOW = Math.min(data.CUR_LTP, cachedCandle.LOW)
            }
            
            // Update Close
            let priceField = this.keyToRead(chartSubscription.symbol.suffix)
            cachedCandle.CLOSE = +data[priceField]
            
        } else {
            // ⭐ NEW CANDLE - CREATE NEW
            
            let priceField = this.keyToRead(chartSubscription.symbol.suffix)
            
            cachedCandle = {}
            cachedCandle.LTT = candleTime
            cachedCandle.OPEN = data.CUR_LTP
            cachedCandle.HIGH = data.CUR_LTP
            cachedCandle.LOW = data.CUR_LTP
            cachedCandle.CLOSE = +data[priceField]
            cachedCandle.VOL = Number(data.LTQ)  // Last traded quantity
            cachedCandle.PRV_VOL = data.VOLUME
            
            // Cache it
            chartSubscription.symbol[cacheKey] = cachedCandle
        }
        
        // ✅ UPDATE CHART WITH FORMATTED BAR
        let time = candleTime
        let close = Number(cachedCandle.CLOSE)
        let open = Number(cachedCandle.OPEN)
        let high = Math.max(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
        let low = Math.min(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
        let volume = Number(cachedCandle.VOL)
        
        // Throttle updates to max 2.5 updates per second (400ms)
        if (!chartSubscription.lastUpdatedTime || ((new Date().getTime() - chartSubscription.lastUpdatedTime) / 1000 > 0.4)) {
            // ⭐ CALL CHART onTick() CALLBACK
            chartSubscription.onTick({
                time: time,
                close: close,
                open: open,
                high: high,
                low: low,
                volume: volume
            })
            
            chartSubscription.lastUpdatedTime = (new Date()).getTime()
        }
    }
}
```

### For Seconds Resolution (1S, 5S, etc.)

**Function**: `updateChartsDataResol()` (Lines 13807-13853)

```javascript
updateChartsDataResol(chartSubscription, tickData) {
    let candleTime = 0
    let data = JSON.parse(JSON.stringify(tickData))
    let cacheKey = "cache_" + chartSubscription.resolution
    let cachedCandle = chartSubscription.symbol[cacheKey]
    
    // Parse timestamp and round to seconds
    data.LTT = new Date(data.LTT).getTime()
    candleTime = data.LTT
    
    // Extract resolution value (e.g., "5S" -> 5)
    let resolutionValue = +chartSubscription.resolution.match(/\d+/g)[0]
    
    // Round down to interval boundary
    candleTime = new Date(Math.floor(candleTime / (1000 * resolutionValue)) * (1000 * resolutionValue)).getTime()
    
    // Check if same candle or new
    if (cachedCandle && cachedCandle.LTT == candleTime) {
        // SAME CANDLE - UPDATE
        
        // Handle first tick
        if (cachedCandle.FIRST_TICK) {
            cachedCandle.PRV_VOL = data.VOLUME - cachedCandle.VOL
            cachedCandle.VOL = 0
            cachedCandle.FIRST_TICK = false
        }
        
        // Accumulate volume
        if (data.VOLUME != cachedCandle.PRV_VOL) {
            cachedCandle.VOL += 1 * Number(data.VOLUME - cachedCandle.PRV_VOL)
        }
        cachedCandle.PRV_VOL = data.VOLUME
        
        // Update High/Low
        if (data.CUR_LTP > cachedCandle.HIGH) {
            cachedCandle.HIGH = Math.max(data.CUR_LTP, cachedCandle.HIGH)
        }
        if (data.CUR_LTP < cachedCandle.LOW) {
            cachedCandle.LOW = Math.min(data.CUR_LTP, cachedCandle.LOW)
        }
        
        // Update Close
        let priceField = this.keyToRead(chartSubscription.symbol.suffix)
        cachedCandle.CLOSE = +data[priceField]
        
    } else {
        // NEW CANDLE - CREATE
        
        let priceField = this.keyToRead(chartSubscription.symbol.suffix)
        
        cachedCandle = {}
        cachedCandle.LTT = candleTime
        cachedCandle.OPEN = data.CUR_LTP
        cachedCandle.HIGH = data.CUR_LTP
        cachedCandle.LOW = data.CUR_LTP
        cachedCandle.CLOSE = +data[priceField]
        cachedCandle.VOL = Number(data.LTQ)
        cachedCandle.PRV_VOL = data.VOLUME
        
        chartSubscription.symbol[cacheKey] = cachedCandle
    }
    
    // Update chart
    let time = candleTime
    let close = Number(cachedCandle.CLOSE)
    let open = Number(cachedCandle.OPEN)
    let high = Math.max(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
    let low = Math.min(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
    let volume = Number(cachedCandle.VOL)
    
    // ⭐ CALL CHART onTick() CALLBACK
    chartSubscription.onTick({
        time: time,
        close: close,
        open: open,
        high: high,
        low: low,
        volume: volume
    })
}
```

---

## How Candle Transitions Work (9:30 → 9:31 Example)

### Timeline of Events

```
9:30:00.100 - WebSocket message Type 1 (LTP)
             → LTP: 14.25, Volume: 1000
             → candleTime = align(9:30:00.100) = 9:30:00.000
             → cached candle doesn't exist
             → CREATE NEW CANDLE {time: 9:30:00, O: 14.25, H: 14.25, L: 14.25, C: 14.25, V: 1000}
             → Call onTick() with new bar

9:30:05.250 - WebSocket message Type 1
             → LTP: 14.30, Volume: 1500
             → candleTime = 9:30:00.000 (same)
             → cached candle EXISTS with same time
             → UPDATE EXISTING: {H: 14.30, C: 14.30, V: 1500}
             → Call onTick() with updated bar

9:30:15.800 - WebSocket message Type 1
             → LTP: 14.20, Volume: 2000
             → candleTime = 9:30:00.000 (same)
             → UPDATE EXISTING: {L: 14.20, C: 14.20, V: 2000}
             → Call onTick()

9:30:45.500 - WebSocket message Type 1
             → LTP: 14.35, Volume: 3000
             → candleTime = 9:30:00.000 (same)
             → UPDATE EXISTING: {H: 14.35, C: 14.35, V: 3000}
             → Call onTick()

9:31:00.050 - WebSocket message Type 1  ⭐ NEW CANDLE!
             → LTP: 14.40, Volume: 3500
             → candleTime = align(9:31:00.050) = 9:31:00.000  ← Different time!
             → cached candle time != candleTime
             → CREATE NEW CANDLE {time: 9:31:00, O: 14.40, H: 14.40, L: 14.40, C: 14.40, V: 500}
             → Call onTick() with new bar
             → Previous candle (9:30) is now "frozen" with final values
```

### Key Algorithm

```javascript
// Time alignment
function alignTimeToInterval(timestamp, resolution) {
    if (resolution includes seconds "S") {
        let seconds = parseInt(resolution)  // "5S" -> 5
        return Math.floor(timestamp / (1000 * seconds)) * (1000 * seconds)
    } else {
        let minutes = parseInt(resolution)  // "5" -> 5
        let marketOpenTime = getMarketOpenTime()
        let timestampSeconds = timestamp / 1000
        
        // Round down to interval boundary from market open
        timestampSeconds -= 60 * (timestampSeconds % marketOpenTime / 60 % minutes)
        return timestampSeconds * 1000
    }
}

// Candle update decision
if (cachedCandle && cachedCandle.time == align(newTimestamp)) {
    // SAME CANDLE - Update H/L/C/V
    updateExistingCandle()
} else {
    // NEW CANDLE - Create fresh
    createNewCandle()
}
```

---

## Type 3: OHLC Update

This message type provides complete OHLC data for a bar (typically sent at end of period):

### Binary Structure

```
Bytes 0-4: Header (exchange + security ID)
Bytes 11-14: Open (Float32)
Bytes 15-18: High (Float32)
Bytes 19-22: Low (Float32)
Bytes 23-26: Close (Float32)
```

### Handler: `updateOHLC()`

```javascript
updateOHLC(buffer) {
    // Parse OHLC data
    let exchangeCode = new Uint8Array(buffer.slice(0, 1))[0]
    let securityId = new Uint32Array(buffer.slice(1, 5))[0]
    let open = new Float32Array(buffer.slice(11, 15))[0]
    let high = new Float32Array(buffer.slice(15, 19))[0]
    let low = new Float32Array(buffer.slice(19, 23))[0]
    let close = new Float32Array(buffer.slice(23, 27))[0]
    
    let symbolKey = this.getSegKey(exchangeCode, securityId).tempkey
    
    // Update cached data
    if (this.ltpMapData[symbolKey]) {
        this.ltpMapData[symbolKey].OPEN = parseFloat(open).toFixed(2)
        this.ltpMapData[symbolKey].HIGH = parseFloat(high).toFixed(2)
        this.ltpMapData[symbolKey].LOW = parseFloat(low).toFixed(2)
        this.ltpMapData[symbolKey].CLOSE = parseFloat(close).toFixed(2)
    }
}
```

---

## Caching Strategy

### In-Memory Cache Structure

```javascript
// Symbol-level cache
ltpMapData = {
    "NSE-E-14366": {  // Key format: EXCHANGE-SEGMENT-SEC_ID
        SYMBOL: "NSE:IDEA-EQ",
        CUR_LTP: 14.25,
        OPEN: 14.00,
        HIGH: 14.50,
        LOW: 13.80,
        CLOSE: 14.25,
        VOLUME: 1234567,
        LTT: 1700000000,  // Last trade time
        PRV_CLOSE: 14.10,
        CHANGE: 0.15,
        CHANGE_PER: 1.06,
        new_tick: true,   // Flag for pending update
        // ... other fields
    }
}

// Chart subscription cache
chartsStramDataReq = {
    "chart_1": {
        KEY: "NSE-E-14366",
        symbol: {
            security_id: 14366,
            exchange: "NSE",
            segment: "E",
            suffix: "",
            session: "0915-1530",
            
            // Per-resolution candle cache
            "cache_1": {LTT: timestamp, OPEN: 14.00, HIGH: 14.25, LOW: 14.00, CLOSE: 14.20, VOL: 1000},
            "cache_5": {LTT: timestamp, OPEN: 14.00, HIGH: 14.30, LOW: 13.95, CLOSE: 14.25, VOL: 5000},
            "cache_D": {LTT: timestamp, OPEN: 14.00, HIGH: 14.50, LOW: 13.80, CLOSE: 14.25, VOL: 1234567}
        },
        resolution: "1",  // Current resolution
        onTick: function(bar) { /* Update chart */ },
        lastUpdatedTime: timestamp
    }
}
```

### Cache Update Flow

```
1. WebSocket receives Type 1 (LTP) message
   ↓
2. ltpBind() updates ltpMapData["NSE-E-14366"]
   ↓
3. doChartUpdate() finds all charts watching this symbol
   ↓
4. For each chart:
   - Get cached candle from symbol["cache_" + resolution]
   - Check if same time period or new
   - Update or create candle
   - Call onTick() callback
   ↓
5. TradingView's onTick() receives bar → series.update(bar)
   ↓
6. Chart re-renders with updated candle
```

---

## Implementation Guide

### Step 1: WebSocket Setup

```javascript
class DhanWebSocketClient {
    constructor(clientId, token, tabId) {
        this.ws = null
        this.clientId = clientId
        this.token = token
        this.tabId = tabId
        this.symbolCache = {}  // Cache for symbol data
        this.chartSubscriptions = {}  // Active chart subscriptions
    }
    
    connect() {
        this.ws = new WebSocket('wss://price-feed-tv.dhan.co/')
        this.ws.binaryType = 'arraybuffer'
        
        this.ws.onopen = () => this.sendHandshake()
        this.ws.onmessage = (event) => this.handleMessage(event)
        this.ws.onclose = () => this.reconnect()
    }
    
    sendHandshake() {
        let buffer = new ArrayBuffer(703)
        let view = new DataView(buffer)
        
        // Message type: 41 (handshake)
        view.setUint8(0, 41)
        
        // Client ID (30 bytes, padded)
        this.writeString(view, 1, this.clientId, 30)
        
        // Token (50 bytes, padded)
        this.writeString(view, 31, this.token, 50)
        
        // Tab ID
        this.writeString(view, 81, this.tabId, 10)
        
        this.ws.send(buffer)
    }
    
    subscribe(symbol) {
        let buffer = new ArrayBuffer(129)
        let view = new DataView(buffer)
        
        // Message type: 21 (subscribe)
        view.setUint8(0, 21)
        view.setUint16(1, 129, true)
        
        // Client ID
        this.writeString(view, 3, this.clientId, 30)
        
        // Token
        this.writeString(view, 33, this.token, 50)
        
        // Exchange/Segment code
        view.setUint8(83, this.getExchangeCode(symbol.exchange, symbol.segment))
        
        // Placeholder
        view.setInt32(84, -1)
        
        // Script type (1 for regular)
        view.setUint8(88, 1)
        
        // Script name (placeholder)
        this.writeString(view, 89, "abc", 20)
        
        // Security ID
        this.writeString(view, 109, symbol.secId.toString(), 20)
        
        this.ws.send(buffer)
    }
    
    handleMessage(event) {
        let buffer = event.data
        let view = new DataView(buffer)
        let offset = 0
        
        while (offset < buffer.byteLength) {
            // Parse header
            let exchangeCode = view.getUint8(offset)
            let securityId = view.getUint32(offset + 1, true)
            let messageLength = view.getUint8(offset + 9)
            let messageType = view.getUint8(offset + 10)
            
            if (messageLength < 11) break
            
            // Extract message data
            let messageData = buffer.slice(offset, offset + messageLength)
            
            // Route to handler
            this.routeMessage(messageType, messageData, exchangeCode, securityId)
            
            offset += messageLength
        }
    }
    
    routeMessage(type, data, exchange, secId) {
        const symbolKey = `${exchange}-${secId}`
        
        switch(type) {
            case 1:  // LTP
                this.handleLTP(data, symbolKey)
                break
            case 3:  // OHLC
                this.handleOHLC(data, symbolKey)
                break
            case 14:  // Heartbeat
                console.log('❤️ Heartbeat received')
                break
            // ... other types
        }
    }
    
    handleLTP(data, symbolKey) {
        let view = new DataView(data)
        
        // Parse LTP data
        let ltp = view.getFloat32(11, true)
        let volume = view.getUint32(17, true)
        let timestamp = view.getUint32(25, true)
        
        // Update cache
        if (!this.symbolCache[symbolKey]) {
            this.symbolCache[symbolKey] = {}
        }
        
        this.symbolCache[symbolKey].CUR_LTP = ltp
        this.symbolCache[symbolKey].VOLUME = volume
        this.symbolCache[symbolKey].LTT = timestamp * 1000
        
        // Update all charts watching this symbol
        this.updateCharts(symbolKey)
    }
    
    updateCharts(symbolKey) {
        for (let chartId in this.chartSubscriptions) {
            let sub = this.chartSubscriptions[chartId]
            
            if (sub.symbolKey === symbolKey) {
                this.updateCandle(sub, this.symbolCache[symbolKey])
            }
        }
    }
    
    updateCandle(subscription, tickData) {
        let resolution = subscription.resolution  // "1", "5", "D", etc.
        let candleTime = this.alignTime(tickData.LTT, resolution)
        
        let cacheKey = `candle_${resolution}`
        let cached = subscription[cacheKey]
        
        if (cached && cached.time === candleTime) {
            // UPDATE EXISTING CANDLE
            cached.high = Math.max(cached.high, tickData.CUR_LTP)
            cached.low = Math.min(cached.low, tickData.CUR_LTP)
            cached.close = tickData.CUR_LTP
            cached.volume = tickData.VOLUME
        } else {
            // CREATE NEW CANDLE
            cached = {
                time: candleTime / 1000,  // Lightweight Charts uses seconds
                open: tickData.CUR_LTP,
                high: tickData.CUR_LTP,
                low: tickData.CUR_LTP,
                close: tickData.CUR_LTP,
                volume: tickData.VOLUME
            }
            subscription[cacheKey] = cached
        }
        
        // Call chart update callback
        if (subscription.onUpdate) {
            subscription.onUpdate(cached)
        }
    }
    
    alignTime(timestamp, resolution) {
        if (resolution === 'D') {
            // Daily - align to midnight
            let date = new Date(timestamp)
            date.setHours(0, 0, 0, 0)
            return date.getTime()
        } else {
            // Intraday - align to interval
            let minutes = parseInt(resolution)
            let ms = minutes * 60 * 1000
            return Math.floor(timestamp / ms) * ms
        }
    }
    
    writeString(view, offset, str, length) {
        for (let i = 0; i < length; i++) {
            if (i < str.length) {
                view.setUint8(offset + i, str.charCodeAt(i))
            } else {
                view.setUint8(offset + i, 0)
            }
        }
    }
    
    getExchangeCode(exchange, segment) {
        // Map exchange-segment to code
        const codes = {
            'NSE-E': 1,
            'NSE-D': 2,
            'BSE-E': 3,
            'BSE-D': 4,
            // ... more mappings
        }
        return codes[`${exchange}-${segment}`] || 1
    }
}
```

### Step 2: Integrate with Lightweight Charts

```javascript
class RealtimeChart {
    constructor(container, wsClient) {
        this.chart = LightweightCharts.createChart(container)
        this.series = this.chart.addCandlestickSeries()
        this.wsClient = wsClient
        this.subscription = null
    }
    
    async init(symbol, resolution) {
        // Load historical data first
        const historical = await this.fetchHistoricalData(symbol, resolution)
        this.series.setData(historical)
        
        // Subscribe to WebSocket updates
        this.subscription = {
            symbolKey: `${symbol.exchange}-${symbol.secId}`,
            resolution: resolution,
            onUpdate: (bar) => {
                // ⭐ THIS IS WHERE REAL-TIME UPDATES HAPPEN
                this.series.update(bar)
                console.log(`📊 Updated candle: ${JSON.stringify(bar)}`)
            }
        }
        
        this.wsClient.chartSubscriptions[`chart_${Date.now()}`] = this.subscription
        this.wsClient.subscribe(symbol)
    }
    
    async fetchHistoricalData(symbol, resolution) {
        // Fetch from /getData API
        const response = await fetch('/api/getData', {
            method: 'POST',
            body: JSON.stringify({
                EXCHANGE: symbol.exchange,
                SEGMENT: symbol.segment,
                SEC_ID: symbol.secId,
                START: getStartTimestamp(),
                END: getNowTimestamp(),
                INTERVAL: resolution
            })
        })
        
        const data = await response.json()
        return this.processHistoricalData(data.data)
    }
    
    processHistoricalData(data) {
        return data.Time.map((time, i) => ({
            time: new Date(time).getTime() / 1000,
            open: parseFloat(data.o[i]),
            high: parseFloat(data.h[i]),
            low: parseFloat(data.l[i]),
            close: parseFloat(data.c[i]),
            volume: parseInt(data.v[i])
        }))
    }
}

// Usage
const wsClient = new DhanWebSocketClient(clientId, token, tabId)
wsClient.connect()

const chart = new RealtimeChart(document.getElementById('chart'), wsClient)
await chart.init({
    exchange: 'NSE',
    segment: 'E',
    secId: 14366  // Vodafone Idea
}, '1')  // 1-minute chart
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Opens Chart                                            │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Fetch Historical Data via /getData API                  │
│    POST {EXCHANGE, SEGMENT, SEC_ID, START, END, INTERVAL}  │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Display Initial Candles with series.setData()           │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Connect WebSocket                                        │
│    wss://price-feed-tv.dhan.co/                            │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Send 703-byte Handshake                                 │
│    Type: 41, ClientID, Token, TabID                        │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Send 129-byte Subscription                              │
│    Type: 21, Exchange Code, Security ID                    │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Receive Binary WebSocket Messages                       │
│    Every 100-500ms                                          │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ updateRawBroadcast() - Message Router                      │
│                                                              │
│ Parse message type from byte 10:                            │
│   Type 1  → ltpBind()         [LTP Update]                 │
│   Type 3  → updateOHLC()      [OHLC Bar]                   │
│   Type 14 → heartbeat()       [Keep-alive]                 │
│   Type 32 → updatePrevClose() [Reference]                  │
│   Type 33 → updateCircuitLimits() [Limits]                 │
│   etc.                                                       │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ ltpBind() - Parse Binary LTP Data                          │
│   Extract: LTP, Volume, Timestamp                          │
│   Update: ltpMapData[symbolKey]                            │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ doChartUpdate(symbolKey)                                    │
│   For each chart watching this symbol...                   │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ updateChartsData() - Candle Logic                          │
│                                                              │
│ 1. Align timestamp to interval boundary                    │
│    (e.g., 9:30:15 → 9:30:00 for 1min)                      │
│                                                              │
│ 2. Check cached candle time:                               │
│    IF same time:                                            │
│      → UPDATE high = max(high, ltp)                        │
│      → UPDATE low = min(low, ltp)                          │
│      → UPDATE close = ltp                                  │
│      → UPDATE volume += new volume                         │
│    ELSE:                                                    │
│      → CREATE NEW candle                                   │
│      → open = high = low = close = ltp                     │
│                                                              │
│ 3. Format bar object                                       │
│ 4. Throttle (max 2.5 updates/sec)                          │
│ 5. Call chartSubscription.onTick(bar)                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ TradingView onTick() Callback                              │
│   → series.update(bar)                                     │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Chart Renders Updated Candle                               │
│   User sees live candle movement! 📈                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Findings

1. **10 Message Types** received after handshake/subscription
2. **Type 1 (LTP)** is most critical for real-time chart updates
3. **Time Alignment** determines same vs. new candle
4. **Candle Caching** per resolution prevents redundant calculations
5. **Throttling** limits updates to 2.5/second (400ms minimum)
6. **Binary Protocol** for efficiency

### Implementation Checklist

- [ ] WebSocket connection with 703-byte handshake
- [ ] 129-byte subscription per symbol
- [ ] Binary message parser (handles 10 types)
- [ ] LTP handler (Type 1) - extracts price/volume/time
- [ ] Time alignment algorithm (interval boundaries)
- [ ] Candle cache per resolution
- [ ] Same vs. new candle decision logic
- [ ] High/Low/Close/Volume update logic
- [ ] onTick() callback integration
- [ ] Throttling mechanism (400ms minimum)
- [ ] Reconnection on disconnect
- [ ] Heartbeat (Type 14) handling

**Next Steps**: Use this analysis to implement WebSocket real-time updates in your Lightweight Charts application!

---

## 📍 The Horizontal Dotted Price Line (Last Value Marker)

### Your Assumption: CORRECT! ✅

**Your assumption**: "The dotted line showing last traded value is always the current candle's close"

**Answer**: **YES, you are 100% CORRECT!**

### How It Works in Dhan's TradingView

The horizontal dotted line that follows the current price is **NOT manually drawn** - it's a **built-in feature** of TradingView's charting library that automatically tracks the last value in the series.

### The Real Implementation (From bundle2.1.37.js)

**Location**: TradingView widget initialization (Lines 11982-12000)

```javascript
// Dhan's actual TradingView initialization
window.tvChart = Xi = new (TradingView.widget)({
    fullscreen: true,
    load_last_chart: true,
    symbol: symbolString,
    interval: null,
    container: "tv_chart_container",
    datafeed: dataFeedInstance,
    library_path: "./charting_library/",
    // ... other config
})
```

**The price line is NOT configured here** - it's a **default behavior** of TradingView series!

### What Actually Controls It

When you call `series.update(bar)` with new candle data, TradingView **automatically**:

1. Takes the `close` value from the latest bar
2. Draws a horizontal line at that price level
3. Updates it every time you call `update()`

```javascript
// From updateChartsData() - Lines 13910-13918
chartSubscription.onTick({
    time: candleTime,
    close: Number(cachedCandle.CLOSE),  // ← This value
    open: Number(cachedCandle.OPEN),
    high: Math.max(...),
    low: Math.min(...),
    volume: Number(cachedCandle.VOL)
})

// This triggers TradingView's built-in behavior:
// series.update(bar)  ← Automatically updates the horizontal line to bar.close
```

### The Flow

```
WebSocket Type 1 (LTP) message arrives
    ↓
Parse: CUR_LTP = 14.25
    ↓
updateChartsData() updates cached candle:
    cachedCandle.CLOSE = 14.25  ← New close value
    ↓
Call chartSubscription.onTick({...close: 14.25...})
    ↓
TradingView's onTick() → series.update({...close: 14.25...})
    ↓
TradingView AUTOMATICALLY updates horizontal line to 14.25
    ↓
User sees dotted line move to new price! 📈
```

### For Lightweight Charts Implementation

In Lightweight Charts (which you're using), the price line is controlled by **series options**:

#### Option 1: Automatic (Default)

```javascript
const series = chart.addCandlestickSeries({
    // Price line is ENABLED by default
    // It automatically shows at the last bar's close value
})

// When you update:
series.update({
    time: timestamp,
    open: 14.00,
    high: 14.50,
    low: 13.80,
    close: 14.25  // ← Price line automatically moves here
})
```

#### Option 2: Customized Appearance

```javascript
const series = chart.addCandlestickSeries({
    // Customize the last value price line
    lastValueVisible: true,  // Show/hide the price marker on right axis
    
    // The horizontal line itself (called "crosshair price line")
    // is part of the price scale options
})

// Configure price scale
chart.priceScale('right').applyOptions({
    // These control the horizontal price line behavior
    borderVisible: true,
    borderColor: '#2962FF',
    
    // Last price animation
    lastPriceAnimation: LightweightCharts.LastPriceAnimationMode.Continuous
})
```

#### Option 3: Custom Price Lines (If You Want Multiple)

```javascript
// Dhan doesn't use this, but you can add custom horizontal lines:
const priceLine = series.createPriceLine({
    price: 14.25,
    color: '#f0f',
    lineWidth: 2,
    lineStyle: LightweightCharts.LineStyle.Dotted,  // ← Dotted line
    axisLabelVisible: true,
    title: 'LTP: 14.25'
})

// Update it manually when price changes:
priceLine.applyOptions({
    price: 14.30,  // New price
    title: 'LTP: 14.30'
})
```

### What Dhan Actually Does (Simplified)

**Dhan uses the DEFAULT behavior** - they don't create custom price lines. The horizontal dotted line you see is the **built-in "last value marker"** that comes with TradingView.

Here's the exact flow in their code:

1. **WebSocket receives LTP update** (Type 1 message)
2. **`ltpBind()`** extracts `CUR_LTP = 14.25`
3. **`updateChartsData()`** updates `cachedCandle.CLOSE = 14.25`
4. **`onTick()`** is called with `{...close: 14.25...}`
5. **TradingView's `series.update()`** is invoked
6. **TradingView automatically** moves the horizontal line to 14.25

### Proof from the Code

**Line 13826** in `updateChartsData()`:
```javascript
cachedCandle.CLOSE = +data[priceField]  // ← Close updated with latest LTP
```

**Line 13847** in `updateChartsData()`:
```javascript
let close = Number(cachedCandle.CLOSE)  // ← Extract close
```

**Line 13910-13918** in `updateChartsData()`:
```javascript
chartSubscription.onTick({
    time: candleTime,
    close: close,  // ← Passed to chart
    open: open,
    high: high,
    low: low,
    volume: volume
})
```

This `onTick()` callback ultimately calls TradingView's `series.update()`, which **automatically** draws/updates the horizontal price line.

### Implementation for Your App

```javascript
class RealtimeChart {
    constructor(container) {
        this.chart = LightweightCharts.createChart(container)
        
        this.series = this.chart.addCandlestickSeries({
            // ✅ DEFAULT: Price line is automatically enabled
            // It will show at the last bar's close value
            
            // Optional: Customize appearance
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
        })
    }
    
    handleWebSocketUpdate(ltpData) {
        // Update candle close with latest LTP
        let currentCandle = this.getCurrentCandle()
        currentCandle.close = ltpData.CUR_LTP  // ← Update close
        
        // Update chart - price line automatically moves!
        this.series.update({
            time: currentCandle.time,
            open: currentCandle.open,
            high: Math.max(currentCandle.high, ltpData.CUR_LTP),
            low: Math.min(currentCandle.low, ltpData.CUR_LTP),
            close: ltpData.CUR_LTP,  // ← Price line moves here
            volume: currentCandle.volume
        })
        
        // That's it! The horizontal line automatically updates! ✨
    }
}
```

### Visual Representation

```
Chart Display:

           15.00 ├─────────────────────────────────────
                 │
           14.50 ├─────────────────────────────────────
                 │         ┃
                 │         ┃ (Current candle)
           14.25 ├─────────╋╋╋╋╋╋╋╋╋─────────────────  ← Horizontal dotted line (last value)
                 │         ┃ ┃
           14.00 ├─────────╋─╋───────────────────────
                 │           ┃
           13.50 ├─────────────────────────────────────
                 │
                 └──────────────────────────────────────
                          9:30   9:31   9:32

When LTP changes to 14.30:
           15.00 ├─────────────────────────────────────
                 │
           14.50 ├─────────────────────────────────────
                 │         ┃
           14.30 ├─────────╋╋╋╋╋╋╋╋╋─────────────────  ← Line moves up automatically!
                 │         ┃ ┃
           14.00 ├─────────╋─╋───────────────────────
                 │           ┃
           13.50 ├─────────────────────────────────────
```

### Key Takeaways

1. ✅ **Your assumption is correct**: The dotted line = current candle's close
2. ✅ **It's automatic**: No manual drawing needed
3. ✅ **Updates via `series.update()`**: Every time you update the candle, line moves
4. ✅ **Built into the library**: TradingView/Lightweight Charts does this by default
5. ✅ **Controlled by close value**: `bar.close` determines the line position

### Dhan's Actual Code Summary

**NO special code for the price line!** They just:
1. Update `cachedCandle.CLOSE` with latest LTP
2. Call `onTick()` with the updated close value
3. TradingView handles the rest automatically

That's the beauty of using a professional charting library - features like the last value marker come **built-in**! 🎉
