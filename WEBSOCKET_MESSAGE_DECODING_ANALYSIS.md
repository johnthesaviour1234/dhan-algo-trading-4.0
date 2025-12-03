# WebSocket Message Decoding Analysis

## Overview
This document details how Dhan's WebSocket implementation decodes incoming binary messages after subscription. The decoding logic is found in `bundle2.1.36.js` within the `vn` class (WebSocket Feed Manager).

---

## Connection Setup

### Initial Handshake (703 Bytes)
**Location**: Lines 13657-13705

```javascript
this.websocket.binaryType = "arraybuffer";

// First message - 703 bytes authentication packet
let n = 0
let s = new ArrayBuffer(703)
let o = new DataView(s, 0, s.byteLength);

o.setInt8(n, 41);  // Message Type: 41 (Authentication)
n++;
o.setUint16(n, 703, true);  // Packet Size
n += 2;

// Followed by:
// - ID (30 bytes)
// - Token (50 bytes)  
// - Hash/Signature (500 bytes)
// - App Version (50 bytes)
// - Client ID (50 bytes)
// - Source (10 bytes)
// - Connection Type "C" (10 bytes)
```

### Subscription Messages (129 Bytes)
**Location**: Lines 14243-14271, 14281-14309

```javascript
// Subscribe to LTP (Last Traded Price) - Message Type: 24
let l = new ArrayBuffer(129)
let r = new DataView(l, 0, l.byteLength);

r.setInt8(a, 24);  // Message Type: 24 for LTP subscription
a++;
r.setUint16(a, 129, true);  // Packet Size
a += 2;

// Followed by:
// - ID (30 bytes)
// - Token (50 bytes)
// - Exchange Code (1 byte)
// - -1 marker (4 bytes)
// - Flag (1 byte)
// - "abc" identifier (20 bytes)
// - Security ID (20 bytes)
```

**Message Type 13**: Unsubscribe (same 129-byte structure)
**Message Type 23**: Subscribe to Market Depth
**Message Type 25**: Unsubscribe from Market Depth

---

## Message Reception & Parsing

### Main Message Handler
**Location**: Lines 13566-13626 (`updateRawBroadcast` method)

```javascript
updateRawBroadcast(t) {
    let n = t.data        // Raw ArrayBuffer from WebSocket
    let s = n.byteLength  // Total message size
    let a = 0             // Current position offset
    let l = n;            // Working buffer

    // Skip single-byte messages
    if (1 == s) return;
    
    let r = [];  // Array to track updated symbols
    
    // Loop through all packets in the message
    for (; a < s; ) {
        // Read packet header (11 bytes)
        let t = new Uint8Array(l.slice(0, 1))[0].toString()    // Byte 0: Exchange Type
        let e = new Uint32Array(l.slice(1, 5))[0]              // Bytes 1-4: Security ID
        let o = new Uint8Array(l.slice(9, 10))[0];             // Byte 9: Packet Length
        
        if (o < 11) return;  // Invalid packet
        
        a += o;  // Move offset forward
        
        // Byte 10: Message Type - determines which decoder to use
        switch (new Uint8Array(l.slice(10, 11))[0]) {
            case 1:  // LTP Update (Full)
                this.updateLTP(l);
                break;
            case 2:  // Market Depth (5 levels)
                this.updateMbp(l);
                break;
            case 3:  // OHLC Update
                this.updateOHLC(l);
                break;
            case 5:  // Quote Update
                this.updateQuote(l);
                break;
            case 6:  // Top Bid/Ask
                this.updateTopBidAsk(l);
                break;
            case 14: // Heartbeat
                this.sendHeartBeat();
                break;
            case 32: // Previous Close/OI
                this.updatePrevCloseOI(l);
                break;
            case 33: // Upper/Lower Circuit Limits
                this.updateCircuitLimits(l);
                break;
            case 36: // 52-Week High/Low
                this.update52WeekHL(l);
                break;
            case 37: // OI Update Only
                this.updateOI(l);
                break;
        }
        
        // Slice buffer for next packet
        l = n.slice(a, s);
        
        // Track this symbol for callback
        let c = this.getSegKey(t, e);
        r.indexOf(c.tempkey) < 0 && r.push(c.tempkey);
    }
    
    // Trigger callbacks for all updated symbols
    for (let e = 0; e < r.length; e++)
        this.sendCallBack(r[e]);
}
```

