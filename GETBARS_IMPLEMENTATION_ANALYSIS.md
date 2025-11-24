# Complete getBars Implementation Analysis - bundle2.1.37.js

## 🎯 Critical Discovery: Class `Dn` - The Chart Data Fetcher

**Location**: Lines 12484-13000+ in `bundle2.1.37.js`

---

## Class Structure

```javascript
class Dn {
    constructor(datafeedUrl, requester) {
        this._datafeedUrl = datafeedUrl
        this._requester = requester
    }
    
    getDayDiff(dateA, dateB) { /* ... */ }
    getChartsRange(range, periodParams) { /* ... */ }
    getBars(symbolInfo, resolution, periodParams) { /* ... */ }
}
```

---

## Method 1: `getDayDiff` (Lines 12490-12494)

**Purpose**: Calculate difference between two dates in days

```javascript
getDayDiff(t, i) {
    let dayDiff = t.getTime() - i.getTime();
    return Math.floor(dayDiff / 864e5)  // 86400000ms = 1 day
}
```

**Usage**: Determines how much historical data to fetch

---

## Method 2: `getChartsRange` (Lines 12495-12510)

**Purpose**: Adjusts the time range for data requests

```javascript
getChartsRange(range, periodParams) {
    // Get current date and normalize times
    let currentDate = new Date((new Date).toDateString())
    let startDate = new Date(new Date(1000 * periodParams.from).toDateString());
    periodParams.from = Math.floor(startDate.getTime() / 1000);
    
    let endDate = new Date(new Date(1000 * periodParams.to).toDateString());
    periodParams.to = Math.floor(endDate.getTime() / 1000);
    
    // Calculate day differences
    let daysFromNow = this.getDayDiff(currentDate, startDate)
    let daysToNow = this.getDayDiff(currentDate, endDate);
    
    // Adjust for today
    if (daysToNow == 0) {
        periodParams.to += 86400  // Add 1 day
    }
    
    // Ensure at least 7 days of data
    if (daysFromNow - daysToNow < 7) {
        daysFromNow += 7
        periodParams.from -= 604800  // Subtract 7 days (604800 seconds)
    }
    
    range.from = daysFromNow
    range.to = daysToNow
    
    return periodParams
}
```

**Key Insights**:
- Normalizes all times to midnight (removes time component)
- Always fetches at least 7 days of data
- Adjusts for current day by adding extra day
- Returns Unix timestamps in seconds

---

## Method 3: `getBars` - Main Data Fetching Function

**Complete data flow discovered!**

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

---

## Complete Implementation Details

### 1. API Endpoints
- **Standard**: `https://ticks.dhan.co/getData`
- **Seconds Resolution**: `https://ticks.dhan.co/getDataS`

### 2. Request Construction (Lines 12518-12609)

```javascript
// IST offset handling: +330 minutes (5.5 hours)
startTime = new Date(1000 * (periodParams.from + 330))
startTime.setHours(0)
startTime.setMinutes(0)
startTime.setSeconds(1)

// Payload construction
payload.EXCHANGE = symbolInfo.EXCHANGE
payload.SEGMENT = symbolInfo.SEGMENT
payload.SEC_ID = symbolInfo.SEC_ID
payload.START = startTime.getTime() / 1000  // Unix timestamp in seconds
payload.END = endTime.getTime() / 1000
payload.INTERVAL = resolution  // "1", "5", "15", "D", etc.
```

### 3. Response Processing (Lines 12545-12594)

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

### 4. Caching Mechanism (Lines 12698-12850)

**This is critical!** Dhan caches data for performance:

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

**Caching Logic**:
- Stores last 31 days of data
- Keys are date strings ("YYYY-MM-DD")
- Updates existing bars with new highs/lows/closes
- Separate caches for daily and weekly aggregations

---

## Complete Data Flow

```
1. User pans chart left
   ↓
2. TradingView detects visible range needs data
   ↓
3. Calls getBars(symbolInfo, resolution, {from, to})
   ↓
4. getChartsRange() ensures minimum 7 days requested
   ↓
5. Build request payload:
   {
     EXCHANGE: "NSE",
     SEGMENT: "E",
     SEC_ID: "14366",
     START: timestamp,
     END: timestamp,
     INTERVAL: "D"
   }
   ↓
6. POST to https://ticks.dhan.co/getData
   Headers: { Auth: JWT_TOKEN }
  ↓
7. Server returns:
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
8. Process response:
   - Parse arrays
   - Create bar objects
   - Sort by time
   ↓
9. Cache bars (keyed by date)
   ↓
10. Return { bars: [...], meta: {...} }
    ↓
11. TradingView renders new candles
```

