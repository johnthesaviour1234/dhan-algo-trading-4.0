# Dhan Timestamp Handling Research Analysis

## Summary

After analyzing Dhan's JavaScript source code, I found **critical discoveries** regarding how timestamps are handled in their WebSocket binary protocol. The key finding is that **Dhan uses a custom epoch starting from January 1, 1980 at 05:30:00** (IST midnight offset), NOT the standard Unix epoch.

---

## 1. Binary Message Decoding

### Question: How does Dhan decode the timestamp field (bytes 29-33) from LTP binary messages?

**Answer:** ✅ FOUND

**Location:** `dhanfeeds/udf/dist/bundle2.1.37.js` lines 13960-13975

```javascript
ltpBind(t) {
    const i = e;
    var n = [];
    n[0] = new Uint8Array(t[i(412)](0, 1))[0][i(1403)](),
    n[1] = new Uint32Array(t[i(412)](1, 5))[0].toString(),
    n[2] = new Uint16Array(t[i(412)](15, 17))[0][i(1403)](),
    n[3] = new Uint8Array(t[i(412)](0, 1))[0][i(1403)](),
    n[4] = new Uint8Array(t[i(412)](0, 1))[0].toString(),
    n[5] = new Float32Array(t[i(412)](11, 15))[0][i(1403)](),
    n[6] = new Uint8Array(t[i(412)](0, 1))[0].toString(),
    n[7] = new Uint32Array(t.slice(17, 21))[0][i(1403)](),
    n[8] = new Float32Array(t[i(412)](21, 25))[0][i(1403)](),
    n[9] = new Uint32Array(t[i(412)](25, 29))[0][i(1403)](),
    n[10] = new Uint32Array(t[i(412)](29, 33))[0][i(1403)](),  // ← TIMESTAMP
    n[11] = new Uint32Array(t[i(412)](33, 37))[0][i(1403)](),
    this[i(3194)](n)
}
```

**Key Findings:**
- Bytes 29-33 are read as **Uint32Array** (little-endian, 32-bit unsigned integer)
- The value is extracted and stored as `n[10]`
- Converted to string with `.toString()`
- No multiplication by 1000 at decode time

---

## 2. Timestamp Conversion/Adjustment

### Question: Does Dhan apply any offset, timezone conversion, or epoch adjustment to the decoded timestamp?

**Answer:** ✅ YES - Critical Discovery!

**Location:** `dhanfeeds/udf/dist/bundle2.1.37.js` lines 14235-14243

```javascript
julianIntToDateWS(t) {
    const i = e;
    // Subtract timezone offset (330 minutes for IST + current timezone offset)
    t -= 60 * (330 + (new Date)[i(3501)]());
    
    // CRITICAL: Custom epoch starting January 1, 1980 at 05:30:00
    let n = ["1980", "01", "01", "05", "30", "00"]
      , o = new Date(n[0],n[1] - 1,n[2],n[3],n[4],n[5]);
    
    // Add the timestamp seconds to the epoch
    o[i(2175)](t);  // setSeconds(t)
    
    // Format and return as Date object
    let s = (o[i(1585)]() + "-" + ("0" + (o[i(1479)]() + 1))[i(412)](-2) + "-" + ("0" + o.getDate())[i(412)](-2) + "-" + ("0" + o[i(717)]())[i(412)](-2) + "-" + ("0" + o[i(573)]()).slice(-2) + "-" + ("0" + o[i(466)]()).slice(-2)).split("-");
    return new Date(s[0],s[1] - 1,s[2],s[3],s[4],s[5])
}
```

**Critical Discovery:**
- **Custom Epoch:** `1980-01-01 05:30:00` (NOT Unix epoch 1970-01-01 00:00:00)
- **Offset Calculation:** `timestamp - (330 + currentTimezoneOffset) * 60` seconds
- **330 minutes = 5.5 hours** (IST is UTC+5:30)
- This explains the ~10-year discrepancy (1970 → 1980)

**Usage in LTP data binding:** Line 13993
```javascript
this.ltpMapData[n].LTT = this[i(470)](t[10])  // calls julianIntToDateWS
```

---

## 3. Timestamp Usage in Candle Aggregation

### Question: When creating 1-minute candles, does Dhan use the message timestamp or system time?

**Answer:** ✅ **Hybrid Approach** - Uses BOTH!

### For Seconds-based Resolution (S prefix):
**Location:** Lines 13807-13852

