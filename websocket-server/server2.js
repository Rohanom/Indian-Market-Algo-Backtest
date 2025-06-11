const WebSocket = require('ws');
const { rtConnect, rtDisconnect, rtSubscribe, rtUnsubscribe, rtFeed, historical, isSocketConnected } = require('truedata-nodejs');
const http = require('http');
const cors = require('cors');
const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create Express app for potential REST endpoints
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    cors: {
        origin: "*", // Configure this for production
        methods: ["GET", "POST"]
    }
});

// Store active client connections
const clients = new Map();

// TrueData connection variables
let trueDataConnected = false;
let subscribedSymbols = new Set();

// TrueData credentials from environment
const TRUEDATA_USER = process.env.TRUEDATA_USERNAME;
const TRUEDATA_PWD = process.env.TRUEDATA_PASSWORD;
const TRUEDATA_PORT = process.env.TRUEDATA_PORT || 8082;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        connections: clients.size,
        truedata_connected: trueDataConnected,
        subscribed_symbols: Array.from(subscribedSymbols),
        timestamp: new Date().toISOString()
    });
});

// Endpoint to get market status
app.get('/market/status', (req, res) => {
    try {
        const connected = isSocketConnected();
        res.json({
            status: 'ok',
            truedata_connected: connected,
            subscribed_symbols: Array.from(subscribedSymbols),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint to get historical data
app.post('/historical/bars', async (req, res) => {
    try {
        const { symbol, from, to, interval = '1min' } = req.body;
        
        if (!symbol || !from || !to) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters: symbol, from, to',
                timestamp: new Date().toISOString()
            });
        }

        // Authenticate historical API
        historical.auth(TRUEDATA_USER, TRUEDATA_PWD);
        
        const data = await historical.getBarData(symbol, from, to, interval);
        
        res.json({
            status: 'success',
            symbol,
            interval,
            from,
            to,
            data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching historical data:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// TrueData event handlers
function setupTrueDataHandlers() {
    console.log('🔄 Setting up TrueData event handlers...');

    // Handle touchline data (LTP updates)
    rtFeed.on('touchline', (touchline) => {
        console.log('📊 Touchline data received:', touchline.symbol);
        broadcastToClients({
            type: 'touchline',
            data: touchline,
            timestamp: new Date().toISOString()
        });
    });

    // Handle tick data (detailed market data)
    rtFeed.on('tick', (tick) => {
        console.log('📈 Tick data received:', tick.symbol);
        broadcastToClients({
            type: 'tick',
            data: tick,
            timestamp: new Date().toISOString()
        });
    });

    // Handle bid-ask data
    rtFeed.on('bidask', (bidask) => {
        console.log('💰 Bid-Ask data received:', bidask.symbol);
        broadcastToClients({
            type: 'bidask',
            data: bidask,
            timestamp: new Date().toISOString()
        });
    });

    // Handle bar data (1min, 5min bars)
    rtFeed.on('bar', (bar) => {
        console.log('📊 Bar data received:', bar.symbol);
        broadcastToClients({
            type: 'bar',
            data: bar,
            timestamp: new Date().toISOString()
        });
    });

    // Handle market status updates
    rtFeed.on('marketstatus', (status) => {
        console.log('🏪 Market status:', status);
        broadcastToClients({
            type: 'marketstatus',
            data: status,
            timestamp: new Date().toISOString()
        });
    });

    // Handle heartbeat
    rtFeed.on('heartbeat', (heartbeat) => {
        console.log('💓 Heartbeat:', heartbeat);
        broadcastToClients({
            type: 'heartbeat',
            data: heartbeat,
            timestamp: new Date().toISOString()
        });
    });

    // Handle Greeks data for options
    rtFeed.on('greeks', (greeks) => {
        console.log('🎯 Greeks data received:', greeks.symbol);
        broadcastToClients({
            type: 'greeks',
            data: greeks,
            timestamp: new Date().toISOString()
        });
    });

    console.log('✅ TrueData event handlers setup complete');
}

// Broadcast data to all connected clients
function broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    clients.forEach((clientData, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageStr);
                sentCount++;
            } catch (error) {
                console.error('❌ Error sending to client:', error);
                clients.delete(ws);
            }
        } else {
            clients.delete(ws);
        }
    });
    
    if (sentCount > 0) {
        console.log(`📤 Broadcasted ${message.type} to ${sentCount} clients`);
    }
}

// Initialize TrueData connection
async function initializeTrueData() {
    try {
        if (!TRUEDATA_USER || !TRUEDATA_PWD) {
            throw new Error('TrueData credentials not found in environment variables');
        }

        console.log('🔄 Initializing TrueData connection...');
        console.log(`👤 User: ${TRUEDATA_USER}`);
        console.log(`🌐 Port: ${TRUEDATA_PORT}`);

        // Setup event handlers first
        setupTrueDataHandlers();

        // Start with some default symbols
        const defaultSymbols = ['NIFTY-I', 'BANKNIFTY-I'];
        
        console.log('🔗 Connecting to TrueData with symbols:', defaultSymbols);
        
        // Connect to TrueData
        rtConnect(
            TRUEDATA_USER, 
            TRUEDATA_PWD, 
            defaultSymbols, 
            TRUEDATA_PORT,
            1, // bidask enabled
            1, // heartbeat enabled
            0, // replay disabled
            'push' // url
        );

        // Add default symbols to subscribed set
        defaultSymbols.forEach(symbol => subscribedSymbols.add(symbol));
        
        // Wait a bit for connection to establish
        setTimeout(() => {
            trueDataConnected = isSocketConnected();
            console.log(`✅ TrueData connection status: ${trueDataConnected}`);
        }, 2000);

    } catch (error) {
        console.error('❌ Failed to initialize TrueData:', error);
        trueDataConnected = false;
    }
}

// WebSocket connection handler
wss.on('connection', (ws, request) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔌 New client connected: ${clientId} from ${request.socket.remoteAddress}`);
    
    // Store client connection
    clients.set(ws, {
        id: clientId,
        connectedAt: new Date().toISOString(),
        subscribedSymbols: new Set()
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to TrueData WebSocket server',
        clientId: clientId,
        truedata_connected: trueDataConnected,
        available_symbols: Array.from(subscribedSymbols),
        timestamp: new Date().toISOString()
    }));

    // Handle incoming messages from client
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📨 Message from ${clientId}:`, data.type);

            switch (data.type) {
                case 'subscribe':
                    await handleSubscribe(ws, data);
                    break;
                
                case 'unsubscribe':
                    await handleUnsubscribe(ws, data);
                    break;
                
                case 'getMarketStatus':
                    handleGetMarketStatus(ws);
                    break;
                
                case 'getHistoricalData':
                    await handleGetHistoricalData(ws, data);
                    break;
                
                case 'ping':
                    handlePing(ws);
                    break;
                
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${data.type}`,
                        timestamp: new Date().toISOString()
                    }));
            }

        } catch (error) {
            console.error(`❌ Error handling message from ${clientId}:`, error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
        console.log(`🔌 Client ${clientId} disconnected: code ${code}, reason: ${reason}`);
        clients.delete(ws);
        console.log(`📊 Active connections: ${clients.size}`);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        clients.delete(ws);
    });

    // Send periodic heartbeat
    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        } else {
            clearInterval(heartbeatInterval);
        }
    }, 30000);
});

// Handle subscribe request
async function handleSubscribe(ws, data) {
    try {
        const { symbols } = data;
        
        if (!symbols || !Array.isArray(symbols)) {
            throw new Error('Invalid symbols array');
        }

        console.log(`🔔 Subscribe request for symbols:`, symbols);

        const clientData = clients.get(ws);
        const newSymbols = symbols.filter(symbol => !subscribedSymbols.has(symbol));
        
        if (newSymbols.length > 0) {
            // Subscribe to new symbols via TrueData
            rtSubscribe(newSymbols);
            newSymbols.forEach(symbol => subscribedSymbols.add(symbol));
            console.log(`✅ Subscribed to new symbols:`, newSymbols);
        }

        // Update client's subscribed symbols
        symbols.forEach(symbol => clientData.subscribedSymbols.add(symbol));

        ws.send(JSON.stringify({
            type: 'subscribeResponse',
            symbols: symbols,
            success: true,
            message: `Subscribed to ${symbols.length} symbols`,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ Error handling subscribe:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Subscribe failed: ${error.message}`,
            timestamp: new Date().toISOString()
        }));
    }
}