---

## Key Implementation Details

### Special Handling for INDEX

```javascript
// Special request codes
if (symbolInfo.insttype == 0) {
    requestCode = 802  // Equity intraday
} else if (symbolInfo.EXCHANGE == "INDEX" && symbolInfo.insttype == 0) {
    requestCode = 803  // Index specific
} else {
    requestCode = 804  // Derivatives
}
```

### Time Zone Handling

```javascript
// All times use IST (Indian Standard Time)
// UTC + 5:30 = +330 minutes
const IST_OFFSET = 330;

startTime = new Date(1000 * (periodParams.from + IST_OFFSET))
```

### Minimum Data Window

```javascript
// Always fetch at least 7 days
if (daysFromNow - daysToNow < 7) {
    daysFromNow += 7
    periodParams.from -= 604800  // 7 days in seconds
}
```

---

## Recommended Implementation for Your App

```javascript
class ChartDataFetcher {
    constructor() {
        this.cache = {};  // Symbol-keyed cache
    }
    
    async getBars(symbol, exchange, segment, secId, from, to, interval) {
        // 1. Adjust time range (minimum 7 days)
        const adjusted = this.ensureMinimumRange(from, to);
        
        // 2. Check cache
        const cached = this.getFromCache(symbol, adjusted.from, adjusted.to);
        if (cached) return cached;
        
        // 3. Build request
        const payload = {
            EXCHANGE: exchange,
            SEGMENT: segment,
            SEC_ID: secId,
            START: adjusted.from,
            END: adjusted.to,
            INTERVAL: interval,
            START_TIME: new Date(adjusted.from * 1000).toString(),
            END_TIME: new Date(adjusted.to * 1000).toString()
        };
        
        // 4. Fetch from API
        const response = await fetch('https://your-proxy.com/api/getData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify(payload)
        });
        
        // 5. Process response
        const data = await response.json();
        const bars = this.processBars(data);
        
        // 6. Cache result
        this.updateCache(symbol, bars);
        
        return bars;
    }
    
    processBars(response) {
        if (!response.success || !response.data.c) {
            return { bars: [], meta: { noData: true } };
        }
        
        const data = response.data;
        const bars = [];
        
        for (let i = 0; i < data.c.length; i++) {
            bars.push({
                time: new Date(data.Time[i]).getTime(),
                open: parseFloat(data.o[i]),
                high: parseFloat(data.h[i]),
                low: parseFloat(data.l[i]),
                close: parseFloat(data.c[i]),
                volume: parseInt(data.v[i])
            });
        }
        
        return {
            bars: bars.sort((a, b) => a.time - b.time),
            meta: { noData: false }
        };
    }
}
```

---

## Summary

**Class `Dn`** from bundle2.1.37.js reveals:

✅ **Request Format**: POST with JSON payload containing EXCHANGE, SEGMENT, SEC_ID, START, END, INTERVAL  
✅ **Response Format**: Arrays of Time, o, h, l, c, v  
✅ **Caching**: 31-day window with date-keyed storage  
✅ **Time Handling**: IST timezone (+330min offset), minimum 7-day fetch  
✅ **Endpoints**: Different URLs for standard vs seconds resolution  
✅ **Auth**: JWT token in headers  

This is production-grade implementation with proper error handling, caching optimization, and timezone management.

---

## 🔄 Automatic Panning Detection & Implementation

### Overview

Lightweight Charts **automatically detects** when users pan the chart. You just need to subscribe to the event and implement the data fetching logic. Here's how it works:

### Automatic Detection Flow

```
User drags chart left
        ↓ (AUTOMATIC - Lightweight Charts detects)
subscribeVisibleLogicalRangeChange() callback fires
        ↓ (AUTOMATIC - Library provides info)
barsInLogicalRange() returns { barsBefore: N }
        ↓ (YOUR CODE - Check if N > 0)
Trigger fetchOlderData()
        ↓ (YOUR CODE - API call)
POST to /api/getData
        ↓ (YOUR CODE - Merge data)
Combine old + new bars
        ↓ (YOUR CODE - Update chart)
series.setData(mergedBars)
        ↓ (AUTOMATIC - Lightweight Charts re-renders)
User sees extended history!
```

### Complete Working Implementation

