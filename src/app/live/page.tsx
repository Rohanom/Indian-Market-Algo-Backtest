'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { LiveTrading } from '@/components/LiveTrading';
import { useRouter } from 'next/navigation';

interface WebSocketMessage {
    type: string;
    data?: any;
    status?: string;
    error?: string;
    message?: string;
}

export default function LiveTradingPage() {
    const router = useRouter();
    const [selectedStock, setSelectedStock] = useState('');
    const [instrumentToken, setInstrumentToken] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const [lastPrice, setLastPrice] = useState(0);
    const [liveData, setLiveData] = useState<any[]>([]);
    const [selectedTimeframe, setSelectedTimeframe] = useState<'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day'>('5minute');
    
    // WebSocket refs
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isConnectingRef = useRef(false);
    const currentInstrumentTokenRef = useRef('');
    
    // Connection management
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const maxReconnectAttempts = 5;
    const reconnectDelayMs = 3000;

    // Clean disconnect function
    const disconnectWebSocket = useCallback(() => {
        console.log('Disconnecting WebSocket...');
        
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                wsRef.current.close(1000, 'Component unmounting');
            }
            wsRef.current = null;
        }
        
        setIsConnected(false);
        setConnectionError('');
        setReconnectAttempts(0);
        isConnectingRef.current = false;
    }, []);

    // Stable reconnect function
    const handleReconnect = useCallback(() => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            setConnectionError('Max reconnection attempts reached. Please refresh the page.');
            return;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        console.log(`Scheduling reconnect in ${reconnectDelayMs}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
        }, reconnectDelayMs);
    }, [reconnectAttempts]);

    // Main WebSocket connection function
    const connectWebSocket = useCallback(() => {
        if (isConnectingRef.current) {
            console.log('Connection already in progress, skipping...');
            return;
        }

        if (!accessToken || !selectedStock) {
            console.log('Missing prerequisites for WebSocket connection:', {
                hasAccessToken: !!accessToken,
                hasSelectedStock: !!selectedStock
            });
            return;
        }

        if (!instrumentToken) {
            console.log('Instrument token not found for:', selectedStock);
            return;
        }

        if (wsRef.current) {
            console.log('Closing existing WebSocket connection');
            wsRef.current.close();
            wsRef.current = null;
        }

        isConnectingRef.current = true;
        currentInstrumentTokenRef.current = instrumentToken;
        
        console.log('Establishing WebSocket connection...', {
            selectedStock,
            instrumentToken
        });

        try {
            const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
            console.log('Connecting to WebSocket server at:', wsUrl);
            
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected successfully');
                isConnectingRef.current = false;
                setIsConnected(true);
                setReconnectAttempts(0);
                setConnectionError('');
                
                const initMessage = {
                    type: 'init',
                    apiKey: process.env.NEXT_PUBLIC_KITE_API_KEY,
                    accessToken,
                    instrumentToken
                };
                
                console.log('Sending init message:', initMessage);
                ws.send(JSON.stringify(initMessage));
            };

            ws.onerror = (error) => {
                console.error('WebSocket connection error:', error);
                isConnectingRef.current = false;
                setConnectionError('Failed to connect to WebSocket server');
                
                if (error instanceof Error) {
                    console.error('Error details:', {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    });
                }
                
                handleReconnect();
            };

            ws.onclose = (event) => {
                console.log('WebSocket connection closed:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                });
                
                isConnectingRef.current = false;
                setIsConnected(false);
                
                if (!event.wasClean && event.code !== 1000) {
                    setConnectionError(`Connection lost: ${event.reason || 'Unknown reason'}`);
                    handleReconnect();
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as WebSocketMessage;
                    
                    switch (message.type) {
                        case 'instrumentData':
                        case 'ticks':
                            if (message.data && Array.isArray(message.data)) {
                                const tick = message.data.find((t: any) => 
                                    t.instrument_token === Number(currentInstrumentTokenRef.current)
                                );
                                
                                if (tick && tick.last_price) {
                                    setLastPrice(tick.last_price);
                                    
                                    const newTick = {
                                        timestamp: new Date().toISOString(),
                                        last_price: tick.last_price,
                                        volume: tick.volume || 0
                                    };
                                    
                                    setLiveData(prev => [...prev, newTick].slice(-1000));
                                }
                            }
                            break;

                        case 'status':
                            if (message.status === 'connected') {
                                setIsConnected(true);
                                setConnectionError('');
                            } else if (message.status === 'disconnected') {
                                setIsConnected(false);
                                setConnectionError(message.error || 'Disconnected from server');
                            }
                            break;

                        case 'error':
                            setConnectionError(message.message || 'Server error');
                            break;
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            isConnectingRef.current = false;
            setConnectionError('Failed to create WebSocket connection');
        }
    }, [accessToken, selectedStock, instrumentToken, handleReconnect]);

    // Fetch access token and stock data on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch access token
                const tokenResponse = await fetch('/api/token');
                const tokenData = await tokenResponse.json();
                if (tokenData.accessToken) {
                    setAccessToken(tokenData.accessToken);
                }

                // Fetch stock data
                const stockResponse = await fetch('/api/instruments');
                const stockData = await stockResponse.json();
                if (stockData && stockData.length > 0) {
                    const niftyStock = stockData.find((stock: any) => stock.tradingsymbol === 'NIFTY 50');
                    if (niftyStock) {
                        setSelectedStock(niftyStock.tradingsymbol);
                        setInstrumentToken(niftyStock.instrument_token);
                    }
                }
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };

        fetchData();
    }, []);

    // Connect WebSocket when prerequisites are met
    useEffect(() => {
        if (accessToken && selectedStock && instrumentToken) {
            connectWebSocket();
        }

        return () => {
            disconnectWebSocket();
        };
    }, [accessToken, selectedStock, instrumentToken, connectWebSocket, disconnectWebSocket]);

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('Page became visible, reconnecting WebSocket...');
                connectWebSocket();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [connectWebSocket]);

    const handleTimeframeChange = (timeframe: 'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day') => {
        setSelectedTimeframe(timeframe);
    };

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="mb-4">
                <button
                    onClick={() => router.push('/')}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    ← Back to Home
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold mb-4">Live Trading</h1>
                
                {connectionError && (
                    <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        {connectionError}
                    </div>
                )}

                <LiveTrading
                    selectedStock={selectedStock}
                    instrumentToken={instrumentToken}
                    accessToken={accessToken}
                    liveData={liveData}
                    lastPrice={lastPrice}
                    isConnected={isConnected}
                    connectionError={connectionError}
                    selectedTimeframe={selectedTimeframe}
                    onTimeframeChange={handleTimeframeChange}
                    wsConnection={wsRef.current}
                />
            </div>
        </main>
    );
} 