// Handle unsubscribe request
async function handleUnsubscribe(ws, data) {
    try {
        const { symbols } = data;
        
        if (!symbols || !Array.isArray(symbols)) {
            throw new Error('Invalid symbols array');
        }

        console.log(`🔕 Unsubscribe request for symbols:`, symbols);

        const clientData = clients.get(ws);
        
        // Remove from client's subscribed symbols
        symbols.forEach(symbol => clientData.subscribedSymbols.delete(symbol));

        // Check if any other clients are subscribed to these symbols
        const symbolsToUnsubscribe = symbols.filter(symbol => {
            let stillNeeded = false;
            clients.forEach(client => {
                if (client.subscribedSymbols.has(symbol)) {
                    stillNeeded = true;
                }
            });
            return !stillNeeded;
        });

        if (symbolsToUnsubscribe.length > 0) {
            // Unsubscribe from TrueData
            rtUnsubscribe(symbolsToUnsubscribe);
            symbolsToUnsubscribe.forEach(symbol => subscribedSymbols.delete(symbol));
            console.log(`✅ Unsubscribed from symbols:`, symbolsToUnsubscribe);
        }

        ws.send(JSON.stringify({
            type: 'unsubscribeResponse',
            symbols: symbols,
            success: true,
            message: `Unsubscribed from ${symbols.length} symbols`,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ Error handling unsubscribe:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Unsubscribe failed: ${error.message}`,
            timestamp: new Date().toISOString()
        }));
    }
}

// Handle market status request
function handleGetMarketStatus(ws) {
    try {
        const connected = isSocketConnected();
        
        ws.send(JSON.stringify({
            type: 'marketStatusResponse',
            data: {
                connected: connected,
                subscribed_symbols: Array.from(subscribedSymbols),
                total_connections: clients.size
            },
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ Error getting market status:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Market status failed: ${error.message}`,
            timestamp: new Date().toISOString()
        }));
    }
}

