# TrueData WebSocket Server

A WebSocket server that provides real-time market data streaming using TrueData's API. This server handles client connections and streams live market data including touchline, tick, bid-ask, and bar data.

## Features

- 🔄 Real-time market data streaming via TrueData
- 📊 Multiple data types: touchline, tick, bid-ask, bar data, Greeks
- 🔌 WebSocket connections for multiple clients
- 📈 Historical data API endpoints
- 🏪 Market status monitoring
- 💓 Automatic heartbeat and reconnection
- 🎯 Dynamic symbol subscription/unsubscription

## Prerequisites

- Node.js (>= 14.x)
- TrueData API credentials

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with your TrueData credentials:
```env
# TrueData API Configuration
TRUEDATA_USERNAME=your_truedata_username
TRUEDATA_PASSWORD=your_truedata_password
TRUEDATA_PORT=8082

# WebSocket Server Configuration
WS_PORT=8080

# Environment
NODE_ENV=development
```

## Usage

### Start the server:
```bash
npm start
```

### Development mode with auto-restart:
```bash
npm run dev
```

## API Endpoints

### REST Endpoints

- `GET /health` - Health check with connection status
- `GET /market/status` - Market status and subscription info
- `POST /historical/bars` - Get historical bar data

### WebSocket Messages

#### Client to Server Messages

1. **Subscribe to symbols:**
```json
{
  "type": "subscribe",
  "symbols": ["NIFTY-I", "BANKNIFTY-I", "RELIANCE"]
}
```

2. **Unsubscribe from symbols:**
```json
{
  "type": "unsubscribe", 
  "symbols": ["RELIANCE"]
}
```

3. **Get market status:**
```json
{
  "type": "getMarketStatus"
}
```

4. **Get historical data:**
```json
{
  "type": "getHistoricalData",
  "symbol": "NIFTY-I",
  "from": "2024-01-01T09:15:00",
  "to": "2024-01-01T15:30:00",
  "interval": "1min"
}
```

5. **Ping:**
```json
{
  "type": "ping"
}
```

#### Server to Client Messages

1. **Welcome message:**
```json
{
  "type": "welcome",
  "message": "Connected to TrueData WebSocket server",
  "clientId": "client_123",
  "truedata_connected": true,
  "available_symbols": ["NIFTY-I", "BANKNIFTY-I"],
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

2. **Market data (touchline):**
```json
{
  "type": "touchline",
  "data": {
    "symbol": "NIFTY-I",
    "ltp": 18500.50,
    "change": 25.75,
    "changePercent": 0.14
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

3. **Tick data:**
```json
{
  "type": "tick",
  "data": {
    "symbol": "NIFTY-I",
    "ltp": 18500.50,
    "volume": 1000,
    "ohlc": {
      "open": 18475.00,
      "high": 18520.00,
      "low": 18460.00,
      "close": 18500.50
    }
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

4. **Bid-Ask data:**
```json
{
  "type": "bidask",
  "data": {
    "symbol": "NIFTY-I",
    "bid": 18499.75,
    "ask": 18500.25,
    "bidQty": 100,
    "askQty": 75
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

## Symbol Formats

Use TrueData symbol formats:
- **Indices:** `NIFTY-I`, `BANKNIFTY-I`
- **Stocks:** `RELIANCE`, `TCS`, `INFY`
- **Futures:** `NIFTY24JANFUT`, `RELIANCE24JANFUT`
- **Options:** `NIFTY2431818000CE`, `BANKNIFTY2431845000PE`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRUEDATA_USERNAME` | Your TrueData username | Required |
| `TRUEDATA_PASSWORD` | Your TrueData password | Required |
| `TRUEDATA_PORT` | TrueData connection port | 8082 |
| `WS_PORT` | WebSocket server port | 8080 |

### Default Symbols

The server starts with these default subscriptions:
- `NIFTY-I` (Nifty Index)
- `BANKNIFTY-I` (Bank Nifty Index)

## Error Handling

The server includes comprehensive error handling:
- Connection failures are logged and reported
- Invalid messages return error responses
- Automatic cleanup on client disconnections
- Graceful shutdown handling

## Development

### File Structure
```
websocket-server/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts  
├── README.md          # This file
└── node_modules/      # Dependencies
```

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## License

ISC

## Support

For TrueData API support, contact: support@truedata.in 