---

## Message Type Decoders

### Message Type 1: Full LTP Update
**Location**: Lines 13945-13993

**Binary Structure** (37+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 15-16: Last Traded Quantity (Uint16)
Bytes 11-14: ? (Float32)
Bytes 17-20: Volume (Uint32)
Bytes 21-24: ATP (Average Traded Price) (Float32)
Bytes 25-28: Open Interest (Uint32)
Bytes 29-32: ? (Uint32)
Bytes 33-36: ? (Uint32)
```

**Decoder**:
```javascript
updateLTP(t) {
    var n = [];
    n[0] = new Uint8Array(t.slice(0, 1))[0].toString()        // Exchange
    n[1] = new Uint32Array(t.slice(1, 5))[0].toString()       // Security ID
    n[2] = new Uint16Array(t.slice(15, 17))[0].toString()     // LTQ
    n[5] = new Float32Array(t.slice(11, 15))[0].toString()    // LTP
    n[7] = new Uint32Array(t.slice(17, 21))[0].toString()     // Volume
    n[8] = new Float32Array(t.slice(21, 25))[0].toString()    // ATP
    n[9] = new Uint32Array(t.slice(25, 29))[0].toString()     // OI
    n[10] = new Uint32Array(t.slice(29, 33))[0].toString()    // Timestamp
    n[11] = new Uint32Array(t.slice(33, 37))[0].toString()    // ?
    
    this.bindLtpFeed(n);  // Process and store data
}
```

**Data Processing**:
```javascript
bindLtpFeed(t) {
    let key = this.getSegKey(t[0], t[1]).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key].LTQ = t[2];          // Last Traded Quantity
        this.ltpMapData[key].new_tick = true;
        this.ltpMapData[key].VOLUME = t[7];       // Volume
        this.ltpMapData[key].ATP = parseFloat(t[8]).toFixed(decimals);
        
        if (4294967295 != t[9]) {  // Valid OI
            this.ltpMapData[key].OI = t[9];
            // Calculate OI change
            this.ltpMapData[key].OI_CHANGE = this.ltpMapData[key].OI - this.ltpMapData[key].PRV_OI;
            this.ltpMapData[key].OI_PERCHANGE = this.ltpMapData[key].OI_CHANGE / this.ltpMapData[key].PRV_OI * 100;
        }
        
        this.ltpMapData[key].LTT = this.julianToDate(t[10]);  // Last Trade Time
        this.ltpMapData[key].CUR_LTP = parseFloat(t[5]).toFixed(decimals);
        
        // Calculate change from previous close
        this.ltpMapData[key].CHANGE = (this.ltpMapData[key].CUR_LTP - this.ltpMapData[key].PRV_CLOSE).toFixed(decimals);
        this.ltpMapData[key].CHANGE_PER = (100 * this.ltpMapData[key].CHANGE / this.ltpMapData[key].PRV_CLOSE).toFixed(decimals);
    }
}
```

---

### Message Type 2: Market Depth (MBP - Market By Price)
**Location**: Lines 13994-14039

**Binary Structure** (51+ bytes for 5 levels):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11+:   5 levels of Bid/Ask data (8 bytes each)
  
Each level (20 bytes total - 10 for bid, 10 for ask):
  Bytes 0-3:   Quantity (Uint32)
  Bytes 4-7:   Orders (Uint16)
  Bytes 8-11:  Price (Float32)
```

