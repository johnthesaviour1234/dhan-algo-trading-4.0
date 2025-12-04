# How Dhan Aggregates Realtime Data Into Different Timeframes

## Overview

This document explains how Dhan's frontend receives real-time tick data via WebSocket and aggregates it into different chart timeframes (1 minute, 5 minutes, daily, etc.). The entire flow is located in `bundle2.1.37.js`.

---

## Complete Data Flow

```
WebSocket Binary Message (Type 1: LTP)
    ↓
Parse: LTP, Volume, Timestamp
    ↓
Update Symbol Cache (ltpMapData)
    ↓
Trigger Chart Update for All Watching Charts
    ↓
For Each Resolution: Align timestamp to interval boundary
    ↓
Check: Same candle or New candle?
    ↓
Update OHLCV / Create new candle
    ↓
Call chart callback (onTick)
    ↓
Chart renders updated candle
```

---

## 1. WebSocket Message Reception

### Message Router: `updateRawBroadcast()`
**Location**: Lines 13580-13640 in `bundle2.1.37.js`

```javascript
updateRawBroadcast(messageEvent) {
    let data = messageEvent.data  // ArrayBuffer
    let dataLength = data.byteLength
    let offset = 0
    let buffer = data
    
    // Update last message time (heartbeat tracking)
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
                this.ltpBind(buffer)  // LTP update (MOST IMPORTANT)
                break
            case 2:
                this.updateMBP(buffer)  // Market by Price
                break
            case 3:
                this.updateOHLC(buffer)  // Full OHLC update
                break
            case 14:
                this.heartbeat()  // Keep-alive
                break
            // ... other types
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

## 2. LTP Data Extraction

### Handler: `ltpBind()`
**Location**: Lines 13641-13680

```javascript
ltpBind(buffer) {
    // Parse binary data
    let exchangeCode = new Uint8Array(buffer.slice(0, 1))[0]
    let securityId = new Uint32Array(buffer.slice(1, 5))[0]
    let ltp = new Float32Array(buffer.slice(11, 15))[0]  // Last Traded Price
    let volume = new Uint32Array(buffer.slice(17, 21))[0]
    let timestamp = new Uint32Array(buffer.slice(25, 29))[0]
    
    // Convert to symbol key (e.g., "NSE-E-14366")
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

---

## 3. Chart Update Trigger

### Function: `doChartUpdate()`
**Location**: Lines 13803-13806

```javascript
doChartUpdate(symbolKey) {
    // For each active chart subscription watching this symbol
    for (let chartId in this.chartsStramDataReq) {
        if (this.chartsStramDataReq[chartId].KEY == symbolKey) {
            let resolution = this.chartsStramDataReq[chartId].resolution
            let data = this.ltpMapData[symbolKey]
            
            // Choose update method based on resolution
            if (resolution.includes("S")) {
                // Seconds resolution (1S, 5S, 10S, etc.)
                this.updateChartsDataResol(this.chartsStramDataReq[chartId], data)
            } else {
                // Standard resolution (1, 5, 15, 30, 60 min, D, W, M)
                this.updateChartsData(this.chartsStramDataReq[chartId], data)
            }
        }
    }
}
```

---

## 4. Time Alignment & Candle Aggregation Logic

### For Standard Resolutions: `updateChartsData()`
**Location**: Lines 13854-13918

This is the **CRITICAL FUNCTION** that aggregates tick data into candles.

```javascript
updateChartsData(chartSubscription, tickData) {
    let candleTime = 0
    let data = JSON.parse(JSON.stringify(tickData))  // Clone
    let cacheKey = "cache_" + chartSubscription.resolution
    let cachedCandle = chartSubscription.symbol[cacheKey]
    
    // For INTRADAY (I) resolutions
    if ("I" == getResolutionType(chartSubscription.resolution)) {
        // Parse timestamp and remove seconds
        data.LTT = new Date(data.LTT).setSeconds(0)
        data.LTT = new Date(data.LTT).getTime()
        candleTime = new Date(data.LTT).getTime()
        
        // ✅ TIME ALIGNMENT FOR MULTI-MINUTE INTERVALS
        // For 5, 15, 25, 60 min - align to interval boundary from market open
        if (["5", "15", "25", "60"].includes(chartSubscription.resolution)) {
            let marketOpen = chartSubscription.symbol.session.split("-")
            let openHour = marketOpen[0].substring(0, 2)
            let openMin = marketOpen[0].substring(2, 4)
            let baseTime = new Date()
            baseTime = new Date(baseTime.getFullYear(), baseTime.getMonth(), 
                              baseTime.getDate(), openHour, openMin, 0)
            baseTime = baseTime.getTime() / 1000
            
            candleTime = data.LTT / 1000
            
            // ⭐ ROUND DOWN TO INTERVAL BOUNDARY
            // Example: 9:37:00 with 5-min interval → 9:35:00
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
            
            // ✅ ACCUMULATE VOLUME (only new volume since last tick)
            if (data.VOLUME != cachedCandle.PRV_VOL) {
                cachedCandle.VOL += 1 * Number(data.VOLUME - cachedCandle.PRV_VOL)
            }
            cachedCandle.PRV_VOL = data.VOLUME
            
            // ✅ UPDATE HIGH
            if (data.CUR_LTP > cachedCandle.HIGH) {
                cachedCandle.HIGH = Math.max(data.CUR_LTP, cachedCandle.HIGH)
            }
            
            // ✅ UPDATE LOW
            if (data.CUR_LTP < cachedCandle.LOW) {
                cachedCandle.LOW = Math.min(data.CUR_LTP, cachedCandle.LOW)
            }
            
            // ✅ UPDATE CLOSE (always latest LTP)
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
        
        // ✅ FORMAT BAR FOR CHART
        let time = candleTime
        let close = Number(cachedCandle.CLOSE)
        let open = Number(cachedCandle.OPEN)
        let high = Math.max(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), 
                           Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
        let low = Math.min(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), 
                          Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
        let volume = Number(cachedCandle.VOL)
        
        // ✅ THROTTLE UPDATES (max 2.5 updates per second = 400ms)
        if (!chartSubscription.lastUpdatedTime || 
            ((new Date().getTime() - chartSubscription.lastUpdatedTime) / 1000 > 0.4)) {
            
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

---

## 5. Seconds Resolution Aggregation

### Function: `updateChartsDataResol()`
**Location**: Lines 13807-13853

For second-level resolutions (1S, 5S, 10S, etc.):

```javascript
updateChartsDataResol(chartSubscription, tickData) {
    let candleTime = 0
    let data = JSON.parse(JSON.stringify(tickData))
    let cacheKey = "cache_" + chartSubscription.resolution
    let cachedCandle = chartSubscription.symbol[cacheKey]
    
    // Parse timestamp and round to seconds
    data.LTT = new Date(data.LTT).getTime()
    candleTime = data.LTT
    
    // ✅ EXTRACT RESOLUTION VALUE (e.g., "5S" → 5)
    let resolutionValue = +chartSubscription.resolution.match(/\d+/g)[0]
    
    // ⭐ TIME ALIGNMENT: Round down to interval boundary
    // Example: 9:30:17 with 5S interval → 9:30:15
    candleTime = new Date(
        Math.floor(candleTime / (1000 * resolutionValue)) * (1000 * resolutionValue)
    ).getTime()
    
    // ✅ CHECK IF SAME CANDLE OR NEW
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
    
    // Format and send to chart
    let time = candleTime
    let close = Number(cachedCandle.CLOSE)
    let open = Number(cachedCandle.OPEN)
    let high = Math.max(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), 
                       Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
    let low = Math.min(Number(cachedCandle.OPEN), Number(cachedCandle.HIGH), 
                      Number(cachedCandle.LOW), Number(cachedCandle.CLOSE))
    let volume = Number(cachedCandle.VOL)
    
    // ⭐ CALL CHART onTick() CALLBACK (no throttling for seconds)
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

## 6. Time Alignment Algorithm Breakdown

### Example: 5-Minute Chart

```javascript
// Assume market opens at 09:15

// Tick arrives at 9:37:23
let tickTimestamp = new Date("2023-11-20 09:37:23").getTime()

// Remove seconds
tickTimestamp = new Date(tickTimestamp).setSeconds(0)  // 9:37:00

// Market open time
let marketOpen = new Date("2023-11-20 09:15:00").getTime() / 1000  // seconds

// Current time in seconds
let currentSeconds = tickTimestamp / 1000

// Resolution interval
let resolution = 5  // minutes

// Calculate offset from market open
let minutesSinceOpen = (currentSeconds - marketOpen) / 60  // 22 minutes

// Minutes within current interval
let offsetInInterval = minutesSinceOpen % resolution  // 22 % 5 = 2

// Subtract offset to align to interval start
candleTime = currentSeconds - (60 * offsetInInterval)  // 9:37:00 - 2min = 9:35:00

// Convert back to milliseconds
candleTime *= 1000
```

**Result**: Tick at 9:37:23 is aggregated into the 9:35:00 candle.

### Example: 1-Minute Chart

```javascript
// Tick arrives at 9:30:45
let tickTimestamp = new Date("2023-11-20 09:30:45").getTime()

// Remove seconds
tickTimestamp = new Date(tickTimestamp).setSeconds(0)  // 9:30:00

candleTime = tickTimestamp  // 9:30:00
```

**Result**: All ticks between 9:30:00 and 9:30:59 go into the 9:30:00 candle.

---

## 7. Candle Lifecycle Example (9:30 → 9:31)

```
9:30:00.100 - WebSocket Type 1 (LTP)
             → LTP: 14.25, Volume: 1000
             → candleTime = 9:30:00.000
             → Cached candle doesn't exist
             → CREATE NEW CANDLE {time: 9:30:00, O: 14.25, H: 14.25, L: 14.25, C: 14.25, V: 1000}
             → Call onTick() with new bar

9:30:05.250 - WebSocket Type 1
             → LTP: 14.30, Volume: 1500
             → candleTime = 9:30:00.000 (same)
             → Cached candle EXISTS with same time
             → UPDATE EXISTING: {H: 14.30, C: 14.30, V: 1500}
             → Call onTick() with updated bar

9:30:15.800 - WebSocket Type 1
             → LTP: 14.20, Volume: 2000
             → candleTime = 9:30:00.000 (same)
             → UPDATE EXISTING: {L: 14.20, C: 14.20, V: 2000}
             → Call onTick()

9:30:45.500 - WebSocket Type 1
             → LTP: 14.35, Volume: 3000
             → candleTime = 9:30:00.000 (same)
             → UPDATE EXISTING: {H: 14.35, C: 14.35, V: 3000}
             → Call onTick()

9:31:00.050 - WebSocket Type 1  ⭐ NEW CANDLE!
             → LTP: 14.40, Volume: 3500
             → candleTime = 9:31:00.000  ← Different time!
             → Cached candle time != candleTime
             → CREATE NEW CANDLE {time: 9:31:00, O: 14.40, H: 14.40, L: 14.40, C: 14.40, V: 500}
             → Call onTick() with new bar
             → Previous candle (9:30) is now "frozen" with final values
```

---

## 8. Cache Structure

### In-Memory Cache

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
        new_tick: true
    }
}

