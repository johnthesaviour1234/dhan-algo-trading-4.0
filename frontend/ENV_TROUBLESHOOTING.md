# ⚠️ IMPORTANT: Restart Required After Changes

After modifying the `.env` file, you **MUST restart** the Vite dev server for changes to take effect.

## Steps to Apply .env Changes

1. **Stop the dev server**: Press `Ctrl + C` in the terminal running `npm run dev`

2. **Restart with network access**:
   ```bash
   npm run dev -- --host
   ```

3. **Verify in browser console**: You should see:
   ```
   📡 API Configuration:
      VITE_API_URL (from .env): http://192.168.0.161:3001
      API_URL (final): http://192.168.0.161:3001
      WS_URL: ws://192.168.0.161:3001
   ```

4. **If still showing localhost**: 
   - Make sure `.env` file exists in `frontend/` directory (NOT `frontend/src/`)
   - Check `.env` has correct format: `VITE_API_URL=http://192.168.0.161:3001` (no quotes, no spaces)
   - Hard refresh browser: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

## Common Issues

### Issue: Still using localhost after restart
**Cause**: `.env` file not in correct location  
**Fix**: Make sure it's `frontend/.env`, not `frontend/src/.env`

### Issue: VITE_API_URL shows undefined
**Cause**: Variable name typo or missing `VITE_` prefix  
**Fix**: Must start with `VITE_` → `VITE_API_URL=...`

### Issue: Changes not reflecting
**Cause**: Browser cache  
**Fix**: Hard refresh (`Ctrl + Shift + R`) or clear cache

## Your Current Setup

Based on your Vite output:
```
➜  Network: http://192.168.0.161:5173/
```

Your `.env` should be:
```
VITE_API_URL=http://192.168.0.161:3001
```

Then **restart** the dev server!
