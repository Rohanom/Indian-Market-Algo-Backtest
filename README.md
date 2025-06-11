# Stock Backtesting Platform

A comprehensive stock market backtesting platform with real-time data streaming, options chain analysis, and trading strategy implementation.

## 🚀 Features

- **Real-time Market Data**: WebSocket streaming via KiteConnect and TrueData APIs
- **Options Chain Analysis**: Live options data with Greeks calculation
- **Strategy Backtesting**: Test trading strategies against historical data
- **Web Dashboard**: Next.js frontend with real-time charts and analytics
- **Multi-Provider Support**: Both KiteConnect and TrueData integrations
- **Redis Caching**: Instrument data caching for performance

## 📁 Project Structure

```
stock-backtesting/
├── src/                    # Next.js frontend application
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── lib/              # Utility functions
├── websocket-server/      # WebSocket server implementations
│   ├── server.js         # KiteConnect WebSocket server (Port 8080)
│   ├── server2.js        # TrueData WebSocket server (Port 8081)
│   ├── scripts/          # Utility scripts
│   └── README.md         # Server documentation
├── public/               # Static assets
├── test-*.js            # API testing scripts
├── test_truedata.py     # TrueData Python testing
└── README.md            # This file
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Hooks** - State management

### Backend
- **Node.js** - WebSocket servers
- **Express.js** - REST API endpoints
- **WebSocket (ws)** - Real-time communication
- **Redis** - Data caching
- **Python** - Data analysis scripts

### Data Providers
- **KiteConnect** - Zerodha's trading API
- **TrueData** - Real-time market data API

## 🚦 Getting Started

### Prerequisites
- Node.js >= 16.x
- Python >= 3.8
- Redis server
- Trading API credentials (KiteConnect or TrueData)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd stock-backtesting
```

2. **Install dependencies**
```bash
# Frontend dependencies
npm install

# WebSocket server dependencies
cd websocket-server
npm install
cd ..
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
# KiteConnect Configuration
KITE_API_KEY=your_kite_api_key
KITE_API_SECRET=your_kite_api_secret

# TrueData Configuration  
TRUEDATA_USERNAME=your_truedata_username
TRUEDATA_PASSWORD=your_truedata_password
TRUEDATA_PORT=8082

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Ports
WS_PORT=8080
WS_PORT_TRUEDATA=8081
```

### Running the Application

1. **Start Redis Server**
```bash
redis-server
```

2. **Start WebSocket Servers**

**Option A: KiteConnect Server**
```bash
cd websocket-server
npm start              # Production
npm run dev            # Development
```

**Option B: TrueData Server**
```bash
cd websocket-server
npm run start:truedata # Production
npm run dev:truedata   # Development
```

**Option C: Both Servers**
```bash
# Terminal 1
cd websocket-server && npm start

# Terminal 2  
cd websocket-server && npm run start:truedata
```

3. **Start Frontend**
```bash
# In project root
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:3000
- KiteConnect WebSocket: ws://localhost:8080
- TrueData WebSocket: ws://localhost:8081
- Health checks: 
  - http://localhost:8080/health
  - http://localhost:8081/health

## 📊 API Documentation

### WebSocket Messages

#### KiteConnect Server (Port 8080)
```javascript
// Initialize connection
ws.send(JSON.stringify({
  type: 'init',
  apiKey: 'your_api_key',
  accessToken: 'your_access_token'
}));

// Get options data
ws.send(JSON.stringify({
  type: 'getOptions'
}));
```

#### TrueData Server (Port 8081)
```javascript
// Subscribe to symbols
ws.send(JSON.stringify({
  type: 'subscribe',
  symbols: ['NIFTY-I', 'BANKNIFTY-I', 'RELIANCE']
}));

// Get market status
ws.send(JSON.stringify({
  type: 'getMarketStatus'
}));
```

### REST Endpoints

#### KiteConnect Server
- `GET /health` - Server health status
- `GET /instruments/status` - Instrument cache status
- `POST /instruments/populate` - Populate instrument cache

#### TrueData Server
- `GET /health` - Server health status
- `GET /market/status` - Market connection status
- `POST /historical/bars` - Get historical bar data

## 🧪 Testing

### API Testing Scripts
```bash
# Test KiteConnect API
node test-options-api.js

# Test live options data
node test-live-options.js

# Test TrueData API (Python)
python test_truedata.py
```

## 🔧 Configuration

### Symbol Formats

**KiteConnect:**
- Indices: Use instrument tokens
- Options: Use instrument tokens from instruments list

**TrueData:**
- Indices: `NIFTY-I`, `BANKNIFTY-I`
- Stocks: `RELIANCE`, `TCS`, `INFY`
- Futures: `NIFTY24JANFUT`
- Options: `NIFTY2431818000CE`

## 📈 Features In Development

- [ ] Strategy backtesting engine
- [ ] Paper trading simulation
- [ ] Advanced charting with indicators
- [ ] Real-time P&L tracking
- [ ] Risk management tools
- [ ] Historical data analysis
- [ ] Performance metrics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the [WebSocket Server Documentation](websocket-server/README.md)
- Review the [TrueData Setup Guide](websocket-server/TRUEDATA_SETUP.md)

## 📚 Documentation

- [WebSocket Server Setup](websocket-server/README.md)
- [TrueData Integration Guide](websocket-server/TRUEDATA_SETUP.md)
- [API Documentation](docs/api.md) (Coming Soon)
- [Strategy Development Guide](docs/strategies.md) (Coming Soon)

---

**⚠️ Disclaimer**: This software is for educational and research purposes only. Trading in financial markets involves risk and this tool should not be used for live trading without proper testing and risk management.
