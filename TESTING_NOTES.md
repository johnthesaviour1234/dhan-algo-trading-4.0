# Testing Notes - Access Token Check Feature

## ✅ Completed Tests

### Test 1: No Token Scenario
**Date**: 2025-11-26  
**Status**: ✅ PASSED

**Steps Performed**:
1. Cleared `localStorage` token via DevTools console
2. Restarted backend server
3. Refreshed frontend page

**Results**:
- Button displayed as **disabled** (gray background)
- Warning message shown: "⚠️ Please set your Dhan Access Token first"
- Cannot select or start strategies

### Test 2: Token Detection
**Date**: 2025-11-26  
**Status**: ✅ PASSED

**Steps Performed**:
1. Pasted access token in AccessTokenInput component
2. Waited for polling check (5 seconds max)

**Results**:
- Token detected within 5 seconds
- Button became **enabled** (green background)
- Warning message disappeared
- Can select strategies

---

## ⏳ Pending Tests (Requires Market Hours)

### Test 3: Strategy Execution Prevention
**Priority**: HIGH  
**Blocker**: Market closed (after-market orders penalized)

**Steps to Perform**:
```
1. Clear localStorage token
2. Restart backend
3. Refresh page
4. Select Testing or Testing-2 strategy
5. Click "Start Live Trading" button
```

**Expected Results**:
- ❌ Error toast: "Please set your Dhan Access Token first!"
- ❌ Strategies DO NOT start
- ❌ NO orders placed
- ✅ Console logs: "Please set your Dhan Access Token first!"

**Actual Results**: *Pending market hours testing*

---

### Test 4: Normal Strategy Execution
**Priority**: HIGH  
**Blocker**: Market closed

**Steps to Perform**:
```
1. Paste access token
2. Wait for detection (5s)
3. Select Testing strategy
4. Click "Start Live Trading"
```

**Expected Results**:
- ✅ Strategies start normally
- ✅ BUY order executes after 0s (Testing)
- ✅ SELL order executes after 5s
- ✅ WebSocket receives order updates
- ✅ Orders displayed in Order Management Panel

**Actual Results**: *Pending market hours testing*

---

### Test 5: Token Expiry During Trading
**Priority**: MEDIUM  
**Blocker**: Market closed

**Steps to Perform**:
```
1. Start live trading with valid token
2. While running, clear localStorage token manually
3. Wait for next strategy BUY attempt
```

**Expected Results**:
- Strategy should fail to place order
- Error handling should show appropriate message

**Actual Results**: *Pending market hours testing*

---

## Implementation Details

### Files Modified
- `frontend/src/components/LiveTradingPanel.tsx`
  - Added `hasAccessToken` state (line 27)
  - Added `useEffect` polling every 5s (line 30-51)
  - Added token guard in `startLiveTrading()` (line 109-112)
  - Modified button disable logic (line 274)
  - Added warning message (line 283-287)

### Git Commits
- `7c80860` - Clean access token check implementation

### Testing Schedule
**Next Testing Window**: Next market trading session  
**Test Duration**: ~10 minutes  
**Requirements**: Active Dhan account, market hours (9:15 AM - 3:30 PM IST)

---

## Notes
- `localStorage.removeItem('dhan_access_token')` returns `undefined` (normal behavior)
- Token persists across page reloads (by design)
- Backend token cleared on restart (in-memory storage)
- 5-second polling prevents immediate detection issues