**Decoder**:
```javascript
updateMbp(t) {
    let n = new Uint8Array(t.slice(0, 1))[0].toString();
    let s = new Uint32Array(t.slice(1, 5))[0].toString();
    let key = this.getSegKey(n, s).tempkey;
    
    if (null != this.MbpMapData[key]) {
        let asks = [];
        let bids = [];
        let s = 11;  // Start position
        
        // Parse 5 levels
        for (let i = 0; i < 5; i++) {
            let bid = {};
            let ask = {};
            
            bid.volume = Number(new Uint32Array(t.slice(s, s + 4))[0].toString());
            s += 4;
            ask.volume = Number(new Uint32Array(t.slice(s, s + 4))[0].toString());
            s += 4;
            bid.orders = new Uint16Array(t.slice(s, s + 2))[0].toString();
            s += 2;
            ask.orders = new Uint16Array(t.slice(s, s + 2))[0].toString();
            s += 2;
            bid.price = +parseFloat(new Float32Array(t.slice(s, s + 4))[0].toString()).toFixed(decimals);
            s += 4;
            ask.price = +parseFloat(new Float32Array(t.slice(s, s + 4))[0].toString()).toFixed(decimals);
            s += 4;
            
            asks.push(ask);
            bids.push(bid);
        }
        
        this.MbpMapData[key].asks = asks;
        this.MbpMapData[key].bids = bids;
        
        // Trigger depth callbacks
        let data = {
            asks: asks,
            bids: bids,
            snapshot: true,
            total_buy: this.ltpMapData[key].TOTAL_BUY || 0,
            total_sell: this.ltpMapData[key].TOTAL_SELL || 0
        };
        
        for (let i = 0; i < this.MbpMapData[key].cb.length; i++)
            this.MbpMapData[key].cb[i].cb(data);
    }
}
```

---

### Message Type 3: OHLC Update
**Location**: Lines 14054-14067

**Binary Structure** (27+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 5-8:   Open (Float32)
Bytes 15-18: Close (Float32)
Bytes 19-22: High (Float32)
Bytes 23-26: Low (Float32)
```

**Decoder**:
```javascript
bindOHLCFeed(t) {
    let key = this.getSegKey(t[0], t[1]).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key].OPEN = parseFloat(t[5]).toFixed(decimals);
        this.ltpMapData[key].HIGH = parseFloat(t[7]).toFixed(decimals);
        this.ltpMapData[key].LOW = parseFloat(t[8]).toFixed(decimals);
        this.ltpMapData[key].CLOSE = parseFloat(t[6]).toFixed(decimals);
    }
}
```

---

### Message Type 5: Quote Update
**Location**: Lines 14068-14101

**Binary Structure** (31+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11-14: Current LTP (Float32)
Bytes 15-18: Open (Float32)
Bytes 19-22: Previous Close (Float32)
Bytes 23-26: High (Float32)
Bytes 27-30: Low (Float32)
Bytes 31-34: Timestamp (Uint32)
```