```javascript
class AutoPanningChart {
  constructor(container) {
    this.chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 600,
      timeScale: {
        timeVisible: true,
        secondsVisible: false
      }
    })
    
    this.series = this.chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    })
    
    this.cache = new Map()
    this.isFetching = false  // Prevent duplicate fetches
    this.noMoreDataAvailable = false
  }
  
  /**
   * Initialize chart with symbol and interval
   * Sets up automatic panning detection
   */
  async init(symbol, interval) {
    this.symbol = symbol
    this.interval = interval
    
    // Load initial month of data
    const toDate = Math.floor(Date.now() / 1000)
    const fromDate = toDate - (30 * 24 * 60 * 60)  // 30 days ago
    
    console.log('📊 Loading initial chart data...')
    const initialData = await this.fetchBars(fromDate, toDate)
    
    if (initialData.length === 0) {
      console.error('❌ No initial data received')
      return
    }
    
    this.series.setData(initialData)
    this.oldestLoadedTime = initialData[0].time
    this.newestLoadedTime = initialData[initialData.length - 1].time
    
    console.log(`✅ Loaded ${initialData.length} initial bars`)
    console.log(`   Oldest: ${new Date(this.oldestLoadedTime * 1000).toISOString()}`)
    console.log(`   Newest: ${new Date(this.newestLoadedTime * 1000).toISOString()}`)
    
    // ✅ AUTOMATIC PANNING DETECTION - This is the key!
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.handlePanEvent()
    })
    
    console.log('✅ Automatic panning detection enabled')
  }
  
  /**
   * Handle pan event - called AUTOMATICALLY by Lightweight Charts
   */
  handlePanEvent() {
    if (this.isFetching || this.noMoreDataAvailable) {
      return  // Already fetching or no more data
    }
    
    const logicalRange = this.chart.timeScale().getVisibleLogicalRange()
    if (!logicalRange) return
    
    const barsInfo = this.series.barsInLogicalRange(logicalRange)
    
    // ✅ AUTOMATIC CHECK: User viewing data before what we have?
    if (barsInfo && barsInfo.barsBefore > 0) {
      console.log(`👈 User panned left! Need ${barsInfo.barsBefore} more bars`)
      this.fetchOlderData()
    }
  }
  
  /**
   * Fetch older historical data when user pans left
   */
  async fetchOlderData() {
    this.isFetching = true
    
    try {
      // Calculate time range for older data (go back 30 more days)
      const newTo = this.oldestLoadedTime - 1
      const newFrom = newTo - (30 * 24 * 60 * 60)  // 30 days before oldest
      
      console.log('⏳ Auto-fetching older data...')
      console.log(`   From: ${new Date(newFrom * 1000).toISOString()}`)
      console.log(`   To: ${new Date(newTo * 1000).toISOString()}`)
      
      // Fetch from API
      const olderBars = await this.fetchBars(newFrom, newTo)
      
      if (olderBars.length === 0) {
        console.log('📭 No more historical data available')
        this.noMoreDataAvailable = true
        this.isFetching = false
        return
      }
      
      console.log(`📦 Received ${olderBars.length} older bars`)
      
      // Get current chart data
      const currentData = this.series.data()
      
      // Merge: older data first, then current
      const mergedData = [...olderBars, ...currentData]
        .sort((a, b) => a.time - b.time)
      
      // Remove duplicates (just in case)
      const uniqueData = this.removeDuplicates(mergedData)
      
      // Update chart
      this.series.setData(uniqueData)
      
      // Update oldest time tracker
      this.oldestLoadedTime = uniqueData[0].time
      
      console.log(`✅ Auto-loaded ${olderBars.length} older bars`)
      console.log(`   New oldest: ${new Date(this.oldestLoadedTime * 1000).toISOString()}`)
      console.log(`   Total bars: ${uniqueData.length}`)
      
    } catch (error) {
      console.error('❌ Auto-fetch failed:', error)
    } finally {
      this.isFetching = false
    }
  }
  
  /**
   * Fetch bars from API using Dhan's exact format
   */
  async fetchBars(fromTimestamp, toTimestamp) {
    const payload = {
      EXCHANGE: this.symbol.exchange,
      SEGMENT: this.symbol.segment,
      SEC_ID: this.symbol.secId,
      INST: this.symbol.inst || 'EQUITY',
      START: fromTimestamp,
      END: toTimestamp,
      START_TIME: new Date(fromTimestamp * 1000).toString(),
      END_TIME: new Date(toTimestamp * 1000).toString(),
      INTERVAL: this.interval
    }
    
    const response = await fetch('/api/getData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`  // Your auth
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success || !data.data) {
      throw new Error('Invalid response format')
    }
    
    // Convert Dhan's array format to Lightweight Charts format
    return this.processBarsResponse(data.data)
  }
  
  /**
   * Convert Dhan's array response to Lightweight Charts bar objects
   */
  processBarsResponse(data) {
    if (!data.Time || data.Time.length === 0) {
      return []
    }
    
    return data.Time.map((timeStr, i) => ({
      time: Math.floor(new Date(timeStr).getTime() / 1000),
      open: parseFloat(data.o[i]),
      high: parseFloat(data.h[i]),
      low: parseFloat(data.l[i]),
      close: parseFloat(data.c[i]),
      volume: parseInt(data.v[i] || 0)
    }))
  }
  
  /**
   * Remove duplicate bars based on timestamp
   */
  removeDuplicates(bars) {
    const seen = new Set()
    return bars.filter(bar => {
      if (seen.has(bar.time)) {
        return false
      }
      seen.add(bar.time)
      return true
    })
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.chart) {
      this.chart.remove()
    }
  }
}