// Chart subscription cache (per resolution)
chartsStramDataReq = {
    "chart_1": {
        KEY: "NSE-E-14366",
        symbol: {
            security_id: 14366,
            exchange: "NSE",
            segment: "E",
            session: "0915-1530",
            
            // Per-resolution candle cache
            "cache_1": {
                LTT: 1700000000000,
                OPEN: 14.00,
                HIGH: 14.25,
                LOW: 14.00,
                CLOSE: 14.20,
                VOL: 1000,
                PRV_VOL: 1234567,
                FIRST_TICK: false
            },
            "cache_5": {
                LTT: 1700000000000,
                OPEN: 14.00,
                HIGH: 14.30,
                LOW: 13.95,
                CLOSE: 14.25,
                VOL: 5000,
                PRV_VOL: 1238567,
                FIRST_TICK: false
            },
            "cache_D": {
                LTT: 1700000000000,
                OPEN: 14.00,
                HIGH: 14.50,
                LOW: 13.80,
                CLOSE: 14.25,
                VOL: 1234567,
                PRV_VOL: 1234567,
                FIRST_TICK: false
            }
        },
        resolution: "1",  // Current resolution
        onTick: function(bar) { /* Update chart */ },
        lastUpdatedTime: 1700000000000
    }
}
```

---

## 9. Key Decision Logic

### Same Candle vs. New Candle

```javascript
// The critical comparison
if (cachedCandle && cachedCandle.LTT == candleTime) {
    // SAME CANDLE
    // → Update High (if LTP > current high)
    // → Update Low (if LTP < current low)
    // → Update Close (always = latest LTP)
    // → Accumulate Volume
} else {
    // NEW CANDLE
    // → Create fresh candle
    // → Open = High = Low = Close = LTP
    // → Volume = Last Traded Quantity
    // → Cache it for future updates
}
```

### Volume Accumulation

```javascript
// Tracks cumulative volume vs. previous tick
if (data.VOLUME != cachedCandle.PRV_VOL) {
    // Add only the NEW volume since last tick
    cachedCandle.VOL += Number(data.VOLUME - cachedCandle.PRV_VOL)
}
cachedCandle.PRV_VOL = data.VOLUME  // Update previous volume tracker
```

---

## 10. Complete Implementation for Your App

```javascript
class RealtimeAggregator {
    constructor() {
        this.candleCache = {}  // Symbol → Resolution → Candle
    }
    