**Decoder**:
```javascript
updateQuote(t) {
    let n = new Uint8Array(t.slice(0, 1))[0].toString();
    let s = new Uint32Array(t.slice(1, 5))[0].toString();
    let key = this.getSegKey(n, s).tempkey;
    
    if (!this.ltpMapData[key]) return;
    
    this.ltpMapData[key].PEV_LTP = this.ltpMapData[key].CUR_LTP;
    this.ltpMapData[key].CUR_LTP = parseFloat(new Float32Array(t.slice(11, 15))[0].toString()).toFixed(decimals);
    this.ltpMapData[key].CHANGE_STATUS = parseFloat(this.ltpMapData[key].PEV_LTP) < parseFloat(this.ltpMapData[key].CUR_LTP);
    this.ltpMapData[key].CHANGE_VALUE = parseFloat(this.ltpMapData[key].CUR_LTP) - parseFloat(this.ltpMapData[key].PEV_LTP);
    this.ltpMapData[key].OPEN = new Float32Array(t.slice(15, 19))[0].toString();
    
    if ("-1" != new Float32Array(t.slice(19, 23))[0].toString()) {
        this.ltpMapData[key].PRV_CLOSE = new Float32Array(t.slice(19, 23))[0].toString();
    }
    
    // Calculate percentage changes
    if ("0" == this.ltpMapData[key].PRV_CLOSE || 0 == this.ltpMapData[key].PRV_CLOSE) {
        this.ltpMapData[key].CHANGE = "0.00";
        this.ltpMapData[key].CHANGE_PER = "0.00";
    } else {
        this.ltpMapData[key].CHANGE = (parseFloat(this.ltpMapData[key].CUR_LTP) - parseFloat(this.ltpMapData[key].PRV_CLOSE)).toFixed(decimals);
        this.ltpMapData[key].CHANGE_PER = (100 * this.ltpMapData[key].CHANGE / parseFloat(this.ltpMapData[key].PRV_CLOSE)).toFixed(decimals);
    }
    
    this.ltpMapData[key].HIGH = new Float32Array(t.slice(23, 27))[0].toString();
    this.ltpMapData[key].LOW = new Float32Array(t.slice(27, 31))[0].toString();
    this.ltpMapData[key].LTT = this.julianToDate(new Uint32Array(t.slice(31, 35))[0].toString());
}
```

---

### Message Type 6: Top Bid/Ask
**Location**: Lines 14102-14144

**Binary Structure** (35+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11-14: Total Sell Qty (Uint32)
Bytes 15-18: Total Buy Qty (Uint32)
Bytes 19-22: Sell Qty at Best (Uint32)
Bytes 23-26: Buy Qty at Best (Uint32)
Bytes 27-30: Best Buy Price (Float32)
Bytes 31-34: Best Ask Price (Float32)
```

**Decoder**:
```javascript
updatetopBidAsk(t) {
    let key = this.getSegKey(t[0], t[1]).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key].TOTAL_BUY = parseFloat(t[6]);
        this.ltpMapData[key].TOTAL_SELL = parseFloat(t[5]);
        this.ltpMapData[key].TOTAL_QTY = this.ltpMapData[key].TOTAL_BUY + this.ltpMapData[key].TOTAL_SELL;
        this.ltpMapData[key].TOTAL_BUY_PER = (this.ltpMapData[key].TOTAL_BUY / this.ltpMapData[key].TOTAL_QTY * 100).toFixed(decimals);
        this.ltpMapData[key].TOTAL_SELL_PER = (this.ltpMapData[key].TOTAL_SELL / this.ltpMapData[key].TOTAL_QTY * 100).toFixed(decimals);
        
        this.ltpMapData[key].BUY_PRICE = parseFloat(t[9]).toFixed(decimals);
        this.ltpMapData[key].BUY_QTY = t[7];
        this.ltpMapData[key].SELL_QTY = t[8];
        this.ltpMapData[key].ASK = parseFloat(t[10]).toFixed(decimals);
    }
}
```

---

### Message Type 32: Previous Close & OI
**Location**: Lines 14164-14191

**Binary Structure** (19+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11-14: Previous Close (Float32)
Bytes 15-18: Previous OI (Float32)
```

**Decoder**:
```javascript
updatePrevCloseOI(t) {
    let n = new Uint8Array(t.slice(0, 1))[0].toString();
    let s = new Uint32Array(t.slice(1, 5))[0].toString();
    let key = this.getSegKey(n, s).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key].PRV_CLOSE = parseFloat(new Float32Array(t.slice(11, 15))[0].toString());
        
        if (this.ltpMapData[key].CUR_LTP > 0 && this.ltpMapData[key].PRV_CLOSE) {
            this.ltpMapData[key].CHANGE = parseFloat((this.ltpMapData[key].CUR_LTP - this.ltpMapData[key].PRV_CLOSE).toFixed(decimals));
            this.ltpMapData[key].CHANGE_PER = parseFloat((100 * this.ltpMapData[key].CHANGE / this.ltpMapData[key].PRV_CLOSE).toFixed(decimals));
        }
        
        this.ltpMapData[key].PRV_OI = parseFloat(new Float32Array(t.slice(15, 19))[0].toString());
        
        if (this.ltpMapData[key].OI && this.ltpMapData[key].PRV_OI) {
            this.ltpMapData[key].OI_CHANGE = this.ltpMapData[key].OI - this.ltpMapData[key].PRV_OI;
            this.ltpMapData[key].OI_PERCHANGE = this.ltpMapData[key].OI_CHANGE / this.ltpMapData[key].PRV_OI * 100;
        }
    }
}
```

