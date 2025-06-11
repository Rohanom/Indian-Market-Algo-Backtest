# TrueData WebSocket Server Setup

## Files Structure

- `server.js` - Original KiteConnect WebSocket server (Port 8080)
- `server2.js` - New TrueData WebSocket server (Port 8081)
- `package.json` - Updated with both dependencies and scripts

## Environment Variables

Add these to your `.env` file in the project root:

```env
# TrueData Credentials (for server2.js)
TRUEDATA_USERNAME=your_truedata_username
TRUEDATA_PASSWORD=your_truedata_password
TRUEDATA_PORT=8082
WS_PORT_TRUEDATA=8081

# KiteConnect Credentials (for server.js)
KITE_API_KEY=your_kite_api_key
WS_PORT=8080

# Redis (for server.js)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Installation

1. Install TrueData dependency:
```bash
npm install truedata-nodejs
```

2. Install all dependencies:
```bash
npm install
```

## Running the Servers

### Option 1: KiteConnect Server (Original)
```bash
npm start
# or
npm run dev
```
- Runs on port 8080
- Uses KiteConnect + Redis
- Original functionality

### Option 2: TrueData Server (New)
```bash
npm run start:truedata
# or
npm run dev:truedata
```
- Runs on port 8081
- Uses TrueData API
- New implementation

### Option 3: Run Both Servers
```bash
# Terminal 1
npm start

# Terminal 2  
npm run start:truedata
```

## API Endpoints

### KiteConnect Server (Port 8080)
- `GET /health`
- `GET /instruments/status`
- `POST /instruments/populate`

### TrueData Server (Port 8081)
- `GET /health`
- `GET /market/status`
- `POST /historical/bars`

## WebSocket Connections

### KiteConnect WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### TrueData WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8081');
```

## TrueData Message Examples

### Subscribe to symbols:
```json
{
  "type": "subscribe",
  "symbols": ["NIFTY-I", "BANKNIFTY-I", "RELIANCE"]
}
```

### Get market status:
```json
{
  "type": "getMarketStatus"
}
```

### Get historical data:
```json
{
  "type": "getHistoricalData",
  "symbol": "NIFTY-I",
  "from": "2024-01-01T09:15:00",
  "to": "2024-01-01T15:30:00",
  "interval": "1min"
}
```

## Default Symbols (TrueData)

- `NIFTY-I` (Nifty Index)
- `BANKNIFTY-I` (Bank Nifty Index)

## Next Steps

1. Get TrueData credentials from: https://www.truedata.in/
2. Add credentials to `.env` file
3. Test the TrueData server: `npm run dev:truedata`
4. When ready, switch frontend to use port 8081

## Migration Path

1. Keep KiteConnect server running (port 8080)
2. Start TrueData server (port 8081)  
3. Test TrueData functionality
4. Update frontend to connect to port 8081
5. Eventually deprecate KiteConnect server

This allows for smooth transition without breaking existing functionality! 