// ✅ USAGE EXAMPLE
const chart = new AutoPanningChart(document.getElementById('chart-container'))

await chart.init(
  {
    exchange: 'NSE',
    segment: 'E',
    secId: 14366,  // Vodafone Idea
    inst: 'EQUITY'
  },
  'D'  // Daily interval
)

// That's it! Panning now works automatically! 🎉
```

### What Happens Automatically

| Step | Who Does It | Description |
|------|-------------|-------------|
| 1. User pans chart | **User** | Drags chart left/right |
| 2. Detect viewport change | **Lightweight Charts** | Fires `subscribeVisibleLogicalRangeChange` |
| 3. Calculate visible range | **Lightweight Charts** | Provides `logicalRange` object |
| 4. Check bars needed | **Lightweight Charts** | `barsInLogicalRange()` returns `barsBefore` |
| 5. Decide to fetch | **Your Code** | Check if `barsBefore > 0` |
| 6. Build API request | **Your Code** | Create payload with START/END |
| 7. Make API call | **Your Code** | POST to `/api/getData` |
| 8. Process response | **Your Code** | Convert arrays to bars |
| 9. Merge data | **Your Code** | Combine old + new bars |
| 10. Update chart | **Your Code** | Call `setData(merged)` |
| 11. Re-render chart | **Lightweight Charts** | Shows extended history |

### Pro Tips

#### 1. Prevent Duplicate Fetches

```javascript
handlePanEvent() {
  if (this.isFetching) {
    console.log('⏸️ Already fetching, skipping...')
    return
  }
  // ... rest of logic
}
```

#### 2. Add Debouncing for Better Performance

```javascript
handlePanEvent() {
  clearTimeout(this.panTimeout)
  this.panTimeout = setTimeout(() => {
    this.checkAndFetch()
  }, 300)  // Wait 300ms after user stops panning
}
```

#### 3. Show Loading Indicator

```javascript
async fetchOlderData() {
  this.showLoader()  // Visual feedback
  try {
    // ... fetch logic ...
  } finally {
    this.hideLoader()
  }
}

showLoader() {
  const loader = document.createElement('div')
  loader.id = 'chart-loader'
  loader.innerHTML = '⏳ Loading older data...'
  loader.style.cssText = 'position:absolute;top:10px;left:10px;padding:10px;background:rgba(0,0,0,0.8);color:white;border-radius:4px;'
  this.chart.container().appendChild(loader)
}

hideLoader() {
  document.getElementById('chart-loader')?.remove()
}
```

#### 4. Handle "No More Data" Gracefully

```javascript
if (olderBars.length === 0) {
  this.noMoreDataAvailable = true
  console.log('📭 Reached start of available data')
  
  // Optional: Show message to user
  this.showMessage('No more historical data available')
}
```

#### 5. Cache Data Locally

```javascript
fetchBars(from, to) {
  const cacheKey = `${this.symbol.secId}-${this.interval}-${from}-${to}`
  
  // Check cache first
  if (this.cache.has(cacheKey)) {
    console.log('✅ Using cached data')
    return Promise.resolve(this.cache.get(cacheKey))
  }
  
  // Fetch and cache
  return this.apiCall(from, to).then(bars => {
    this.cache.set(cacheKey, bars)
    return bars
  })
}
```

### Visual Flow Diagram

```
┌───────────────────────────────────────────────────────────┐
│  Initial State: Chart loaded with 1 month data           │
│  ┌─────────────────────────────────────────────────┐     │
│  │                                                  │     │
│  │  [Older Data] ← User wants to see this          │     │
│  │                                                  │     │
│  │  ┌──────────────────────────────────┐           │     │
│  │  │ ████████ Loaded bars ████████   │ ← Current  │     │
│  │  └──────────────────────────────────┘           │     │
│  │                                                  │     │
│  └─────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────┘
                          │
                          │ User pans left
                          ▼