---

### Message Type 33: Circuit Limits
**Location**: Lines 14192-14205

**Binary Structure** (19+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11-14: Upper Circuit Limit (Float32)
Bytes 15-18: Lower Circuit Limit (Float32)
```

**Decoder**:
```javascript
updateCircuitLimits(t) {
    let n = new Uint8Array(t.slice(0, 1))[0].toString();
    let s = new Uint32Array(t.slice(1, 5))[0].toString();
    let key = this.getSegKey(n, s).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key].U_LIMIT = new Float32Array(t.slice(11, 15))[0].toFixed(decimals);
        this.ltpMapData[key].L_LIMIT = new Float32Array(t.slice(15, 19))[0].toFixed(decimals);
    }
}
```

---

### Message Type 36: 52-Week High/Low
**Location**: Lines 14206-14219

**Binary Structure** (19+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11-14: 52-Week High (Float32)
Bytes 15-18: 52-Week Low (Float32)
```

**Decoder**:
```javascript
update52WeekHL(t) {
    let n = new Uint8Array(t.slice(0, 1))[0].toString();
    let s = new Uint32Array(t.slice(1, 5))[0].toString();
    let key = this.getSegKey(n, s).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key]["52_HIGH"] = new Float32Array(t.slice(11, 15))[0].toFixed(decimals);
        this.ltpMapData[key]["52_LOW"] = new Float32Array(t.slice(15, 19))[0].toFixed(decimals);
    }
}
```

---

### Message Type 37: OI Update Only
**Location**: Lines 13627-13645

**Binary Structure** (15+ bytes):
```
Byte 0:      Exchange Type (Uint8)
Bytes 1-4:   Security ID (Uint32)
Bytes 11-14: Open Interest (Uint32)
```

**Decoder**:
```javascript
updateOI(t) {
    var n = [];
    n[0] = new Uint8Array(t.slice(0, 1))[0].toString();
    n[1] = new Uint32Array(t.slice(1, 5))[0].toString();
    n[2] = new Uint32Array(t.slice(11, 15))[0];
    this.bindOIFeed(n);
}

bindOIFeed(t) {
    let key = this.getSegKey(t[0], t[1]).tempkey;
    
    if (null != this.ltpMapData[key]) {
        this.ltpMapData[key].OI = t[2];
        
        if (this.ltpMapData[key].OI && this.ltpMapData[key].PRV_OI) {
            this.ltpMapData[key].OI_CHANGE = this.ltpMapData[key].OI - this.ltpMapData[key].PRV_OI;
            this.ltpMapData[key].OI_PERCHANGE = this.ltpMapData[key].OI_CHANGE / this.ltpMapData[key].PRV_OI * 100;
        }
    }
}
```

---

## Binary Data Type Reference

### JavaScript TypedArray Usage

| Type | Bytes | Usage | Example |
|------|-------|-------|---------|
| `Uint8Array` | 1 | Exchange codes, flags, message types | Exchange type (0-10) |
| `Uint16Array` | 2 | Packet sizes, order counts | Packet length (129, 703) |
| `Uint32Array` | 4 | Security IDs, quantities, timestamps | Security ID, Volume, OI |
| `Float32Array` | 4 | Prices, percentages | LTP, High, Low, Open, Close |
| `Int8` | 1 | Signed values | Message type identifiers |

### Common Binary Patterns