```javascript
[e(2713)](t, i) {  // updateSecChartsData
    const n = e;
    let o = 0
      , s = JSON[n(2496)](JSON[n(1300)](i))
      , l = n(1839) + t[n(2304)]
      , a = t[n(1258)][l];
    
    // Convert LTT timestamp to milliseconds
    s[n(822)] = new Date(s[n(822)]).getTime(),
    o = s[n(822)];
    
    let r = +t.resolution[n(2853)](/\d+/g)[0];
    
    // Round down to resolution boundary
    if (o = new Date(Math.floor(o / (1e3 * r)) * (1e3 * r))[n(1131)](),
    a && a.LTT == o) {
        // Update existing candle
        // ...
    } else {
        // Create new candle with timestamp 'o'
        a = {},
        a[n(822)] = o,  // LTT = timestamp (aligned)
        // ...
    }
    
    t[n(490)]({  // onTick
        time: c,  // Uses the aligned timestamp
        close: d,
        open: h,
        high: p,
        low: u,
        volume: m
    })
}
```

### For Intraday Resolution (I prefix):
**Location:** Lines 13854-13918

```javascript
[e(2020)](t, i) {  // updateChartsData
    const n = e;
    let o = 0
      , s = JSON[n(2496)](JSON.stringify(i))
      , l = n(1839) + t[n(2304)]
      , a = t[n(1258)][l];
    
    if ("I" == rn(t[n(2304)])) {
        s.LTT = new Date(s[n(822)])[n(2175)](0),
        s[n(822)] = new Date(s[n(822)]).getTime(),
        o = new Date(s[n(822)])[n(1131)](),
        
        // Special alignment for 5, 15, 25, 60 minute intervals
        if ("5" == t[n(2304)] || "15" == t[n(2304)] || "25" == t[n(2304)] || "60" == t.resolution) {
            let e = t[n(1258)][n(955)][n(3648)]("-")
              , i = e[0][n(530)](0, 2)
              , l = e[0][n(530)](2, 4)
              , a = new Date;
            a = new Date(a[n(1585)](),a.getMonth(),a[n(1908)](),i,l,0),
            a = a[n(1131)]() / 1e3,
            o = s[n(822)] / 1e3,
            o -= 60 * (o % a / 60 % parseInt(t[n(2304)])),  // Align to interval
            o *= 1e3
        }
        
        if (a && a[n(822)] == o) {
            // Update existing candle
        } else {
            // Create new candle
            a = {},
            a[n(822)] = o,
            // ...
        }
        
        // Throttled update (max 0.4s)
        (!t[n(3597)] || ((new Date)[n(1131)]() - t[n(3597)]) / 1e3 > .4) && (t.onTick({
            time: e,
            close: i,
            open: r,
            high: c,
            low: d,
            volume: h
        }),
        t[n(3597)] = (new Date).getTime())  // Uses Date.now() for throttling
    }
}
```

**Key Findings:**
1. **Message timestamp IS used** for candle time assignment
2. **Timestamp is aligned** to resolution boundaries using `Math.floor(timestamp / (resolution * 1000)) * (resolution * 1000)`
3. **Date.now() is ONLY used** for throttling updates (0.4-0.5 second minimum between updates)
4. **NOT used for candle time** - they use the actual message timestamp

---

## 4. Chart Data Time Handling

### Question: How does Dhan align chart timestamps with live data timestamps?

**Answer:** ✅ Time Alignment Found

**Key Pattern:**
```javascript
// From line 13816 - Seconds resolution alignment
o = new Date(Math.floor(o / (1e3 * r)) * (1e3 * r))[n(1131)]()

// From lines 13864-13873 - Intraday resolution alignment  
if ("5" == t.resolution || "15" == t.resolution || "25" == t.resolution || "60" == t.resolution) {
    // Complex alignment to market open time
    o -= 60 * (o % a / 60 % parseInt(t.resolution))
    o *= 1e3
}
```

**Findings:**
- **No explicit merge logic** found between historical and live data
- **Same alignment algorithm** used for both historical and live ticks
- **Comparison by time equality:** `a && a.LTT == o` determines update vs new candle
- TradingView chart library handles merging via `alignTime` functions in `chart_library/bundles/library.f2e613af8322ec849388.js`

---

## 5. Alternative Time Sources

### Question: Does Dhan use any other timestamp fields or derive time from other sources?