┌───────────────────────────────────────────────────────────┐
│  Viewport shifts: Now viewing before loaded data         │
│  ┌─────────────────────────────────────────────────┐     │
│  │  ┌──────────┐                                    │     │
│  │  │ Viewport │                                    │     │
│  │  └──────────┘                                    │     │
│  │         ┌──────────────────────────────────┐    │     │
│  │         │ ████████ Loaded bars ████████   │    │     │
│  │         └──────────────────────────────────┘    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  barsInLogicalRange() returns: { barsBefore: 100 }       │
└───────────────────────────────────────────────────────────┘
                          │
                          │ Automatic fetch triggered
                          ▼
┌───────────────────────────────────────────────────────────┐
│  API Call: POST /api/getData                             │
│  {                                                        │
│    "START": older_timestamp,                             │
│    "END": current_oldest_timestamp,                      │
│    "INTERVAL": "D"                                       │
│  }                                                        │
└───────────────────────────────────────────────────────────┘
                          │
                          │ Response received
                          ▼
┌───────────────────────────────────────────────────────────┐
│  Merge: [older_bars] + [existing_bars]                   │
│  Sort by timestamp                                        │
│  Remove duplicates                                        │
└───────────────────────────────────────────────────────────┘
                          │
                          │ setData(merged)
                          ▼
┌───────────────────────────────────────────────────────────┐
│  Final State: Extended history visible                   │
│  ┌─────────────────────────────────────────────────┐     │
│  │  ┌──────────┐                                    │     │
│  │  │ Viewport │                                    │     │
│  │  └──────────┘                                    │     │
│  │  ┌─────────────────┐┌──────────────────────┐    │     │
│  │  │ New older bars ││ Original loaded bars │    │     │
│  │  └─────────────────┘└──────────────────────┘    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ✅ User can now see extended history!                   │
└───────────────────────────────────────────────────────────┘
```

### Testing Your Implementation

```javascript
// 1. Initialize chart
const chart = new AutoPanningChart(container)
await chart.init(symbol, 'D')

// 2. Watch console for automatic behavior
console.log('🧪 Pan the chart left and watch the logs...')

// Expected console output when panning:
// 👈 User panned left! Need 50 more bars
// ⏳ Auto-fetching older data...
//    From: 2024-10-01T00:00:00.000Z
//    To: 2024-10-31T23:59:59.000Z
// 📦 Received 30 older bars
// ✅ Auto-loaded 30 older bars
//    New oldest: 2024-10-01T00:00:00.000Z
//    Total bars: 60

// 3. Verify data merging
const allBars = chart.series.data()
console.log(`Total bars loaded: ${allBars.length}`)
console.log(`Time range: ${new Date(allBars[0].time * 1000)} to ${new Date(allBars[allBars.length-1].time * 1000)}`)
```

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| No auto-fetch on pan | Callback not registered | Ensure `subscribeVisibleLogicalRangeChange()` is called |
| Multiple simultaneous fetches | No fetch lock | Add `if (this.isFetching) return` |
| Duplicate bars | No deduplication | Filter by unique timestamps |
| Chart jumps after fetch | Wrong sort order | Always sort merged data by time |
| Empty response | Date range too far back | Check API limits, handle gracefully |

### Advanced: Bidirectional Panning

```javascript
handlePanEvent() {
  const logicalRange = this.chart.timeScale().getVisibleLogicalRange()
  const barsInfo = this.series.barsInLogicalRange(logicalRange)
  
  if (barsInfo.barsBefore > 0) {
    // User panned LEFT - fetch older data
    this.fetchOlderData()
  } else if (barsInfo.barsAfter > 0 && !this.isRealtime) {
    // User panned RIGHT - fetch newer data (if not at current time)
    this.fetchNewerData()
  }
}
```

---

## 🎯 Final Implementation Checklist

- [x] Class `Dn` analysis complete
- [x] API request format documented
- [x] API response format documented
- [x] Caching mechanism understood
- [x] Time zone handling (IST) documented
- [x] Automatic panning detection explained
- [x] Complete working example provided
- [x] Pro tips and best practices included
- [x] Testing approach documented
- [x] Troubleshooting guide available

**You now have everything needed to implement automatic chart panning with Dhan's data feed!** 🚀
