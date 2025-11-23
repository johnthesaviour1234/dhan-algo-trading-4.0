# TradingView Chart Panning & Data Fetching Mechanism

## Table of Contents
1. [Overview](#overview)
2. [Two-Stage Data Loading Pattern](#two-stage-data-loading-pattern)
3. [Initial Chart Load](#initial-chart-load)
4. [Real-Time WebSocket Updates](#real-time-websocket-updates)
5. [Panning Left - The Mechanism](#panning-left---the-mechanism)
6. [Implementation Details](#implementation-details)
7. [Code Examples](#code-examples)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

TradingView charts in the Dhan platform use a **hybrid dual-channel architecture** to display trading data:

1. **Historical Data Channel** – HTTP REST API (`/getData`) for fetching chunks of past OHLC data on-demand
2. **Real-Time Channel** – WebSocket binary protocol for streaming live price ticks

This approach allows charts to:
- Load initial history efficiently without excessive data transfer
- Extend history backwards as users pan left
- Update the latest bar(s) in real-time without additional API calls
- Maintain smooth, responsive user experience

### Key Principle
**Progressive data loading**: Only fetch the data the user is viewing or about to view, not all available history at once.

---

## Two-Stage Data Loading Pattern

### Stage 1: Initial Load (Bulk Historical Data)
When a chart first opens:
- Fetch 1 month (or configurable range) of historical bars via `/getData` API
- Use `setData()` method to bulk-load into the chart
- Display immediately

### Stage 2: Real-Time Updates (Continuous Stream)
After initial load:
- Open WebSocket connection for live ticks
- Receive binary messages with price updates (Type 1, Type 3, etc.)
- Use `update()` method to refresh the latest bar(s)
- No additional `/getData` calls needed for current bar

### Stage 3: Pan Left (Extended History On-Demand)
When user drags chart left:
- Detect that visible range extends before loaded data
- Fetch earlier historical data via `/getData`
- Merge with existing data
- Re-render chart with extended history

---

## Initial Chart Load

### API Call Structure

**Endpoint**: `POST https://ticks.dhan.co/getData`

**Request Payload**:
```json
{
  "EXCH": "NSE",
  "SEG": "E",
  "INST": "EQUITY",
  "SEC_ID": 14366,
  "interval": "1",
  "fromDate": "2024-11-01",
  "toDate": "2024-12-01"
}
```

**Response Format**:
```json
{
  "status": "success",
  "data": [
    {
      "time": 1640000000,
      "open": 14.00,
      "high": 14.50,
      "low": 13.80,
      "close": 14.25,
      "volume": 1234567
    },
    ...
  ]
}
```

### Implementation (Lightweight Charts Example)

```javascript
class DhanChartManager {
  async loadHistoricalData() {
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 1); // Last 1 month

      const historicalData = await this.dataFetcher.getHistoricalData(
        this.currentInstrument,
        this.currentInterval,
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0]
      );

      // BULK LOAD - setData() is used for complete historical dataset
      this.candlestickSeries.setData(historicalData);
      
      console.log(`Loaded ${historicalData.length} historical bars`);
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }
}
```

### Key Method: `setData()`
- Replaces entire chart dataset
- Used for initial load and complete refreshes
- More efficient than calling `update()` multiple times
- Triggers complete chart re-render

---

## Real-Time WebSocket Updates

### WebSocket Connection Setup

**Endpoint**: `wss://price-feed-tv.dhan.co/` (TradingView) or `wss://price-feed-web.dhan.co/` (Web App)

**Protocol**: Binary proprietary protocol (703-byte handshake + 129-byte subscriptions)

### Message Types Received

| Type | Name | Use Case | Frequency |
|------|------|----------|-----------|
| 1 | LTP/Tick | Live price update | Every trade |
| 3 | OHLC | Complete bar update | End of candle |
| 6 | Top Bid | Best bid/ask | Tick |
| 14 | Heartbeat | Keep-alive | Every few seconds |
| 32 | Previous Close | Reference price | One-time |
| 33 | Circuit Limit | Price boundaries | One-time |
| 36 | 52-Week High/Low | Range reference | One-time |

### Real-Time Update Implementation

```javascript
subscribeToRealtime() {
  this.wsClient.subscribe(this.currentInstrument, (tick) => {
    if (tick.type === 'tick') {
      // LTP update - use update() for incremental bar modification
      const chartBar = {
        time: Math.floor(tick.time.getTime() / 1000),
        open: tick.ltp,
        high: tick.ltp,
        low: tick.ltp,
        close: tick.ltp,
      };
      
      // INCREMENTAL UPDATE - update() modifies the latest bar only
      this.candlestickSeries.update(chartBar);
      
    } else if (tick.type === 'ohlc') {
      // OHLC update - full bar data
      const chartBar = {
        time: Math.floor(Date.now() / 1000),
        open: tick.open,
        high: tick.high,
        low: tick.low,
        close: tick.close,
      };
      
      this.candlestickSeries.update(chartBar);
    }
  });
}
```

### Key Method: `update()`
- Modifies or adds a single bar
- Used for real-time tick/OHLC updates
- Much lighter weight than re-rendering entire dataset
- Automatically extends chart if time is beyond current range

---

## Panning Left - The Mechanism

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────┐
│ User Pans/Drags Chart Towards Left                      │
│ (Attempting to view older/historical data)              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Lightweight Charts Library Detects                       │
│ - Viewport has shifted left                             │
│ - Visible time range extends BEFORE loaded data start   │
│ - Triggers logicalRange / visibleRange change event     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend Event Handler Fires                            │
│ - Calculate: new_fromDate = min_visible_time - buffer   │
│ - Compare: new_fromDate < current_fromDate ?            │
│ - Decision: Need to fetch older data?                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼ (Yes, need older data)
┌─────────────────────────────────────────────────────────┐
│ Trigger /getData API Call with Earlier Date Range       │
│ POST https://ticks.dhan.co/getData                      │
│ {                                                        │
│   "EXCH": "NSE",                                        │
│   "SEC_ID": 14366,                                      │
│   "fromDate": "2024-10-01",   ◄── Earlier than before   │
│   "toDate": "2024-11-01",     ◄── Previous fromDate     │
│   "interval": "1"                                        │
│ }                                                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Server Returns Older OHLC Bars                          │
│ Array of { time, open, high, low, close, volume }       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend Merges Data                                     │
│ combinedData = [...olderData, ...currentData]           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Update Chart with setData()                             │
│ this.candlestickSeries.setData(combinedData)            │
│ - Chart re-renders with extended history                │
│ - User sees older bars on the left side                 │
└─────────────────────────────────────────────────────────┘
```

### Implementation

```javascript
// Hook into chart's visible range change event
chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
  if (!logicalRange) return;

  const visibleBars = series.barsInLogicalRange(logicalRange);
  
  // Check if we're viewing data before what we've loaded
  if (visibleBars && visibleBars.first < this.loadedDataStartTime) {
    this.fetchEarlierData();
  }
});

async fetchEarlierData() {
  // Calculate date range for older data
  const currentFromDate = this.dataStartDate;
  const newFromDate = new Date(currentFromDate);
  newFromDate.setMonth(newFromDate.getMonth() - 1); // Go back 1 more month

  try {
    const olderData = await this.dataFetcher.getHistoricalData(
      this.currentInstrument,
      this.currentInterval,
      newFromDate.toISOString().split('T')[0],
      currentFromDate.toISOString().split('T')[0]
    );

    // Merge old and new data
    const combinedData = [...olderData, ...this.currentData];
    
    // Update chart with complete merged dataset
    this.candlestickSeries.setData(combinedData);
    
    // Update tracking variables
    this.currentData = combinedData;
    this.dataStartDate = newFromDate;
    this.loadedDataStartTime = olderData[0].time;
    
    console.log(`Extended history by ${olderData.length} bars`);
  } catch (error) {
    console.error('Failed to fetch earlier data:', error);
  }
}
```

---

## Implementation Details

### Method Selection Logic

```
┌─────────────────────────────────────────────┐
│ Need to Update Chart?                       │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────── Full Dataset? ──────────────┐  │
│ │                                        │  │
│ │ Use: setData(bars)                     │  │
│ │                                        │  │
│ │ When:                                  │  │
│ │ • Initial load                         │  │
│ │ • Symbol change                        │  │
│ │ • Interval change                      │  │
│ │ • Panning left (extended history)      │  │
│ │ • Any complete refresh                 │  │
│ │                                        │  │
│ └────────────────────────────────────────┘  │
│                  OR                         │
│ ┌─────────── Single Tick? ───────────────┐  │
│ │                                        │  │
│ │ Use: update(bar)                       │  │
│ │                                        │  │
│ │ When:                                  │  │
│ │ • WebSocket LTP tick received          │  │
│ │ • WebSocket OHLC update received       │  │
│ │ • Real-time price update               │  │
│ │ • Incremental bar modification         │  │
│ │                                        │  │
│ └────────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### Performance Considerations

**Why `setData()` for panned data?**
- Merging datasets requires rebuilding the complete history
- More efficient to reload entire dataset than update individual bars
- Library optimizes re-rendering for full dataset loads
- Prevents sync issues between old and new data

**Why `update()` for real-time?**
- Only the latest bar(s) change with each tick
- Much lower overhead than re-rendering entire chart
- Maintains smooth 60 FPS experience
- Minimal network bandwidth

### Data Continuity

When merging historical data during pan operations:

```javascript
// Ensure no gaps and proper ordering
const mergeHistoricalData = (olderData, currentData) => {
  // Remove any overlap
  const lastOldTime = olderData[olderData.length - 1]?.time;
  const filteredCurrent = currentData.filter(bar => bar.time > lastOldTime);
  
  // Combine: older data first, then newer
  return [...olderData, ...filteredCurrent];
};
```

---

## Code Examples

### Complete Chart Manager with Pan Support

```javascript
class DhanChartManagerWithPanSupport {
  constructor(containerId, clientId, token, tabId) {
    this.container = document.getElementById(containerId);
    this.chart = null;
    this.candlestickSeries = null;
    
    this.dataFetcher = new DhanDataFetcher(token, clientId);
    this.wsClient = new DhanWebSocketClient(clientId, token, tabId);
    
    this.currentInstrument = null;
    this.currentInterval = '1';
    this.currentData = [];
    this.dataStartDate = null;
  }

  async initialize(instrument, interval = '1') {
    this.currentInstrument = instrument;
    this.currentInterval = interval;

    // Create chart
    this.chart = createChart(this.container, {
      width: this.container.clientWidth,
      height: 600,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    this.candlestickSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
    });

    // Load historical data
    await this.loadHistoricalData();

    // Connect WebSocket for real-time
    await this.wsClient.connect();
    this.subscribeToRealtime();

    // Hook pan event for fetching older data
    this.hookPanEvent();
  }

  async loadHistoricalData() {
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 1);

      const historicalData = await this.dataFetcher.getHistoricalData(
        this.currentInstrument,
        this.currentInterval,
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0]
      );

      this.candlestickSeries.setData(historicalData);
      this.currentData = historicalData;
      this.dataStartDate = fromDate;

      console.log(`Loaded ${historicalData.length} bars`);
    } catch (error) {
      console.error('Historical data load failed:', error);
    }
  }

  hookPanEvent() {
    // Subscribe to visible logical range changes
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      if (!logicalRange) return;

      // Check if user is viewing data before our loaded range
      const barsInfo = this.candlestickSeries.barsInLogicalRange(logicalRange);
      
      if (barsInfo && barsInfo.barsBefore !== null) {
        // User is viewing earlier data - consider fetching
        if (barsInfo.barsBefore > 0) {
          this.fetchEarlierData();
        }
      }
    });
  }

  async fetchEarlierData() {
    if (this.isFetching) return; // Prevent duplicate requests
    this.isFetching = true;

    try {
      const currentFromDate = this.dataStartDate;
      const newFromDate = new Date(currentFromDate);
      newFromDate.setMonth(newFromDate.getMonth() - 1);

      console.log(`Fetching older data: ${newFromDate.toISOString()} to ${currentFromDate.toISOString()}`);

      const olderData = await this.dataFetcher.getHistoricalData(
        this.currentInstrument,
        this.currentInterval,
        newFromDate.toISOString().split('T')[0],
        currentFromDate.toISOString().split('T')[0]
      );

      if (olderData.length === 0) {
        console.log('No older data available');
        return;
      }

      // Merge data
      const combinedData = [...olderData, ...this.currentData];
      
      // Update chart - use setData() for merged dataset
      this.candlestickSeries.setData(combinedData);
      
      // Update internal state
      this.currentData = combinedData;
      this.dataStartDate = newFromDate;

      console.log(`Extended history by ${olderData.length} bars`);
    } catch (error) {
      console.error('Failed to fetch earlier data:', error);
    } finally {
      this.isFetching = false;
    }
  }

  subscribeToRealtime() {
    this.wsClient.subscribe(this.currentInstrument, (tick) => {
      if (tick.type === 'tick') {
        const chartBar = {
          time: Math.floor(tick.time.getTime() / 1000),
          open: tick.ltp,
          high: tick.ltp,
          low: tick.ltp,
          close: tick.ltp,
        };
        
        // Use update() for real-time ticks
        this.candlestickSeries.update(chartBar);
        
      } else if (tick.type === 'ohlc') {
        const chartBar = {
          time: Math.floor(Date.now() / 1000),
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
        };
        
        this.candlestickSeries.update(chartBar);
      }
    });
  }

  destroy() {
    if (this.wsClient) this.wsClient.disconnect();
    if (this.chart) this.chart.remove();
  }
}
```

---

## Data Flow Diagrams

### Complete Chart Lifecycle

```
APPLICATION START
      │
      ├─────────────────────────────────────────────────────┐
      │                                                     │
      ▼                                                     ▼
┌──────────────────────┐                         ┌──────────────────────┐
│ Load Historical Data │                         │ Connect WebSocket    │
│ HTTP /getData        │                         │ wss://price-feed-tv  │
│ Last 1 month         │                         │ Send 703B handshake  │
│ Uses: setData()      │                         │ Send 129B sub frame  │
└──────────────────────┘                         └──────────────────────┘
      │                                                     │
      │                                                     │
      └─────────────────────────────┬─────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ Chart Displays       │
                          │ Initial 1 month data │
                          └──────────────────────┘
                                    │
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
                 ▼                                     ▼
        ┌────────────────────┐              ┌────────────────────┐
        │ User Pans Left     │              │ Real-Time Updates  │
        │ Needs Older Data   │              │ WebSocket Ticks    │
        └────────┬───────────┘              └─────────┬──────────┘
                 │                                    │
                 ▼                                    ▼
        ┌────────────────────┐              ┌────────────────────┐
        │ Fetch Earlier Data │              │ Parse Binary Data  │
        │ HTTP /getData      │              │ Type 1/3 updates   │
        │ Previous month     │              └─────────┬──────────┘
        │ Uses: setData()    │                        │
        └────────┬───────────┘                        ▼
                 │                          ┌────────────────────┐
                 │                          │ Update Latest Bar  │
                 │                          │ Uses: update()     │
                 │                          └────────┬───────────┘
                 │                                    │
                 └──────────────────┬─────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ Chart State          │
                          │ Extended + Current   │
                          └──────────────────────┘
```

### Data Update Methods Comparison

```
┌──────────────────────────┬──────────────────────────────────────┐
│ setData(historicalBars)  │ update(currentBar)                    │
├──────────────────────────┼──────────────────────────────────────┤
│ Complete dataset         │ Single bar update                    │
│ Replaces all chart data  │ Modifies latest bar or adds new one  │
│ Initial load             │ Real-time updates                    │
│ Pan left (new history)   │ WebSocket ticks                      │
│ Symbol/interval change   │ OHLC updates                         │
│ Full re-render           │ Minimal re-render                    │
│ Higher bandwidth         │ Lower bandwidth                      │
│ ~100ms+ render time      │ ~10ms render time                    │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## Best Practices

### 1. Smart Pan Detection
```javascript
// Only fetch if user is VIEWING older data, not just scrolling
// Add hysteresis to prevent excessive API calls
const shouldFetchOlderData = (logicalRange, bufferBars = 50) => {
  const barsBeforeVisible = logicalRange.barsBefore;
  return barsBeforeVisible < bufferBars; // Fetch when buffer runs low
};
```

### 2. Debounce API Calls
```javascript
// Prevent multiple simultaneous /getData requests during quick pans
let panFetchTimer = null;
const debouncedFetchEarlierData = () => {
  clearTimeout(panFetchTimer);
  panFetchTimer = setTimeout(() => {
    fetchEarlierData();
  }, 300); // Wait 300ms before fetching
};
```

### 3. Cache Downloaded Data
```javascript
// Store fetched historical data to avoid re-fetching
const dataCache = new Map();
const getCachedData = (key) => dataCache.get(key);
const cacheData = (key, data) => dataCache.set(key, data);
```

### 4. Handle Data Gaps
```javascript
// Verify continuity between old and new data
const validateDataContinuity = (olderData, newerData) => {
  if (olderData.length === 0 || newerData.length === 0) return true;
  
  const lastOldTime = olderData[olderData.length - 1].time;
  const firstNewTime = newerData[0].time;
  
  // Allow 1 interval gap (acceptable due to market hours)
  const intervalSeconds = 60; // Adjust based on chart interval
  return (firstNewTime - lastOldTime) <= intervalSeconds;
};
```

### 5. Progressive Loading UI
```javascript
// Show loading indicator during data fetch
const showLoadingIndicator = () => {
  document.getElementById('loader').style.display = 'block';
};

const hideLoadingIndicator = () => {
  document.getElementById('loader').style.display = 'none';
};

async fetchEarlierData() {
  showLoadingIndicator();
  try {
    // ... fetch logic
  } finally {
    hideLoadingIndicator();
  }
}
```

---

## Troubleshooting

### Issue 1: Chart Shows Gaps When Panning
**Cause**: Missing data or improper merging
**Solution**:
```javascript
// Verify data continuity and remove overlaps
const mergeCleanly = (olderData, currentData) => {
  const lastOldTime = olderData[olderData.length - 1]?.time || 0;
  const filtered = currentData.filter(bar => bar.time > lastOldTime);
  return [...olderData, ...filtered];
};
```

### Issue 2: Pan Events Fire Too Frequently
**Cause**: No debouncing on pan detection
**Solution**:
```javascript
// Use debounce pattern (see Best Practices section)
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 1000; // 1 second minimum

const shouldFetch = () => {
  return Date.now() - lastFetchTime > MIN_FETCH_INTERVAL;
};
```

### Issue 3: Real-Time Updates Stop After Panning
**Cause**: WebSocket subscription lost or `update()` called with old timestamp
**Solution**:
```javascript
// Ensure timestamp is current when calling update()
const chartBar = {
  time: Math.floor(Date.now() / 1000), // Always use current time
  open: tick.ltp,
  high: tick.ltp,
  low: tick.ltp,
  close: tick.ltp,
};
this.candlestickSeries.update(chartBar);
```

### Issue 4: `/getData` Request Fails with 401
**Cause**: Missing or invalid authentication headers
**Solution**:
```javascript
// Ensure all required headers are present
const headers = {
  'Content-Type': 'application/json',
  'Auth': AUTH_TOKEN,           // Valid JWT
  'Authorization': SIGNATURE,   // Correct signature hash
  'Bid': 'DHN1804',            // Broker ID
  'Cid': CLIENT_ID,            // Client ID
  'Src': 'T'                   // Source (TradingView)
};
```

### Issue 5: Chart Flickers When Setting New Data
**Cause**: Extreme zoom levels or too many bars
**Solution**:
```javascript
// Limit historical data in memory
const MAX_BARS = 2000;
const trimData = (data) => {
  if (data.length <= MAX_BARS) return data;
  return data.slice(-MAX_BARS); // Keep most recent MAX_BARS
};

this.candlestickSeries.setData(trimData(combinedData));
```

---

## Summary

### Key Takeaways

1. **Initial Load**: Use `/getData` → `setData()` for bulk historical data (typically 1 month)
2. **Real-Time**: Use WebSocket → `update()` for live price ticks (minimal overhead)
3. **Pan Left**: Detect viewport shift → Fetch older `/getData` → Merge → `setData()` with combined dataset
4. **Method Selection**: `setData()` for complete datasets, `update()` for single bars
5. **Performance**: Debounce pan requests, cache data, limit bars in memory, validate continuity

### The Flow
```
Chart Opens
  ↓
Load 1 month history via /getData
  ↓
Display with setData()
  ↓
Connect WebSocket
  ↓
Real-time updates via update()
  ↓
User pans left
  ↓
Detect pan event
  ↓
Fetch older data via /getData
  ↓
Merge with existing data
  ↓
Re-render with setData()
  ↓
Continue real-time updates
```

---

**Document Version**: 1.0  
**Created**: 2025-11-23  
**Status**: Reference Documentation  
**Related Files**:
- `DHAN_CHART_INTEGRATION_GUIDE.md` – Complete integration details
- `websocket_analysis_summary.md` – WebSocket protocol details
- `DHAN_PROXY_HANDOVER.md` – Development proxy setup