```javascript
// Reading Exchange Type (1 byte)
let exchange = new Uint8Array(buffer.slice(0, 1))[0].toString();

// Reading Security ID (4 bytes, little-endian)
let securityId = new Uint32Array(buffer.slice(1, 5))[0].toString();

// Reading Price (4 bytes float, little-endian)
let price = new Float32Array(buffer.slice(11, 15))[0].toString();
let priceFixed = parseFloat(price).toFixed(2);

// Reading Quantity (4 bytes unsigned int)
let quantity = new Uint32Array(buffer.slice(17, 21))[0].toString();

// Reading Timestamp (4 bytes, Julian format)
let timestamp = new Uint32Array(buffer.slice(29, 33))[0].toString();
let dateTime = julianToDate(timestamp);
```

---

## Exchange Type Mapping

**Location**: Lines 13500-13544 (`getSegKey` method)

```javascript
getSegKey(exchangeType, securityId) {
    let tempkey = "";
    let seg = "";
    let tofix = 2;  // Default decimal places
    
    switch (exchangeType) {
        case "0":  // IDX - Indices
            tempkey = securityId + "-I-NSE";
            seg = "I";
            break;
        case "1":  // EQ - Equity NSE
            tempkey = securityId + "-E-NSE";
            seg = "E";
            break;
        case "2":  // EQ - Equity BSE
            tempkey = securityId + "-D-BSE";
            seg = "D";
            break;
        case "3":  // COM - Commodities MCX
            tempkey = securityId + "-C-MCX";
            seg = "C";
            tofix = 4;  // 4 decimal places for commodities
            break;
        case "4":  // COMM - Commodities BSE
            tempkey = securityId + "-CO-BSE";
            break;
        case "5":  // FNO - Futures & Options NSE
            tempkey = securityId + "-F-NSE";
            seg = "M";
            break;
        case "6":  // CUR - Currency
            tempkey = securityId + "-C-NSE";
            seg = "M";
            break;
        case "7":  // COM - Commodities NCDEX
            tempkey = securityId + "-C-NCDEX";
            seg = "C";
            tofix = 4;
            break;
        case "8":  // EQ - Equity BSE (alternate)
            tempkey = securityId + "-D-BSE";
            seg = "D";
            break;
        case "9":  // FNO - Options MCX
            tempkey = securityId + "-M-MCX";
            seg = "M";
            break;
        case "10": // FNO - Options NSE (alternate)
            tempkey = securityId + "-M-NSE";
            seg = "M";
            break;
    }
    
    return {
        tempkey: tempkey,
        seg: seg,
        tofix: tofix
    };
}
```

---

## Data Storage & Callbacks

### Internal Data Structure

```javascript
// LTP Data Map (Main price data)
this.ltpMapData = {
    "14366-E-NSE": {  // Key format: SecurityID-Segment-Exchange
        SYMBOL: "RELIANCE",
        SHORT_NAME: "NSE:RELIANCE",
        EXCHANGE: "NSE",
        CUR_LTP: 2450.50,
        OPEN: 2440.00,
        HIGH: 2455.00,
        LOW: 2435.00,
        PRV_CLOSE: 2445.00,
        VOLUME: 1234567,
        LTQ: 100,
        ATP: 2448.25,
        OI: 5000000,
        PRV_OI: 4950000,
        OI_CHANGE: 50000,
        OI_PERCHANGE: 1.01,
        CHANGE: 5.50,
        CHANGE_PER: 0.22,
        LTT: "2023-11-20T15:29:45",
        BUY_PRICE: 2450.25,
        BUY_QTY: 500,
        ASK: 2450.75,
        SELL_QTY: 300,
        TOTAL_BUY: 125000,
        TOTAL_SELL: 98000,
        U_LIMIT: 2689.50,
        L_LIMIT: 2200.50,
        "52_HIGH": 2850.00,
        "52_LOW": 2100.00,
        new_tick: true,
        subscribers: {
            "quote": [{ callback: fn1, symbol: "NSE:RELIANCE" }],
            "depth": [{ callback: fn2, symbol: "NSE:RELIANCE" }]
        }
    }
};

// Market Depth Data Map
this.MbpMapData = {
    "14366-E-NSE": {
        asks: [
            { price: 2450.75, volume: 300, orders: 5 },
            { price: 2451.00, volume: 500, orders: 8 },
            // ... 3 more levels
        ],
        bids: [
            { price: 2450.25, volume: 500, orders: 7 },
            { price: 2450.00, volume: 800, orders: 12 },
            // ... 3 more levels
        ],
        cb: [callbackFn1, callbackFn2]
    }
};

// Chart Subscription Data
this.chartsStramDataReq = {
    "chart_123": {
        key: "14366-E-NSE",
        symbol: { name: "RELIANCE", session: "0915-1530" },
        resolution: "1",
        onRealtimeCallback: updateChartFunction
    }
};
```