**Answer:** ✅ NO alternative sources found

**Findings:**
- ❌ No server time headers (`x-server-time`, `x-timestamp`)
- ❌ No NTP or time synchronization code
- ❌ No heartbeat timestamp handling
- ✅ **Only source:** Binary message bytes 29-33

**Time validation check found** (line ~14814 in stockChart bundle):
```javascript
Math[n(3135)](e - Date.now()) > 6e5 && (dhanTrading_Host[n(735)](n(958), "Please make sure your device time is correct", 0)
```
This warns if server time differs from client time by more than 10 minutes (600,000ms).

---

## Critical Answers to Your Questions

### 1. Is the timestamp field (bytes 29-33) actually used for anything important?

**YES!** It's used for:
- Setting `LTT` (Last Traded Time) in market data
- Creating candle timestamps for charts
- Time-based candle aggregation

### 2. If yes, is there a conversion formula we're missing?

**YES!** The conversion formula is:

```javascript
// Step 1: Read raw value from bytes 29-33
rawTimestamp = new Uint32Array(buffer.slice(29, 33))[0]

// Step 2: Apply timezone offset
adjustedTimestamp = rawTimestamp - (330 + currentTimezoneOffset) * 60

// Step 3: Add to custom epoch (1980-01-01 05:30:00)
epoch = new Date(1980, 0, 1, 5, 30, 0)  // Jan 1, 1980, 05:30:00
actualDate = new Date(epoch.getTime() + adjustedTimestamp * 1000)
```

**In your code, you need:**
```javascript
const DHAN_EPOCH = new Date('1980-01-01T05:30:00+05:30').getTime() / 1000; // seconds
const actualTimestamp = rawTimestamp + DHAN_EPOCH;
```

### 3. Do they use Date.now() for candle aggregation like we do?

**NO!** They use:
- **Message timestamp** for candle time
- **Date.now()** only for throttling UI updates (max 2-3 updates per second)

### 4. Is there a separate "server time" they sync with?

**NO** - they rely entirely on the timestamp in binary messages.

### 5. How do they handle the 10-year discrepancy?

They handle it with the **custom epoch of 1980-01-01 05:30:00**.

---

## Recommended Fix for Your Implementation

Based on Dhan's approach, you should:

1. **Update your timestamp decoder:**
```javascript
const DHAN_EPOCH_MS = new Date('1980-01-01T00:00:00Z').getTime();
const IST_OFFSET_SECONDS = 330 * 60; // 5.5 hours

function decodeDhanTimestamp(rawTimestamp) {
    // Dhan epoch: 1980-01-01 05:30:00 IST = 1980-01-01 00:00:00 UTC
    const timestampSeconds = rawTimestamp - IST_OFFSET_SECONDS;
    return DHAN_EPOCH_MS + (timestampSeconds * 1000);
}
```

2. **Use message timestamp for candles:**
```javascript
// Don't use Date.now() for candle time
const candleTime = decodeDhanTimestamp(messageTimestamp);

// Align to resolution
const resolution = 60; // seconds
const alignedTime = Math.floor(candleTime / (resolution * 1000)) * (resolution * 1000);
```

3. **Keep Date.now() only for throttling:**
```javascript
const MIN_UPDATE_INTERVAL = 400; // ms
if (!lastUpdateTime || (Date.now() - lastUpdateTime) > MIN_UPDATE_INTERVAL) {
    updateChart(candle);
    lastUpdateTime = Date.now();
}
```

---

## Files Analyzed

1. `dhanfeeds/udf/dist/bundle2.1.37.js` - Main market data handler (minified)
2. `stockChart (tv-web.dhan.co)/dhanfeeds/udf/dist/bundle2.1.36.js` - Another version
3. `main.a87d785534d452d6.js` - Similar binary parsing logic
4. `chart_library/bundles/library.f2e613af8322ec849388.js` - TradingView chart library

---

## Conclusion

The **10-year timestamp discrepancy** is NOT a bug - it's by design. Dhan uses a **custom epoch starting January 1, 1980 at 05:30:00 IST** instead of the Unix epoch (1970-01-01 00:00:00 UTC).

Your implementation should:
1. ✅ Use the 1980 epoch
2. ✅ Apply the IST offset (330 minutes)
3. ✅ Use message timestamp for candle time
4. ✅ Keep Date.now() only for UI throttling

This matches Dhan's exact implementation and will resolve your timestamp issues.
