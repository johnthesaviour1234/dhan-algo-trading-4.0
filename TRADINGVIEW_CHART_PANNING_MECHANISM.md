# TradingView Chart Panning & Data Fetching Mechanism
**Based on Reverse-Engineered Dhan Implementation**

## Table of Contents
1. [Overview](#overview)
2. [The getBars Implementation](#the-getbars-implementation)
3. [How Panning Works](#how-panning-works)
4. [Request Construction](#request-construction)
5. [Response Processing](#response-processing)
6. [Caching Strategy](#caching-strategy)
7. [Implementation Guide](#implementation-guide)
8. [Best Practices](#best-practices)

---

## Overview

The Dhan TradingView integration uses **Class `Dn`** (from `bundle2.1.37.js`) to handle all chart data fetching. This class implements:

1. **Minimum Data Window**: Always fetches at least 7 days of data
2. **Smart Range Adjustment**: Normalizes times to midnight and handles IST offset
3. **Efficient Caching**: Stores up to 31 days of data with date-keyed lookup
4. **Progressive Loading**: Fetches older data only when user pans left

### Key Discovery
The implementation **does not use** `subscribeVisibleLogicalRangeChange()` for panning. Instead, it:
- Pre-calculates date ranges with minimum 7-day buffer
- Normalizes all timestamps to midnight (removes time component)
- Uses IST offset (+5.5 hours) for timezone handling
- Implements its own caching layer for performance

---

## The getBars Implementation

### Class Structure

```javascript
class Dn {
    constructor(datafeedUrl, requester) {
        this._datafeedUrl = datafeedUrl
        this._requester = requester
    }
    
    getDayDiff(dateA, dateB) { 
        // Calculate difference in days
    }
    
    getChartsRange(range, periodParams) { 
        // Adjust time range with 7-day minimum
    }
    
    getBars(symbolInfo, resolution, periodParams) { 
        // Main data fetching function
    }
}
```

---

## How Panning Works

### Method 1: `getDayDiff` - Calculate Date Difference

```javascript
getDayDiff(t, i) {
    let dayDiff = t.getTime() - i.getTime();
    return Math.floor(dayDiff / 864e5)  // 86400000ms = 1 day
}
```

**Purpose**: Determines how much historical data to fetch

---

### Method 2: `getChartsRange` - Adjust Time Range

This is the **core panning logic**:

```javascript
getChartsRange(range, periodParams) {
    // 1. Get current date and normalize times
    let currentDate = new Date((new Date).toDateString())
    let startDate = new Date(new Date(1000 * periodParams.from).toDateString());
    periodParams.from = Math.floor(startDate.getTime() / 1000);
    
    let endDate = new Date(new Date(1000 * periodParams.to).toDateString());
    periodParams.to = Math.floor(endDate.getTime() / 1000);
    
    // 2. Calculate day differences
    let daysFromNow = this.getDayDiff(currentDate, startDate)
    let daysToNow = this.getDayDiff(currentDate, endDate);
    
    // 3. Adjust for today
    if (daysToNow == 0) {
        periodParams.to += 86400  // Add 1 day (in seconds)
    }
    
    // 4. **MINIMUM 7-DAY WINDOW** - This ensures smooth panning!
    if (daysFromNow - daysToNow < 7) {
        daysFromNow += 7
        periodParams.from -= 604800  // Subtract 7 days (604800 seconds)
    }
    
    range.from = daysFromNow
    range.to = daysToNow
    
    return periodParams
}
```

### Key Insights

✅ **Normalizes all times to midnight** - Removes time component for consistency  
✅ **Always fetches at least 7 days** - Prevents repeated small requests  
✅ **Adjusts for current day** - Adds extra day to include today's data  
✅ **Returns Unix timestamps in seconds** - Standard format

---

## Request Construction

### API Endpoints

```javascript
// Standard resolutions (D, W, M)
const URL_STANDARD = 'https://ticks.dhan.co/getData';

// Seconds resolution (1s, 5s, etc.)
const URL_SECONDS = 'https://ticks.dhan.co/getDataS';
```

### IST Offset Handling

```javascript
// IST offset: +330 minutes (5.5 hours)
const IST_OFFSET = 330; // minutes

startTime = new Date(1000 * (periodParams.from + IST_OFFSET))
startTime.setHours(0)
startTime.setMinutes(0)
startTime.setSeconds(1)
```

### Request Payload Structure

```json
{
  "EXCHANGE": "NSE",
  "SEGMENT": "E",
  "INST": "EQUITY",
  "SEC_ID": "14366",
  "START": 1700000000,
  "END": 1700604800,
  "START_TIME": "Mon Nov 13 2023 00:00:01 GMT+0530",
  "END_TIME": "Mon Nov 20 2023 00:00:01 GMT+0530",
  "INTERVAL": "D"
}
```

### Complete Request Construction

```javascript
// Build payload
payload.EXCHANGE = symbolInfo.EXCHANGE
payload.SEGMENT = symbolInfo.SEGMENT
payload.SEC_ID = symbolInfo.SEC_ID
payload.START = startTime.getTime() / 1000  // Unix timestamp in seconds
payload.END = endTime.getTime() / 1000
payload.INTERVAL = resolution  // "1", "5", "15", "D", etc.

// Required headers
const headers = {
    'Content-Type': 'application/json',
    'Auth': JWT_TOKEN,
    'Authorization': SIGNATURE,
    'Bid': 'DHN1804',
    'Cid': CLIENT_ID,
    'Src': 'T'  // 'T' for TradingView
};
```

---

## Response Processing

### Response Format

```json
{
  "success": true,
  "data": {
    "Time": ["2023-11-13", "2023-11-14", "2023-11-15"],
    "o": [100.5, 101.2, 102.0],
    "h": [102.0, 103.5, 104.0],
    "l": [99.5, 100.8, 101.5],
    "c": [101.0, 102.5, 103.0],
    "v": [1000000, 1200000, 1100000]
  },
  "nextTime": 1700000000
}
```

### Processing Logic

```javascript
// Parse response
response = JSON.parse(response)

if (response.success && response.data.c && response.data.c.length) {
    let bars = [];
    
    for (let i = 0; i < data.c.length; i++) {
        let bar = {
            close: parseFloat(data.c[i]),
            high: parseFloat(data.h[i]),
            low: parseFloat(data.l[i]),
            open: parseFloat(data.o[i]),
            time: new Date(new Date(data.Time[i]).toDateString()).getTime(),
            volume: Number(data.v[i])
        }
        bars.push(bar)
    }
    
    // Sort chronologically
    bars.sort((a, b) => a.time - b.time);
    
    return { bars, meta: { noData: false } }
}
```

---

## Caching Strategy

### Cache Structure

Dhan implements a **31-day sliding window cache**:

```javascript
// Daily cache object
Ye[symbol] = {
    time: currentTimestamp,
    dataArray: [],
    "2023-11-13": { open, high, low, close, volume, time, dateTime },
    "2023-11-14": { open, high, low, close, volume, time, dateTime },
    // ... up to 31 days
}

// Weekly cache object  
Qe[symbol] = {
    time: currentTimestamp,
    dataArray: [],
    "2023-11-W1": { aggregated weekly data },
    // ...
}
```

### Caching Logic

✅ **Stores last 31 days** of data  
✅ **Keys are date strings** ("YYYY-MM-DD")  
✅ **Updates existing bars** with new highs/lows/closes  
✅ **Separate caches** for daily and weekly aggregations  
✅ **Before API call**: Check cache for existing data  
✅ **After API call**: Update cache with new bars

---

## Implementation Guide

### Complete Data Flow

```
1. TradingView requests bars
   ↓
2. getBars(symbolInfo, resolution, {from, to})
   ↓
3. getChartsRange() ensures minimum 7 days requested
   ↓
4. Normalize timestamps to midnight
   ↓
5. Apply IST offset (+330 minutes)
   ↓
6. Build request payload:
   {
     EXCHANGE: "NSE",
     SEGMENT: "E",
     SEC_ID: "14366",
     START: timestamp,
     END: timestamp,
     INTERVAL: "D"
   }
   ↓
7. POST to https://ticks.dhan.co/getData
   Headers: { Auth: JWT_TOKEN }
  ↓
8. Server returns:
   {
     success: true,
     data: {
       Time: [...],
       o: [...],
       h: [...],
       l: [...],
       c: [...],
       v: [...]
     }
   }
   ↓
9. Process response:
   - Parse arrays
   - Create bar objects
   - Sort by time
   ↓
10. Cache bars (keyed by date)
    ↓
11. Return { bars: [...], meta: {...} }
    ↓
12. TradingView renders candles
```

### Recommended Implementation

```javascript
class ChartDataFetcher {
    constructor() {
        this.cache = {};  // Symbol-keyed cache
        this.IST_OFFSET = 330; // minutes
    }
    
    /**
     * Ensures minimum 7-day data window
     */
    ensureMinimumRange(from, to) {
        // Normalize to midnight
        const fromDate = new Date(new Date(from * 1000).toDateString());
        const toDate = new Date(new Date(to * 1000).toDateString());
        
        const currentDate = new Date(new Date().toDateString());
        
        // Calculate day differences
        const daysFrom = this.getDayDiff(currentDate, fromDate);
        const daysTo = this.getDayDiff(currentDate, toDate);
        
        // Ensure minimum 7-day window
        let adjustedFrom = Math.floor(fromDate.getTime() / 1000);
        let adjustedTo = Math.floor(toDate.getTime() / 1000);
        
        if (daysTo === 0) {
            adjustedTo += 86400; // Add 1 day for today
        }
        
        if (daysFrom - daysTo < 7) {
            adjustedFrom -= 604800; // Subtract 7 days
        }
        
        return { from: adjustedFrom, to: adjustedTo };
    }
    
    /**
     * Calculate day difference
     */
    getDayDiff(dateA, dateB) {
        const diff = dateA.getTime() - dateB.getTime();
        return Math.floor(diff / 86400000); // 86400000ms = 1 day
    }
    
    /**
     * Fetch bars with caching
     */
    async getBars(symbol, exchange, segment, secId, from, to, interval) {
        // 1. Adjust time range (minimum 7 days)
        const adjusted = this.ensureMinimumRange(from, to);
        
        // 2. Check cache
        const cacheKey = `${symbol}_${interval}_${adjusted.from}_${adjusted.to}`;
        const cached = this.cache[cacheKey];
        if (cached) {
            console.log('Returning cached data');
            return cached;
        }
        
        // 3. Apply IST offset for request
        const startTime = new Date((adjusted.from + this.IST_OFFSET * 60) * 1000);
        startTime.setHours(0, 0, 1, 0);
        
        const endTime = new Date((adjusted.to + this.IST_OFFSET * 60) * 1000);
        endTime.setHours(23, 59, 59, 999);
        
        // 4. Build request
        const payload = {
            EXCHANGE: exchange,
            SEGMENT: segment,
            SEC_ID: secId,
            START: Math.floor(startTime.getTime() / 1000),
            END: Math.floor(endTime.getTime() / 1000),
            INTERVAL: interval,
            START_TIME: startTime.toString(),
            END_TIME: endTime.toString()
        };
        
        // 5. Fetch from API
        const response = await fetch('http://localhost:3001/api/getData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        // 6. Process response
        const data = await response.json();
        const bars = this.processBars(data);
        
        // 7. Cache result
        this.cache[cacheKey] = bars;
        
        return bars;
    }
    
    /**
     * Process API response into chart bars
     */
    processBars(response) {
        if (!response.success || !response.data.c || !response.data.c.length) {
            return { bars: [], meta: { noData: true } };
        }
        
        const data = response.data;
        const bars = [];
        
        for (let i = 0; i < data.c.length; i++) {
            // Normalize time to midnight
            const time = new Date(new Date(data.Time[i]).toDateString());
            
            bars.push({
                time: Math.floor(time.getTime() / 1000),
                open: parseFloat(data.o[i]),
                high: parseFloat(data.h[i]),
                low: parseFloat(data.l[i]),
                close: parseFloat(data.c[i]),
                volume: parseInt(data.v[i])
            });
        }
        
        // Sort chronologically
        bars.sort((a, b) => a.time - b.time);
        
        return {
            bars,
            meta: { noData: false }
        };
    }
}
```

---

## Best Practices

### 1. Always Ensure Minimum Data Window

```javascript
// Don't fetch small chunks - always 7+ days
if (daysFromNow - daysToNow < 7) {
    daysFromNow += 7
    periodParams.from -= 604800
}
```

### 2. Normalize Timestamps

```javascript
// Remove time component for consistency
const normalizeToMidnight = (timestamp) => {
    return new Date(new Date(timestamp * 1000).toDateString());
};
```

### 3. Handle IST Offset Correctly

```javascript
// Add IST offset before setting specific time
const applyISTOffset = (unixSeconds) => {
    return new Date((unixSeconds + 330 * 60) * 1000);
};
```

### 4. Implement Caching

```javascript
// Cache by symbol, interval, and date range
const cacheKey = `${symbol}_${interval}_${from}_${to}`;
if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
}
```

### 5. Sort Bars After Processing

```javascript
// Always sort chronologically before returning
bars.sort((a, b) => a.time - b.time);
```

---

## Summary

### Key Takeaways

1. **Minimum 7-Day Window**: Always fetch at least 7 days to reduce API calls
2. **Midnight Normalization**: Remove time component from all timestamps
3. **IST Offset Management**: Add +330 minutes (5.5 hours) for IST timezone
4. **Smart Caching**: Store up to 31 days with date-keyed lookup
5. **No Event Subscription**: Pre-calculate ranges instead of reacting to pan events

### The Real Flow

```
TradingView requests bars
  ↓
Calculate minimum 7-day range
  ↓
Normalize to midnight
  ↓
Apply IST offset
  ↓
Check cache
  ↓
POST to /getData (if not cached)
  ↓
Process arrays into bar objects
  ↓
Sort chronologically
  ↓
Update cache
  ↓
Return to TradingView
```

### What's Different from Assumptions

❌ **NOT USED**: `subscribeVisibleLogicalRangeChange()` for detecting pans  
❌ **NOT USED**: `update()` method for historical data  
❌ **NOT USED**: Separate "pan left" detection logic  

✅ **ACTUALLY USED**: Pre-calculated minimum 7-day windows  
✅ **ACTUALLY USED**: Midnight-normalized timestamps  
✅ **ACTUALLY USED**: 31-day cache with date keys  
✅ **ACTUALLY USED**: IST offset management throughout  

---

**Document Version**: 2.0 (Reverse-Engineered)  
**Created**: 2025-11-24  
**Based On**: `bundle2.1.37.js` Class `Dn` analysis  
**Status**: Production Implementation Reference  

**Related Files**:
- `GETBARS_IMPLEMENTATION_ANALYSIS.md` – Source analysis
- `TIMEZONE_FIX_SUMMARY.md` – Timezone handling details
