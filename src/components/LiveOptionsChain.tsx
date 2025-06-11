import { useState, useRef, useEffect, useCallback } from 'react';

interface OptionData {
    instrumentToken: number;
    tradingSymbol: string;
    ltp: number;
    volume: number;
    oi: number;
    bid: number;
    ask: number;
    change: number;
    changePercent: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    lastTradeTime: string | null;
}

interface StrikeData {
    strike: number;
    expiry: string;
    call: OptionData | null;
    put: OptionData | null;
}

interface OptionChainData {
    underlying: string;
    expiry: string;
    timestamp: string;
    strikes: number[];
    optionChain: StrikeData[];
    atmStrike?: number;
}

interface InstrumentData {
    instrument_token: number;
    last_price: number;
    volume: number;
    oi?: number;
    bid?: number;
    ask?: number;
    ohlc?: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    last_trade_time?: string;
}

interface LiveOptionsChainProps {
    selectedStock: string;
    wsConnection?: WebSocket | null;
    accessToken?: string;
    isConnected?: boolean;
    lastPrice?: number;
}

export const LiveOptionsChain: React.FC<LiveOptionsChainProps> = ({ 
    selectedStock, 
    wsConnection = null,
    accessToken = null,
    isConnected = false,
    lastPrice
}) => {
    const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [optionsError, setOptionsError] = useState<string | null>(null);
    const [subscribedTokens, setSubscribedTokens] = useState<number[]>([]);
    const [localIsConnected, setLocalIsConnected] = useState(false);
    const [liveUpdateCount, setLiveUpdateCount] = useState(0);
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'ready'>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Create connection to Python options server
    const connectToOptionsServer = useCallback(async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('🔗 Already connected to options server');
            return;
        }

        console.log('🔌 Connecting to Python options server...');
        setConnectionState('connecting');
        setOptionsError('Connecting to options server...');

        try {
            const ws = new WebSocket('ws://localhost:8081');
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('✅ Connected to options server');
                setConnectionState('connected');
                setLocalIsConnected(true);
                setOptionsError('Connected, initializing...');
                // Immediately send init message
                initializeOptionsConnection();
            };

            ws.onmessage = (event) => {
                handleOptionsMessage(event);
            };

            ws.onclose = () => {
                console.log('🔌 Disconnected from options server');
                setConnectionState('disconnected');
                setLocalIsConnected(false);
                setOptionsError('Disconnected from options server');
                
                // Retry connection after 5 seconds
                retryTimeoutRef.current = setTimeout(() => {
                    connectToOptionsServer();
                }, 5000);
            };

            ws.onerror = (error) => {
                console.error('❌ Options server connection error:', error);
                setConnectionState('disconnected');
                setLocalIsConnected(false);
                setOptionsError('Connection error');
            };

        } catch (error) {
            console.error('❌ Failed to connect to options server:', error);
            setConnectionState('disconnected');
            setOptionsError('Failed to connect to options server');
        }
    }, []);

    // Initialize connection (Python server now uses its own credentials)
    const initializeOptionsConnection = useCallback(() => {
        try {
            console.log('🔐 Sending init message to options server...');
            const initMessage = {
                type: 'init'
                // No credentials needed - Python server uses environment variables
            };

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(initMessage));
                setOptionsError('Initializing options stream...');
                setIsLoadingOptions(true);
            } else {
                console.log('❌ WebSocket not ready yet');
            }

        } catch (error) {
            console.error('❌ Failed to initialize options connection:', error);
            setOptionsError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    // Handle messages from options server
    const handleOptionsMessage = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Options server message:', data.type);

            switch (data.type) {
                case 'options_chain':
                    console.log('📋 Received initial options chain');
                    setConnectionState('ready');
                    setOptionsError(null);
                    setIsLoadingOptions(false);
                    handleOptionsData(data);
                    break;

                case 'option_update':
                    console.log('📊 Received real-time option update');
                    handleRealTimeUpdate(data.data);
                    break;

                case 'error':
                    console.error('❌ Options server error:', data.message);
                    setOptionsError(data.message);
                    setIsLoadingOptions(false);
                    break;

                default:
                    console.log('❓ Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ Error parsing options server message:', error);
        }
    };

    // Handle options data from server
    const handleOptionsData = (data: any) => {
        try {
            if (data.data && Array.isArray(data.data)) {
                // Convert the Python data format to our format
                const strikes: StrikeData[] = data.data.map((item: any, index: number) => ({
                    strike: item.strike || 0,
                    expiry: item.call?.expiry || item.put?.expiry || '',
                    call: item.call ? {
                        instrumentToken: item.call.token || 0,
                        tradingSymbol: item.call.symbol || '',
                        ltp: item.call.last_price || 0,
                        volume: item.call.volume || 0,
                        oi: item.call.oi || 0,
                        bid: item.call.buy_price || 0,
                        ask: item.call.sell_price || 0,
                        change: item.call.change || 0,
                        changePercent: 0,
                        ohlc: { open: 0, high: 0, low: 0, close: 0 },
                        lastTradeTime: item.call.timestamp || null
                    } : null,
                    put: item.put ? {
                        instrumentToken: item.put.token || 0,
                        tradingSymbol: item.put.symbol || '',
                        ltp: item.put.last_price || 0,
                        volume: item.put.volume || 0,
                        oi: item.put.oi || 0,
                        bid: item.put.buy_price || 0,
                        ask: item.put.sell_price || 0,
                        change: item.put.change || 0,
                        changePercent: 0,
                        ohlc: { open: 0, high: 0, low: 0, close: 0 },
                        lastTradeTime: item.put.timestamp || null
                    } : null
                }));

                // Filter out any invalid strikes and ensure unique keys
                const validStrikes = strikes.filter(strike => strike.strike > 0);

                const optionChain: OptionChainData = {
                    underlying: selectedStock === 'NIFTY 50' ? 'NIFTY' : 'BANKNIFTY',
                    expiry: validStrikes[0]?.expiry || '',
                    timestamp: data.timestamp || new Date().toISOString(),
                    strikes: validStrikes.map(s => s.strike),
                    optionChain: validStrikes,
                    atmStrike: lastPrice ? Math.round(lastPrice / 50) * 50 : undefined
                };

                setOptionChainData(optionChain);
                setLiveUpdateCount(prev => prev + 1);
                setIsLoadingOptions(false);
                setOptionsError(null);
            }
        } catch (error) {
            console.error('❌ Error processing options data:', error);
            setOptionsError('Error processing options data');
        }
    };

    // Handle real-time updates
    const handleRealTimeUpdate = (updateData: any) => {
        try {
            setOptionChainData(prevData => {
                if (!prevData) return prevData;

                const updatedOptions = prevData.optionChain.map(strike => {
                    if (strike.strike === updateData.strike) {
                        const updatedStrike = { ...strike };
                        
                        if (updateData.instrument_type === 'CE' && updatedStrike.call) {
                            updatedStrike.call = {
                                ...updatedStrike.call,
                                ltp: updateData.last_price,
                                change: updateData.change,
                                volume: updateData.volume,
                                oi: updateData.oi,
                                bid: updateData.buy_price || updatedStrike.call.bid,
                                ask: updateData.sell_price || updatedStrike.call.ask,
                                lastTradeTime: updateData.timestamp
                            };
                        } else if (updateData.instrument_type === 'PE' && updatedStrike.put) {
                            updatedStrike.put = {
                                ...updatedStrike.put,
                                ltp: updateData.last_price,
                                change: updateData.change,
                                volume: updateData.volume,
                                oi: updateData.oi,
                                bid: updateData.buy_price || updatedStrike.put.bid,
                                ask: updateData.sell_price || updatedStrike.put.ask,
                                lastTradeTime: updateData.timestamp
                            };
                        }
                        return updatedStrike;
                    }
                    return strike;
                });

                return {
                    ...prevData,
                    optionChain: updatedOptions,
                    timestamp: new Date().toISOString()
                };
            });

            setLiveUpdateCount(prev => prev + 1);
        } catch (error) {
            console.error('❌ Error processing real-time update:', error);
        }
    };

    // Request options data
    const requestOptionsData = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && connectionState === 'ready') {
            console.log('📤 Requesting options data...');
            const message = {
                type: 'getOptions',
                underlying: selectedStock === 'NIFTY 50' ? 'NIFTY' : 'BANKNIFTY',
                currentPrice: lastPrice || undefined
            };
            wsRef.current.send(JSON.stringify(message));
            setIsLoadingOptions(true);
        }
    }, [selectedStock, lastPrice, connectionState]);

    // Connect to options server automatically when component mounts
    useEffect(() => {
        if (connectionState === 'disconnected') {
            connectToOptionsServer();
        }
    }, [connectionState, connectToOptionsServer]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const getConnectionStatus = () => {
        switch (connectionState) {
            case 'disconnected':
                return { text: 'Disconnected', color: 'text-red-500' };
            case 'connecting':
                return { text: 'Connecting...', color: 'text-yellow-500' };
            case 'connected':
                return { text: 'Connected (Initializing)', color: 'text-blue-500' };
            case 'ready':
                return { text: `Live (${subscribedTokens.length} instruments)`, color: 'text-green-500' };
            default:
                return { text: 'Unknown', color: 'text-gray-500' };
        }
    };

    return (
        <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Options Chain</h3>
                <div className="flex items-center gap-4">
                    {isLoadingOptions && <span className="text-sm text-gray-500">Loading...</span>}
                    {optionsError && <span className="text-sm text-red-500">{optionsError}</span>}
                    <div className="flex items-center gap-2">
                        <span className={`text-sm ${getConnectionStatus().color}`}>
                            {getConnectionStatus().text}
                        </span>
                        {connectionState === 'ready' && (
                            <span className="text-xs text-blue-500">
                                Updates: {liveUpdateCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            {optionChainData && (
                <div className="overflow-x-auto">
                    <div className="text-sm text-gray-600 mb-2">
                        {optionChainData.underlying} | Expiry: {optionChainData.expiry} | 
                        Last Updated: {new Date(optionChainData.timestamp).toLocaleTimeString()}
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Call Options
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Strike
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Put Options
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {optionChainData.optionChain.map((strike) => (
                                <tr key={strike.strike} className={`hover:bg-gray-50 ${strike.strike === optionChainData.atmStrike ? 'bg-blue-50' : ''}`}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {strike.call ? (
                                            <div className="text-left">
                                                <div className="font-medium text-blue-600">
                                                    {strike.call.ltp.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    <span className={strike.call.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {strike.call.changePercent.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    OI: {strike.call.oi.toLocaleString()} | Vol: {strike.call.volume.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {strike.call.bid.toFixed(2)}/{strike.call.ask.toFixed(2)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-400">-</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-center">
                                        <div className="text-sm font-bold text-gray-900">
                                            {strike.strike}
                                            {strike.strike === optionChainData.atmStrike && (
                                                <span className="ml-1 text-xs text-blue-600">(ATM)</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {strike.put ? (
                                            <div className="text-right">
                                                <div className="font-medium text-red-600">
                                                    {strike.put.ltp.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    <span className={strike.put.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {strike.put.changePercent.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    OI: {strike.put.oi.toLocaleString()} | Vol: {strike.put.volume.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {strike.put.bid.toFixed(2)}/{strike.put.ask.toFixed(2)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-400">-</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};