// Handle historical data request
async function handleGetHistoricalData(ws, data) {
    try {
        const { symbol, from, to, interval = '1min' } = data;
        
        if (!symbol || !from || !to) {
            throw new Error('Missing required parameters: symbol, from, to');
        }

        console.log(`📊 Historical data request: ${symbol} from ${from} to ${to}`);

        // Authenticate historical API
        historical.auth(TRUEDATA_USER, TRUEDATA_PWD);
        
        const historicalData = await historical.getBarData(symbol, from, to, interval);
        
        ws.send(JSON.stringify({
            type: 'historicalDataResponse',
            symbol,
            interval,
            from,
            to,
            data: historicalData,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ Error getting historical data:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Historical data failed: ${error.message}`,
            timestamp: new Date().toISOString()
        }));
    }
}

// Handle ping request
function handlePing(ws) {
    ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
    }));
}

// Handle server errors
wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📝 Received SIGTERM, shutting down gracefully...');
    
    // Disconnect from TrueData
    if (trueDataConnected) {
        rtDisconnect();
        console.log('✅ Disconnected from TrueData');
    }
    
    // Close all WebSocket connections
    clients.forEach((clientData, ws) => {
        ws.close();
    });
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📝 Received SIGINT, shutting down gracefully...');
    
    // Disconnect from TrueData
    if (trueDataConnected) {
        rtDisconnect();
        console.log('✅ Disconnected from TrueData');
    }
    
    // Close all WebSocket connections
    clients.forEach((clientData, ws) => {
        ws.close();
    });
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Start the server
const PORT = process.env.WS_PORT_TRUEDATA || 8081; // Different port to avoid conflict
server.listen(PORT, async () => {
    console.log('🚀 TrueData WebSocket server starting...');
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Market status: http://localhost:${PORT}/market/status`);
    
    // Initialize TrueData connection
    await initializeTrueData();
    
    console.log('✅ Server ready for connections');
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`💥 Port ${PORT} is already in use. Please try a different port.`);
        process.exit(1);
    }
});

console.log('🎯 TrueData WebSocket Server (server2.js) initialized'); 