    /**
     * Process incoming LTP tick and aggregate into candles
     */
    processTick(symbol, ltp, volume, timestamp, resolution) {
        // 1. Align timestamp to interval boundary
        const candleTime = this.alignTime(timestamp, resolution)
        
        // 2. Get cache key
        const cacheKey = `${symbol}_${resolution}`
        
        // 3. Get cached candle
        let candle = this.candleCache[cacheKey]
        
        // 4. Check if same candle or new
        if (candle && candle.time === candleTime) {
            // UPDATE EXISTING CANDLE
            candle.high = Math.max(candle.high, ltp)
            candle.low = Math.min(candle.low, ltp)
            candle.close = ltp
            
            // Volume accumulation
            if (volume !== candle.prevVolume) {
                candle.volume += (volume - candle.prevVolume)
            }
            candle.prevVolume = volume
            
        } else {
            // CREATE NEW CANDLE
            candle = {
                time: candleTime,
                open: ltp,
                high: ltp,
                low: ltp,
                close: ltp,
                volume: 0,
                prevVolume: volume
            }
            
            this.candleCache[cacheKey] = candle
        }
        
        // 5. Return formatted bar for chart
        return {
            time: candle.time / 1000,  // Lightweight Charts uses seconds
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        }
    }
    
    /**
     * Align timestamp to interval boundary
     */
    alignTime(timestamp, resolution) {
        if (resolution === 'D') {
            // Daily - align to midnight
            let date = new Date(timestamp)
            date.setHours(0, 0, 0, 0)
            return date.getTime()
        } 
        else if (resolution.includes('S')) {
            // Seconds resolution (1S, 5S, etc.)
            let seconds = parseInt(resolution)
            return Math.floor(timestamp / (1000 * seconds)) * (1000 * seconds)
        } 
        else {
            // Minutes resolution (1, 5, 15, etc.)
            let minutes = parseInt(resolution)
            let ms = minutes * 60 * 1000
            
            // Round down to interval boundary
            return Math.floor(timestamp / ms) * ms
        }
    }
}