### Callback Mechanism

**Location**: Lines 13744-13790

```javascript
sendCallBack(key, skipQuote) {
    if (!this.ltpMapData[key]) return;
    
    let subscribers = this.ltpMapData[key].subscribers;
    let data = this.ltpMapData[key];
    
    // Prepare callback data
    let callbackData = {
        s: "ok",
        key: key,
        n: data.SYMBOL,
        v: {
            ch: Number(data.CHANGE),
            chp: Number(data.CHANGE_PER),
            short_name: data.SHORT_NAME.split(":")[1],
            exchange: data.EXCHANGE,
            description: data.SHORT_NAME,
            lp: Number(data.CUR_LTP),
            ask: Number(data.ASK),
            bid: Number(data.BUY_PRICE),
            spread: "",
            open_price: Number(data.OPEN),
            high_price: Number(data.HIGH),
            low_price: Number(data.LOW),
            prev_close_price: Number(data.PRV_CLOSE),
            volume: Number(data.VOLUME),
            oi: Number(data.OI),
            oichg: Number(data.OI_CHANGE),
            oichg_per: Number(data.OI_PERCHANGE),
            ltq: Number(data.LTQ),
            ltt: Number(data.LTT),
            new_tick: this.ltpMapData[key].new_tick,
            changeValue: this.ltpMapData[key].CHANGE_VALUE
        }
    };
    
    // Call all subscribers
    for (let type in subscribers) {
        if (subscribers[type]) {
            for (let i = 0; i < subscribers[type].length; i++) {
                callbackData.n = subscribers[type][i].symbol;
                if (!skipQuote || skipQuote && type != "quote") {
                    try {
                        subscribers[type][i].callback([callbackData]);
                    } catch (e) {}
                }
            }
        }
    }
    
    // Update chart data if subscribed
    for (let chartId in this.chartsStramDataReq) {
        if (this.chartsStramDataReq[chartId].key == key) {
            if (this.chartsStramDataReq[chartId].resolution.includes("S")) {
                this.updateSecondChartsData(this.chartsStramDataReq[chartId], data);
            } else {
                this.updateChartsData(this.chartsStramDataReq[chartId], data);
            }
        }
    }
    
    this.ltpMapData[key].new_tick = false;
}
```

---

## Key Implementation Insights

### 1. **Multiple Packets Per Message**
The WebSocket can send multiple update packets in a single message. The parser loops through the entire buffer, extracting each packet based on its length field (byte 9).

### 2. **Message Type Determines Structure**
Byte 10 of each packet is the message type identifier, which routes to the appropriate decoder. Each message type has a fixed binary structure.

### 3. **Little-Endian Encoding**
All multi-byte values (Uint16, Uint32, Float32) use little-endian byte order, which is JavaScript's default for TypedArrays.

### 4. **Exchange/Security Key Format**
Data is stored using a composite key: `{SecurityID}-{Segment}-{Exchange}` (e.g., "14366-E-NSE" for Reliance on NSE Equity).

