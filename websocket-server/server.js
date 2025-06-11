const WebSocket = require('ws');
const { KiteTicker, KiteConnect } = require('kiteconnect');
const http = require('http');
const cors = require('cors');
const express = require('express');
const Redis = require('redis');
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

// Redis client for instrument storage
const redis = Redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
});

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.on('connect', () => console.log('Connected to Redis'));

// Initialize Redis connection
(async () => {
    try {
        await redis.connect();
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
})();

// Store active connections and their tickers
const connections = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        connections: connections.size,
        timestamp: new Date().toISOString()
    });
});

// Endpoint to check Redis instrument data
app.get('/instruments/status', async (req, res) => {
    try {
        const metadata = await redis.hGetAll('nifty:metadata');
        res.json({
            status: 'ok',
            instruments_available: Object.keys(metadata).length > 0,
            metadata: metadata,
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

// Endpoint to populate instruments using token from /api/token
app.post('/instruments/populate', async (req, res) => {
    try {
        console.log('🔄 Starting instrument population...');
        
        // Get the API base URL from environment or default
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
        const tokenUrl = `${API_BASE_URL}/api/token`;
        
        console.log(`🔍 Fetching access token from: ${tokenUrl}`);
        
        // Fetch access token from your existing endpoint
        const tokenResponse = await fetch(tokenUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!tokenResponse.ok) {
            throw new Error(`Failed to fetch access token: ${tokenResponse.status} ${tokenResponse.statusText}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log('📄 Token response:', Object.keys(tokenData));
        
        const accessToken = tokenData.accessToken || tokenData.access_token;
        
        if (!accessToken) {
            throw new Error(`No access token found in response. Available keys: ${Object.keys(tokenData).join(', ')}`);
        }
        
        console.log('✅ Got access token, populating instruments...');
        
        // Use the InstrumentPopulator class
        const InstrumentPopulator = require('./scripts/populate-instruments');
        const populator = new InstrumentPopulator();
        
        await populator.connect();
        await populator.populateNiftyInstruments(accessToken);
        
        // Get summary of what was stored
        const stored = await populator.getStoredInstruments();
        await populator.disconnect();
        
        console.log('🎉 Instrument population completed!');
        
        res.json({
            status: 'success',
            message: 'Instruments populated successfully',
            data: {
                main_instrument: stored.main.tradingsymbol,
                current_expiry: stored.currentExpiry.expiry,
                next_expiry: stored.nextExpiry.expiry,
                total_strikes_current: Object.keys(stored.currentExpiry.data).length,
                total_strikes_next: Object.keys(stored.nextExpiry.data).length,
                last_updated: stored.metadata.last_updated
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error populating instruments:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Alternative endpoint that accepts token directly
app.post('/instruments/populate-direct', async (req, res) => {
    try {
        console.log('🔄 Starting direct instrument population...');
        
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Access token is required in request body',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('✅ Got access token directly, populating instruments...');
        
        // Use the InstrumentPopulator class
        const InstrumentPopulator = require('./scripts/populate-instruments');
        const populator = new InstrumentPopulator();
        
        await populator.connect();
        await populator.populateNiftyInstruments(accessToken);
        
        // Get summary of what was stored
        const stored = await populator.getStoredInstruments();
        await populator.disconnect();
        
        console.log('🎉 Instrument population completed!');
        
        res.json({
            status: 'success',
            message: 'Instruments populated successfully',
            data: {
                main_instrument: stored.main.tradingsymbol,
                current_expiry: stored.currentExpiry.expiry,
                next_expiry: stored.nextExpiry.expiry,
                total_strikes_current: Object.keys(stored.currentExpiry.data).length,
                total_strikes_next: Object.keys(stored.nextExpiry.data).length,
                last_updated: stored.metadata.last_updated
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error populating instruments:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

wss.on('connection', (ws, request) => {
    console.log('New client connected from:', request.socket.remoteAddress);
    
    let ticker = null;
    let kite = null;
    let isTickerConnected = false;
    let isSubscribed = false;
    let heartbeatInterval = null;
    let pendingOptionsRequest = null;

    // Send heartbeat every 30 seconds to keep connection alive
    heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data.type);

            if (data.type === 'init') {
                const { apiKey, accessToken } = data;
                const connectionTimestamp = new Date().toISOString();

                // Validation
                if (!apiKey || !accessToken) {
                    throw new Error('Missing required parameters: apiKey or accessToken');
                }

                // Get main instrument token from Redis
                const mainData = await redis.hGetAll('nifty:main');
                if (!mainData.instrument_token) {
                    throw new Error('NIFTY main instrument not found in Redis. Please run populate-instruments.js first.');
                }
                const mainInstrumentToken = mainData.instrument_token;

                if (ticker) {
                    console.log('Disconnecting existing ticker');
                    ticker.disconnect();
                    isTickerConnected = false;
                    isSubscribed = false;
                }

                // Initialize KiteTicker
                ticker = new KiteTicker({
                    api_key: apiKey,
                    access_token: accessToken,
                    debug: true  // Enable debug mode
                });

                // Initialize KiteConnect
                kite = new KiteConnect({
                    api_key: apiKey,
                    access_token: accessToken
                });

                // Store the connection
                connections.set(ws, { ticker, kite, instrumentToken: mainInstrumentToken });

                // Set up ticker event handlers
                ticker.on('ticks', (ticks) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            // Create a map of all instrument data
                            const instrumentData = new Map();
                            
                            // Process all ticks and store in map
                            ticks.forEach(tick => {
                                instrumentData.set(tick.instrument_token, {
                                    instrument_token: tick.instrument_token,
                                    last_price: tick.last_price,
                                    volume: tick.volume,
                                    oi: tick.open_interest,
                                    bid: tick.depth?.buy?.[0]?.price,
                                    ask: tick.depth?.sell?.[0]?.price,
                                    ohlc: tick.ohlc,
                                    last_trade_time: tick.last_trade_time
                                });
                            });
                            
                            // Send all instrument data as a single batch
                            ws.send(JSON.stringify({
                                type: 'instrumentData',
                                data: Array.from(instrumentData.values()),
                                timestamp: new Date().toISOString()
                            }));
                            
                        } catch (error) {
                            console.error('❌ Error sending instrument data:', error);
                        }
                    }
                });

                ticker.on('connect', () => {
                    console.log('KiteTicker connected successfully');
                    isTickerConnected = true;
                    
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'status', 
                            status: 'connected',
                            timestamp: new Date().toISOString()
                        }));
                    }
                    
                    // Subscribe to main instrument after connection is established
                    try {
                        const tokens = [Number(mainInstrumentToken)];
                        console.log('Subscribing to main instrument:', tokens);
                        ticker.subscribe(tokens);
                        ticker.setMode(ticker.modeFull, tokens);
                        isSubscribed = true;
                        
                        // Send init_success only after ticker is connected and subscribed
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'init_success',
                                message: 'Initialization and connection successful',
                                timestamp: connectionTimestamp,
                                connectionTimestamp: connectionTimestamp
                            }));
                        }
                        
                        // Process any pending options request
                        if (pendingOptionsRequest) {
                            handleGetOptions(ws, pendingOptionsRequest);
                            pendingOptionsRequest = null;
                        }
                        
                    } catch (subscribeError) {
                        console.error('Error subscribing to main instrument:', subscribeError);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Main subscription failed: ${subscribeError.message}`
                            }));
                        }
                    }
                });

                ticker.on('disconnect', (error) => {
                    console.log('KiteTicker disconnected:', error);
                    isTickerConnected = false;
                    isSubscribed = false;
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'status',
                            status: 'disconnected',
                            error: error ? error.message : 'Unknown error',
                            timestamp: new Date().toISOString()
                        }));
                    }
                });

                ticker.on('error', (error) => {
                    console.error('KiteTicker error:', error);
                    isTickerConnected = false;
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Ticker error: ${error.message}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });

                ticker.on('reconnect', (reconnect_count, reconnect_interval) => {
                    console.log(`Reconnecting: attempt ${reconnect_count}, interval ${reconnect_interval}`);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'status',
                            status: 'reconnecting',
                            attempt: reconnect_count,
                            interval: reconnect_interval,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });

                ticker.on('noreconnect', () => {
                    console.log('No more reconnection attempts');
                    isTickerConnected = false;
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'status',
                            status: 'no_reconnect',
                            message: 'Maximum reconnection attempts reached',
                            timestamp: new Date().toISOString()
                        }));
                    }
                });

                // Enable auto-reconnect with shorter intervals
                ticker.autoReconnect(true, 5, 2);

                // Add connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (!isTickerConnected) {
                        console.error('KiteTicker connection timeout');
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'KiteTicker connection timeout',
                                timestamp: new Date().toISOString()
                            }));
                        }
                        // Try to reconnect
                        if (ticker) {
                            ticker.disconnect();
                            setTimeout(() => {
                                console.log('Attempting to reconnect KiteTicker...');
                                ticker.connect();
                            }, 1000);
                        }
                    }
                }, 10000); // 10 second timeout

                // Connect to KiteTicker
                console.log('Connecting to KiteTicker...');
                ticker.connect();

                // Clear timeout on successful connection
                ticker.on('connect', () => {
                    clearTimeout(connectionTimeout);
                });

            } else if (data.type === 'placeOrder') {
                if (!kite) {
                    throw new Error('KiteConnect not initialized');
                }

                const { symbol, transactionType, quantity, product = 'CNC', orderType = 'MARKET', exchange = 'NSE' } = data;

                // Validation
                if (!symbol || !transactionType || !quantity) {
                    throw new Error('Missing required order parameters');
                }

                if (!['BUY', 'SELL'].includes(transactionType)) {
                    throw new Error('Invalid transaction type. Must be BUY or SELL');
                }

                if (quantity <= 0) {
                    throw new Error('Quantity must be greater than 0');
                }

                console.log('Placing order:', { symbol, transactionType, quantity, product, orderType });

                const orderParams = {
                    exchange: exchange,
                    tradingsymbol: symbol,
                    transaction_type: transactionType,
                    quantity: quantity,
                    product: product,
                    order_type: orderType
                };

                const order = await kite.placeOrder('regular', orderParams);

                console.log('Order placed successfully:', order);

                ws.send(JSON.stringify({
                    type: 'orderResponse',
                    data: order,
                    timestamp: new Date().toISOString()
                }));

            } else if (data.type === 'getPositions') {
                if (!kite) {
                    throw new Error('KiteConnect not initialized');
                }

                const positions = await kite.getPositions();
                ws.send(JSON.stringify({
                    type: 'positionsResponse',
                    data: positions,
                    timestamp: new Date().toISOString()
                }));

            } else if (data.type === 'getOrders') {
                if (!kite) {
                    throw new Error('KiteConnect not initialized');
                }

                const orders = await kite.getOrders();
                ws.send(JSON.stringify({
                    type: 'ordersResponse',
                    data: orders,
                    timestamp: new Date().toISOString()
                }));

            } else if (data.type === 'getOptions') {
                // Store request if ticker is not ready yet
                if (!isTickerConnected || !isSubscribed) {
                    console.log('Ticker not ready, storing options request for later');
                    pendingOptionsRequest = data;
                    return;
                }
                
                handleGetOptions(ws, data);

            } else if (data.type === 'subscribe') {
                if (!ticker || !isTickerConnected) {
                    console.error('❌ Ticker not connected');
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Ticker not connected'
                    }));
                    return;
                }

                console.log('🔔 Received subscription request for', data.instrumentTokens?.length || 0, 'tokens');
                console.log('📋 Tokens to subscribe:', data.instrumentTokens?.slice(0, 5), '... (first 5)');
                
                if (data.instrumentTokens && data.instrumentTokens.length > 0) {
                    try {
                        const tokens = data.instrumentTokens.map(token => Number(token));
                        
                        // Subscribe to the instrument tokens
                        ticker.subscribe(tokens);
                        ticker.setMode(ticker.modeFull, tokens);
                        
                        // Send confirmation
                        ws.send(JSON.stringify({
                            type: 'subscribeResponse',
                            tokens: tokens,
                            success: true
                        }));
                        
                        console.log('✅ Subscribed to', tokens.length, 'instruments');
                    } catch (error) {
                        console.error('❌ Error subscribing:', error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to subscribe to instruments'
                        }));
                    }
                }

            } else if (data.type === 'unsubscribe') {
                if (!ticker) {
                    throw new Error('Ticker not initialized');
                }

                const { instrumentTokens } = data;
                if (!instrumentTokens || !Array.isArray(instrumentTokens)) {
                    throw new Error('Invalid instrument tokens');
                }

                const tokens = instrumentTokens.map(token => Number(token));
                ticker.unsubscribe(tokens);

                ws.send(JSON.stringify({
                    type: 'unsubscribeResponse',
                    message: `Unsubscribed from ${tokens.length} instruments`,
                    tokens: tokens,
                    timestamp: new Date().toISOString()
                }));

            } else if (data.type === 'ping') {
                // Handle client ping
                ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: new Date().toISOString()
                }));

            } else {
                throw new Error(`Unknown message type: ${data.type}`);
            }

        } catch (error) {
            console.error('Error handling message:', error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                }));
            }
        }
    });

    // Handle options data request
    const handleGetOptions = async (ws, data) => {
        try {
            console.log('🔍 Starting options data request...');
            
            // Get all required data in one pipeline
            const pipeline = redis.pipeline();
            pipeline.hGetAll('nifty:metadata');
            pipeline.hGetAll('nifty:options:current_expiry');
            const results = await pipeline.exec();
            
            const [metadataResult, optionsResult] = results;
            if (!metadataResult[1] || !optionsResult[1]) {
                throw new Error('Required data not found in Redis');
            }

            console.log('📊 Retrieved data from Redis');

            const metadata = metadataResult[1];
            const optionsData = optionsResult[1];
            
            const currentPrice = parseFloat(metadata.current_price);
            const atmStrike = parseInt(metadata.atm_strike);
            const expiry = optionsData.expiry;
            const options = JSON.parse(optionsData.data);
            
            console.log('🎯 Current market data:', {
                currentPrice,
                atmStrike,
                expiry,
                totalOptions: Object.keys(options).length
            });
            
            // Filter options around ATM strike (±5 strikes)
            const filteredOptions = Object.entries(options)
                .filter(([strike]) => Math.abs(parseInt(strike) - atmStrike) <= 5)
                .map(([strike, data]) => ({
                    strike: parseInt(strike),
                    call: data.CE ? {
                        instrumentToken: data.CE.token,
                        ltp: 0,
                        volume: 0,
                        oi: 0,
                        bid: 0,
                        ask: 0,
                        change: 0,
                        changePercent: 0,
                        ohlc: { open: 0, high: 0, low: 0, close: 0 },
                        lastTradeTime: new Date().toISOString()
                    } : null,
                    put: data.PE ? {
                        instrumentToken: data.PE.token,
                        ltp: 0,
                        volume: 0,
                        oi: 0,
                        bid: 0,
                        ask: 0,
                        change: 0,
                        changePercent: 0,
                        ohlc: { open: 0, high: 0, low: 0, close: 0 },
                        lastTradeTime: new Date().toISOString()
                    } : null
                }));

            console.log('📈 Filtered options:', {
                totalStrikes: filteredOptions.length,
                strikes: filteredOptions.map(opt => opt.strike)
            });

            // Send options response
            ws.send(JSON.stringify({
                type: 'optionsResponse',
                data: {
                    underlying: 'NIFTY',
                    expiry,
                    optionChain: filteredOptions,
                    currentPrice,
                    atmStrike,
                    timestamp: new Date().toISOString()
                }
            }));

            // Subscribe to all option instruments
            const instrumentTokens = filteredOptions.reduce((tokens, strike) => {
                if (strike.call) tokens.push(strike.call.instrumentToken);
                if (strike.put) tokens.push(strike.put.instrumentToken);
                return tokens;
            }, []);

            console.log('🔔 Subscribing to', instrumentTokens.length, 'instruments');

            if (instrumentTokens.length > 0) {
                ticker.subscribe(instrumentTokens);
                ws.send(JSON.stringify({
                    type: 'subscribeResponse',
                    tokens: instrumentTokens
                }));
                console.log('✅ Subscription request sent');
            }

        } catch (error) {
            console.error('❌ Error fetching options data:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Error fetching options data'
            }));
        }
    };

    ws.on('close', (code, reason) => {
        console.log(`Client disconnected: code ${code}, reason: ${reason}`);
        
        // Clean up heartbeat
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }

        // Clean up ticker
        if (ticker) {
            console.log('Disconnecting ticker...');
            try {
                ticker.disconnect();
            } catch (error) {
                console.error('Error disconnecting ticker:', error);
            }
        }

        // Remove from connections
        connections.delete(ws);
        console.log(`Active connections: ${connections.size}`);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        
        // Clean up on error
        if (ticker) {
            try {
                ticker.disconnect();
            } catch (disconnectError) {
                console.error('Error disconnecting ticker on WebSocket error:', disconnectError);
            }
        }
        
        connections.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to WebSocket server',
        timestamp: new Date().toISOString()
    }));
});

// Handle server errors
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    
    // Close all connections
    for (const [ws, { ticker }] of connections) {
        if (ticker) {
            ticker.disconnect();
        }
        ws.close();
    }
    
    redis.disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    
    // Close all connections
    for (const [ws, { ticker }] of connections) {
        if (ticker) {
            ticker.disconnect();
        }
        ws.close();
    }
    
    redis.disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Start the server
const PORT = process.env.WS_PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSocket server is running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log(`Instruments status at http://localhost:${PORT}/instruments/status`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port.`);
        process.exit(1);
    }
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});