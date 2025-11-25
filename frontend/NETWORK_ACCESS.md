# Network Access Setup

## Local Development (Default)
The app uses `http://localhost:3001` by default. No configuration needed.

## Network Access (Other Devices)

To access the trading platform from other devices on your network:

### 1. Create `.env` file
Copy the example file:
```bash
cp .env.example .env
```

### 2. Update with your IP address
Edit `.env` and replace `localhost` with your computer's local IP:
```
VITE_API_URL=http://192.168.1.100:3001
```

> **Find your IP**:
> - Windows: `ipconfig` (look for IPv4 Address)
> - Mac/Linux: `ifconfig` or `ip addr`

### 3. Start dev server with network access
```bash
npm run dev -- --host
```

Output will show:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

### 4. Access from other devices
Open browser on any device and go to:
```
http://192.168.1.100:5173
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API base URL |

The WebSocket URL is automatically derived from `VITE_API_URL` (replaces `http://` with `ws://`).

## Firewall

Make sure your firewall allows connections on:
- Port **5173** (Frontend)
- Port **3001** (Backend)

### Windows Firewall
1. Open Windows Defender Firewall
2. Advanced Settings → Inbound Rules → New Rule
3. Port → TCP → Ports: `5173,3001`
4. Allow the connection
5. Apply to all profiles

## Troubleshooting

**Frontend loads but backend fails**:
- Check `.env` file has correct IP
- Verify backend is running on `0.0.0.0:3001`
- Check firewall rules

**WebSocket connection fails**:
- Backend uses same IP as API_URL
- WebSocket port is same as backend (3001)
- Check browser console for connection errors