### 5. **Decimal Precision**
Different asset classes have different decimal precision:
- Equities, Indices: 2 decimal places
- Commodities: 4 decimal places

### 6. **Julian Timestamp Conversion**
Timestamps are sent as Unix timestamps (seconds since 1970-01-01):

```javascript
julianToDate(unixTimestamp) {
    return new Date(unixTimestamp * 1000);  // Convert seconds to milliseconds
}
```

### 7. **Chart Data Aggregation**
Real-time ticks are aggregated into candles based on resolution:
- Second charts: Aggregate by seconds
- Minute charts: Aggregate by minutes (with market session alignment)
- Uses a "lastUpdatedObj" pattern to maintain OHLCV state

### 8. **Heartbeat Mechanism**
Message Type 14 triggers a heartbeat response to keep the connection alive. The connection has a timeout of 12 seconds of inactivity.

---

## Connection Management

### Reconnection Logic
**Location**: Lines 13419-13433

```javascript
// Reconnection timer - tries every 5 seconds
reconnectionsCount = 0;
reconnectTries = 50;
reconnectInterval = 5;

startReconnection() {
    this.isAlreadyConnected = false;
    this.connectionTimer = setInterval(() => {
        if (this.reconnectionsCount < this.reconnectTries) {
            if (this.websocket && (this.websocket.readyState == 0 || this.websocket.readyState == 2)) {
                return;  // Already connecting or closing
            }
            this.connectDhanFeedsWS();
            this.reconnectionsCount++;
        } else {
            clearInterval(this.connectionTimer);
        }
    }, 1000 * this.reconnectInterval);
}
```

### Inactivity Timeout
**Location**: Lines 13434-13446

```javascript
// Disconnect after 12 seconds of no data
lastDataRecTimeout = 12;

setConnectionTimer() {
    clearInterval(this.connectionTimer);
    this.lastDataReceivedTime = new Date;
    
    this.connectionCheckTimer = setInterval(() => {
        let timeSinceLastData = (new Date().getTime() - this.lastDataReceivedTime.getTime()) / 1000;
        
        if (timeSinceLastData > this.lastDataRecTimeout) {
            this.websocket && this.websocket.close();
            clearInterval(this.connectionCheckTimer);
            this.isAlreadyConnected = false;
            this.startReconnection();
        }
    }, 1000 * this.lastDataRecTimeout);
}
```

### Tab Visibility Handling
**Location**: Lines 13401-13418

```javascript
// Unsubscribe if tab hidden for > 10 seconds, resubscribe when visible
document.addEventListener("visibilitychange", e => {
    if ("visible" === document.visibilityState) {
        clearTimeout(this.unsubTimerGlobal);
        
        if (this.isUnscribeDone) {
            setTimeout(() => {
                this.subscribeLtpData(this.unSubscribeMapping, true);
                this.isUnscribeDone = false;
            }, 1000);
        }
    } else {
        this.unsubTimerGlobal = setTimeout(() => {
            this.unSubscribeLtpDataLocal();
            this.isUnscribeDone = true;
        }, 10000);  // 10 seconds
    }
});
```

---

## Summary

The Dhan WebSocket protocol uses a **custom binary format** with:

1. **Message framing**: Each packet has a 11-byte header (exchange, security ID, length, type)
2. **Multiple message types**: 11 different message types for various market data updates
3. **Efficient encoding**: Binary protocol using TypedArrays for compact transmission
4. **Incremental updates**: Only changed fields are sent, reducing bandwidth
5. **Composite key system**: Data indexed by `{SecurityID}-{Segment}-{Exchange}`
6. **Callback architecture**: Subscribers registered per symbol receive updates
7. **Connection resilience**: Auto-reconnect, heartbeat, and tab visibility handling

All decoders follow the same pattern:
1. Extract header (exchange type, security ID) from bytes 0-4
2. Read message type from byte 10
3. Parse remaining bytes based on message type structure
4. Convert binary to appropriate JavaScript types
5. Update internal data maps
6. Trigger callbacks for subscribers