// Usage Example
const aggregator = new RealtimeAggregator()

// Simulate WebSocket ticks for 5-minute chart
const bar1 = aggregator.processTick('IDEA', 14.25, 1000, Date.parse('2023-11-20 9:30:05'), '5')
// → Creates 9:30:00 candle: O=14.25, H=14.25, L=14.25, C=14.25

const bar2 = aggregator.processTick('IDEA', 14.30, 1500, Date.parse('2023-11-20 9:32:10'), '5')
// → Updates 9:30:00 candle: H=14.30, C=14.30

const bar3 = aggregator.processTick('IDEA', 14.40, 2000, Date.parse('2023-11-20 9:35:01'), '5')
// → Creates NEW 9:35:00 candle: O=14.40, H=14.40, L=14.40, C=14.40

// Update chart
series.update(bar1)  // First candle
series.update(bar2)  // Update same candle
series.update(bar3)  // New candle
```

---

## Summary

### The Aggregation Process

1. **WebSocket receives binary LTP message** (Type 1)
2. **Parse: LTP, Volume, Timestamp** from binary data
3. **Update symbol cache** (ltpMapData)
4. **Trigger chart updates** for all charts watching this symbol
5. **For each resolution:**
   - **Align timestamp** to interval boundary
   - **Check cached candle time**:
     - Same time → **Update H/L/C/V**
     - Different time → **Create new candle**
   - **Format bar object**
   - **Call onTick() callback**
6. **Chart library renders** updated candle

### Critical Components

| Component | Purpose |
|-----------|---------|
| **Time Alignment** | Rounds timestamp to interval boundary (e.g., 9:37:23 → 9:35:00 for 5min) |
| **Candle Cache** | Stores current candle per resolution to detect same vs. new |
| **Volume Accumulation** | Tracks delta between ticks to aggregate incremental volume |
| **Throttling** | Limits chart updates to max 2.5/sec (400ms) to prevent UI lag |
| **Update Logic** | High = max, Low = min, Close = latest LTP |

### Key Insight

**The frontend does NOT request different timeframe data from the backend.** Instead:

1. Backend sends **tick-level LTP data** via WebSocket
2. Frontend **aggregates ticks** into candles client-side
3. Each chart **maintains its own cache** per resolution
4. Same tick data feeds **all timeframes simultaneously**

This is why switching timeframes is instant - the data is already there, just aggregated differently!
