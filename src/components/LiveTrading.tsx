import { useState, useCallback, useRef, useEffect } from 'react';
import { AdvancedChart } from './AdvancedChart';
import { fetchHistoricalData } from '../utils/kiteApi';
import { LiveOptionsChain } from './LiveOptionsChain';

interface LiveTradingProps {
    selectedStock: string;
    instrumentToken: string;
    accessToken: string;
    liveData: any[];
    lastPrice: number;
    isConnected: boolean;
    connectionError: string;
    selectedTimeframe: 'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day';
    onTimeframeChange: (timeframe: 'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day') => void;
    wsConnection?: WebSocket | null;
}

interface Trade {
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: string;
}

interface TickData {
    timestamp: string | Date;
    last_price: number;
    volume?: number;
    high?: number;
    low?: number;
    open?: number;
}

interface CandleData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export const LiveTrading = ({ 
    selectedStock, 
    instrumentToken, 
    accessToken,
    liveData,
    lastPrice,
    isConnected,
    connectionError,
    selectedTimeframe,
    onTimeframeChange,
    wsConnection
}: LiveTradingProps) => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [position, setPosition] = useState<{quantity: number, avgPrice: number} | null>(null);
    const [pnl, setPnl] = useState<{realized: number, unrealized: number}>({realized: 0, unrealized: 0});
    const [orderQuantity, setOrderQuantity] = useState<number>(1);
    const [aggregatedData, setAggregatedData] = useState<CandleData[]>([]);
    const [visibleData, setVisibleData] = useState<CandleData[]>([]);
    const [mergedData, setMergedData] = useState<CandleData[]>([]);
    const [connectionTimestamp, setConnectionTimestamp] = useState<string>('');
    const [historicalData, setHistoricalData] = useState<CandleData[]>([]);
    const [isHistoricalDataInitialized, setIsHistoricalDataInitialized] = useState(false);
    const rawDataRef = useRef<TickData[]>([]);
    const candleMapRef = useRef<Map<string, CandleData>>(new Map());
    const lastProcessedTickRef = useRef<string>('');
    const isInitializingRef = useRef(false);
    const wsRef = useRef<WebSocket | null>(null);

    // Add a ref to track if historical data fetch is in progress
    const isHistoricalDataFetchingRef = useRef(false);
    const hasInitialHistoricalDataRef = useRef(false);

    // Get timeframe duration in milliseconds
    const getTimeframeDuration = useCallback((timeframe: string): number => {
        switch (timeframe) {
            case 'minute': return 60 * 1000;
            case '5minute': return 5 * 60 * 1000;
            case '15minute': return 15 * 60 * 1000;
            case '30minute': return 30 * 60 * 1000;
            case '60minute': return 60 * 60 * 1000;
            case 'day': return 24 * 60 * 60 * 1000;
            default: return 60 * 1000;
        }
    }, []);

    // Get candle key for grouping
    const getCandleKey = useCallback((timestamp: Date, timeframe: string): string => {
        const year = timestamp.getFullYear();
        const month = timestamp.getMonth();
        const date = timestamp.getDate();
        const hours = timestamp.getHours();
        const minutes = timestamp.getMinutes();

        switch (timeframe) {
            case 'minute':
                return `${year}-${month}-${date}-${hours}-${minutes}`;
            case '5minute':
                return `${year}-${month}-${date}-${hours}-${Math.floor(minutes / 5) * 5}`;
            case '15minute':
                return `${year}-${month}-${date}-${hours}-${Math.floor(minutes / 15) * 15}`;
            case '30minute':
                return `${year}-${month}-${date}-${hours}-${Math.floor(minutes / 30) * 30}`;
            case '60minute':
                return `${year}-${month}-${date}-${hours}`;
            case 'day':
                return `${year}-${month}-${date}`;
            default:
                return `${year}-${month}-${date}-${hours}-${minutes}`;
        }
    }, []);

    // Get normalized candle timestamp
    const getNormalizedCandleTime = useCallback((timestamp: Date, timeframe: string): Date => {
        const year = timestamp.getFullYear();
        const month = timestamp.getMonth();
        const date = timestamp.getDate();
        const hours = timestamp.getHours();
        const minutes = timestamp.getMinutes();

        switch (timeframe) {
            case 'minute':
                return new Date(year, month, date, hours, minutes, 0, 0);
            case '5minute':
                return new Date(year, month, date, hours, Math.floor(minutes / 5) * 5, 0, 0);
            case '15minute':
                return new Date(year, month, date, hours, Math.floor(minutes / 15) * 15, 0, 0);
            case '30minute':
                return new Date(year, month, date, hours, Math.floor(minutes / 30) * 30, 0, 0);
            case '60minute':
                return new Date(year, month, date, hours, 0, 0, 0);
            case 'day':
                return new Date(year, month, date, 0, 0, 0, 0);
            default:
                return new Date(year, month, date, hours, minutes, 0, 0);
        }
    }, []);

    // Process single tick data
    const processTick = useCallback((tick: TickData, timeframe: string): CandleData | null => {
        if (!tick.timestamp || typeof tick.last_price !== 'number' || isNaN(tick.last_price)) {
            console.warn('❌ Invalid tick data:', tick);
            return null;
        }

        const timestamp = new Date(tick.timestamp);
        if (isNaN(timestamp.getTime())) {
            console.warn('❌ Invalid timestamp:', tick.timestamp);
            return null;
        }

        const candleKey = getCandleKey(timestamp, timeframe);
        const normalizedTime = getNormalizedCandleTime(timestamp, timeframe);
        const existingCandle = candleMapRef.current.get(candleKey);

        const price = tick.last_price;
        const volume = tick.volume || 0;

        let candle: CandleData;

        if (existingCandle) {
            // Update existing candle
            candle = {
                date: normalizedTime.toISOString(),
                open: existingCandle.open,
                high: Math.max(existingCandle.high, price),
                low: Math.min(existingCandle.low, price),
                close: price,
                volume: existingCandle.volume + volume
            };
        } else {
            // Create new candle
            candle = {
                date: normalizedTime.toISOString(),
                open: price,
                high: price,
                low: price,
                close: price,
                volume: volume
            };
        }

        candleMapRef.current.set(candleKey, candle);
        return candle;
    }, [getCandleKey, getNormalizedCandleTime]);

    // Aggregate all data for timeframe - SEPARATE from live data processing
    const aggregateData = useCallback((data: TickData[], timeframe: string): CandleData[] => {
        if (!data || data.length === 0) return [];

        console.log('🔄 aggregateData called - creating separate candle map for historical data');
        
        // Create a SEPARATE candle map for historical aggregation
        // DO NOT touch the live candleMapRef.current!
        const historicalCandleMap = new Map<string, CandleData>();

        // Process all ticks into the separate map
        data.forEach(tick => {
            if (!tick.timestamp || typeof tick.last_price !== 'number' || isNaN(tick.last_price)) {
                return;
            }

            const timestamp = new Date(tick.timestamp);
            if (isNaN(timestamp.getTime())) {
                return;
            }

            const candleKey = getCandleKey(timestamp, timeframe);
            const normalizedTime = getNormalizedCandleTime(timestamp, timeframe);
            const existingCandle = historicalCandleMap.get(candleKey);

            const price = tick.last_price;
            const volume = tick.volume || 0;

            let candle: CandleData;

            if (existingCandle) {
                // Update existing candle
                candle = {
                    date: normalizedTime.toISOString(),
                    open: existingCandle.open,
                    high: Math.max(existingCandle.high, price),
                    low: Math.min(existingCandle.low, price),
                    close: price,
                    volume: existingCandle.volume + volume
                };
            } else {
                // Create new candle
                candle = {
                    date: normalizedTime.toISOString(),
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: volume
                };
            }

            historicalCandleMap.set(candleKey, candle);
        });

        // Convert separate map to array and sort by date
        const candles = Array.from(historicalCandleMap.values())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        console.log('✅ aggregateData completed - live candleMapRef preserved, historical candles:', candles.length);
        return candles;
    }, [getCandleKey, getNormalizedCandleTime]);

    // Process new live data incrementally
    const processNewLiveData = useCallback((newData: TickData[], timeframe: string) => {
        if (!newData || newData.length === 0) return;

        let hasUpdates = false;
        const updatedCandles = new Set<string>();

        newData.forEach(tick => {
            // Skip if we've already processed this tick
            const tickTimestamp = typeof tick.timestamp === 'string' ? tick.timestamp : new Date(tick.timestamp).toISOString();
            if (lastProcessedTickRef.current === tickTimestamp) {
                return;
            }
            lastProcessedTickRef.current = tickTimestamp;

            const result = processTick(tick, timeframe);
            if (result) {
                hasUpdates = true;
                const candleKey = getCandleKey(new Date(tickTimestamp), timeframe);
                updatedCandles.add(candleKey);
            }
        });

        if (hasUpdates) {
            // Update visible data with new candles
            const newCandles = Array.from(candleMapRef.current.values())
                .filter(candle => updatedCandles.has(getCandleKey(new Date(candle.date), timeframe)))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setVisibleData(prevData => {
                const updatedData = [...prevData];
                
                // Update or add new candles
                newCandles.forEach(newCandle => {
                    const existingIndex = updatedData.findIndex(
                        c => getCandleKey(new Date(c.date), timeframe) === getCandleKey(new Date(newCandle.date), timeframe)
                    );
                    if (existingIndex !== -1) {
                        updatedData[existingIndex] = newCandle;
                    } else {
                        updatedData.push(newCandle);
                    }
                });
                return updatedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            });
        }
    }, [processTick, getCandleKey]);

    // Stable version of fetchHistoricalDataUpToFirstTick
    const fetchHistoricalDataUpToFirstTick = useCallback(async () => {
        // Prevent multiple simultaneous calls
        if (isHistoricalDataFetchingRef.current) {
            return;
        }

        if (!rawDataRef.current.length || !instrumentToken) {
            console.log('fetchHistoricalDataUpToFirstTick skipped:', {
                hasRawData: rawDataRef.current.length > 0,
                hasInstrumentToken: !!instrumentToken
            });
            return;
        }

        // Check if we already have initial historical data
        if (hasInitialHistoricalDataRef.current) {
            return;
        }

        isHistoricalDataFetchingRef.current = true;

        try {
            // Get the timestamp of the first tick
            const firstTickTimestamp = new Date(rawDataRef.current[0].timestamp);
            
            // Calculate from date based on timeframe
            const daysToFetch = selectedTimeframe === 'minute' ? 60 : 100;
            const fromDate = new Date(firstTickTimestamp.getTime() - daysToFetch * 24 * 60 * 60 * 1000);
            
            // Use current date as toDate to ensure we get all data up to now
            const now = new Date();
            const toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            
            // Use ISO strings - fetchHistoricalData will format them properly
            const fromDateStr = fromDate.toISOString();
            const toDateStr = toDate.toISOString();

            console.log('🔍 Historical Data Fetch Details:', {
                firstTickTimestamp: firstTickTimestamp.toISOString(),
                fromDate: fromDateStr,
                toDate: toDateStr,
                daysToFetch,
                timeframe: selectedTimeframe,
                firstTickData: rawDataRef.current[0]
            });

            const data = await fetchHistoricalData(
                instrumentToken,
                fromDateStr,
                toDateStr,
                selectedTimeframe
            );

            if (data && Array.isArray(data)) {
                console.log('📊 Historical Data Received:', {
                    count: data.length,
                    firstCandle: {
                        date: data[0]?.date,
                        timestamp: data[0]?.timestamp,
                        open: data[0]?.open,
                        close: data[0]?.close
                    },
                    lastCandle: {
                        date: data[data.length - 1]?.date,
                        timestamp: data[data.length - 1]?.timestamp,
                        open: data[data.length - 1]?.open,
                        close: data[data.length - 1]?.close
                    }
                });

                // Ensure data has the correct structure
                const formattedData = data.map(candle => {
                    // Handle both 'date' and 'timestamp' fields from API
                    const dateField = candle.date || candle.timestamp;
                    if (!dateField) {
                        console.warn('Candle missing date/timestamp field:', candle);
                    }
                    
                    return {
                        date: dateField || new Date().toISOString(),
                        open: Number(candle.open) || 0,
                        high: Number(candle.high) || 0,
                        low: Number(candle.low) || 0,
                        close: Number(candle.close) || 0,
                        volume: Number(candle.volume) || 0
                    };
                });

                // Set historical data
                setHistoricalData(formattedData);
                setVisibleData(formattedData);
                
                // Process live data for merged dataset
                const liveCandles = aggregateData(rawDataRef.current, selectedTimeframe);
                
                // Create merged dataset
                const merged = [...formattedData];
                const lastHistoricalDate = new Date(formattedData[formattedData.length - 1].date);
                liveCandles.forEach(candle => {
                    const candleDate = new Date(candle.date);
                    if (candleDate > lastHistoricalDate) {
                        merged.push(candle);
                    }
                });

                merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setMergedData(merged);
                
                console.log('🔄 Data Merging Complete:', {
                    historicalDataCount: formattedData.length,
                    liveCandlesCount: liveCandles.length,
                    mergedDataCount: merged.length,
                    lastHistoricalDate: lastHistoricalDate.toISOString(),
                    firstLiveCandleDate: liveCandles[0]?.date,
                    lastLiveCandleDate: liveCandles[liveCandles.length - 1]?.date
                });
                
                // Mark as completed
                hasInitialHistoricalDataRef.current = true;
                setIsHistoricalDataInitialized(true);
            }
        } catch (error) {
            console.error('Error fetching historical data:', error);
        } finally {
            isHistoricalDataFetchingRef.current = false;
        }
    }, [instrumentToken, selectedTimeframe, aggregateData]);

    // Single effect to handle historical data initialization
    useEffect(() => {
        console.log('🔄 Historical data initialization useEffect triggered:', {
            instrumentToken,
            selectedTimeframe,
            hasInitialData: hasInitialHistoricalDataRef.current,
            isCurrentlyFetching: isHistoricalDataFetchingRef.current
        });

        // Reset flags when instrument or timeframe changes
        hasInitialHistoricalDataRef.current = false;
        isHistoricalDataFetchingRef.current = false;
        setIsHistoricalDataInitialized(false);
        
        // If we have raw data, fetch historical data up to first tick
        if (rawDataRef.current.length > 0) {
            fetchHistoricalDataUpToFirstTick();
        }
    }, [instrumentToken, selectedTimeframe, fetchHistoricalDataUpToFirstTick]); // Only depend on these stable values

    // Handle live data updates
    useEffect(() => {
        if (!liveData || liveData.length === 0) return;

        // Process each data point
        const newTicks = liveData.map(tick => {
            // Handle both old format and new instrumentData format
            const last_price = tick.last_price || tick.price || lastPrice;
            const timestamp = tick.timestamp || new Date().toISOString();
            const volume = tick.volume || 0;

            return {
                timestamp,
                last_price,
                volume,
                high: tick.high,
                low: tick.low,
                open: tick.open
            };
        }).filter(tick => tick.last_price > 0);

        // Add to raw data buffer
        rawDataRef.current = [...rawDataRef.current, ...newTicks].slice(-5000);
        
        // If we have historical data, process new ticks incrementally
        if (hasInitialHistoricalDataRef.current) {
            processNewLiveData(newTicks, selectedTimeframe);
        } else {
            // If we don't have historical data yet, try to fetch it
            fetchHistoricalDataUpToFirstTick();
        }
    }, [liveData, lastPrice, selectedTimeframe, processNewLiveData, fetchHistoricalDataUpToFirstTick]);

    // Handle timeframe changes
    const handleTimeframeChange = useCallback((timeframe: 'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day') => {
        onTimeframeChange(timeframe);
        
        // Re-aggregate all data with new timeframe
        const chartData = aggregateData(rawDataRef.current, timeframe);
        setAggregatedData(chartData);
    }, [onTimeframeChange, aggregateData]);

    // Auto-refresh current candle every 5 seconds
    useEffect(() => {
        if (!isConnected || rawDataRef.current.length === 0) return;

        const interval = setInterval(() => {
            // Get the latest tick and update current candle
            const latestTicks = rawDataRef.current.slice(-10); // Last 10 ticks
            if (latestTicks.length > 0) {
                processNewLiveData(latestTicks, selectedTimeframe);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isConnected, selectedTimeframe, processNewLiveData]);

    const handleTrade = useCallback(async (type: 'BUY' | 'SELL') => {
        if (!accessToken) {
            alert('Access token is missing');
            return;
        }

        if (!isConnected) {
            alert('WebSocket connection is not available');
            return;
        }

        try {
            // Validate order parameters
            if (orderQuantity <= 0) {
                alert('Order quantity must be greater than 0');
                return;
            }

            if (lastPrice <= 0) {
                alert('Invalid last price. Please wait for price data.');
                return;
            }

            console.log('Placing order:', {
                type,
                symbol: selectedStock,
                quantity: orderQuantity,
                price: lastPrice,
                instrumentToken
            });

            // Here you would typically make an API call to place the actual order
            // For now, we'll just simulate the trade locally
            
            const trade: Trade = {
                type,
                quantity: orderQuantity,
                price: lastPrice,
                timestamp: new Date().toISOString()
            };

            setTrades(prev => [...prev, trade]);
            
            // Update position and P&L
            if (type === 'BUY') {
                if (position) {
                    const newQuantity = position.quantity + orderQuantity;
                    const newAvgPrice = ((position.quantity * position.avgPrice) + (orderQuantity * lastPrice)) / newQuantity;
                    setPosition({ quantity: newQuantity, avgPrice: newAvgPrice });
                } else {
                    setPosition({ quantity: orderQuantity, avgPrice: lastPrice });
                }
            } else {
                if (position) {
                    const newQuantity = position.quantity - orderQuantity;
                    const realizedPnl = (lastPrice - position.avgPrice) * Math.min(orderQuantity, position.quantity);
                    
                    if (newQuantity === 0) {
                        setPosition(null);
                    } else if (newQuantity > 0) {
                        setPosition({ quantity: newQuantity, avgPrice: position.avgPrice });
                    } else {
                        // Short position - calculate new average price
                        const shortQuantity = Math.abs(newQuantity);
                        setPosition({ quantity: newQuantity, avgPrice: lastPrice });
                    }
                    
                    setPnl(prev => ({ ...prev, realized: prev.realized + realizedPnl }));
                } else {
                    // Opening short position
                    setPosition({ quantity: -orderQuantity, avgPrice: lastPrice });
                }
            }

            alert(`${type} order for ${orderQuantity} shares at ₹${lastPrice.toFixed(2)} placed successfully!`);

        } catch (error: any) {
            console.error('Error placing order:', error);
            alert(`Failed to place order: ${error.message || 'Unknown error'}`);
        }
    }, [accessToken, selectedStock, orderQuantity, lastPrice, position, isConnected, instrumentToken]);

    // Calculate unrealized P&L
    const unrealizedPnl = position ? (lastPrice - position.avgPrice) * position.quantity : 0;

    // Update merged data when visible data changes
    useEffect(() => {
        if (historicalData.length > 0 && visibleData.length > 0) {
            const lastHistoricalDate = new Date(historicalData[historicalData.length - 1].date);
            const newLiveData = visibleData.filter(candle => 
                new Date(candle.date) > lastHistoricalDate
            );

            const merged = [...historicalData, ...newLiveData];
            merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setMergedData(merged);
        }
    }, [visibleData, historicalData]);

    // Use provided WebSocket connection
    useEffect(() => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
            wsRef.current = wsConnection;
            console.log('LiveTrading: Using provided WebSocket connection');
        } else if (wsConnection && wsConnection.readyState === WebSocket.CONNECTING) {
            wsRef.current = wsConnection;
            console.log('LiveTrading: WebSocket connection is connecting...');
        } else {
            wsRef.current = null;
        }
    }, [wsConnection, isConnected]);

    // Add logging for component mount and props
    useEffect(() => {
        console.log('LiveTrading component mounted/updated:', {
            selectedStock,
            instrumentToken,
            isConnected,
            selectedTimeframe,
            hasAccessToken: !!accessToken
        });
    }, [selectedStock, instrumentToken, isConnected, selectedTimeframe, accessToken]);

    return (
        <div className="p-4 bg-white rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Live Trading - {selectedStock}</h2>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded ${isConnected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                    {connectionError && (
                        <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                            {connectionError}
                        </span>
                    )}
                    <span className="text-lg font-semibold">
                        Last Price: ₹{lastPrice.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-600">
                        Data Points: {visibleData.length}
                    </span>
                </div>
            </div>

            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Price Chart ({visibleData.length} candle/s)</h3>
                </div>
                <div className="relative border rounded ">
                    {visibleData.length > 0 ? (
                        <AdvancedChart 
                            data={visibleData}
                            title={`${selectedStock} - ${selectedTimeframe}`}
                            onTimeframeChange={handleTimeframeChange}
                            selectedTimeframe={selectedTimeframe}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            {isConnected ? 'Waiting for data...' : 'Connect to start receiving data'}
                        </div>
                    )}
                </div>
            </div>

            <LiveOptionsChain
                selectedStock={selectedStock}
                wsConnection={wsConnection}
                accessToken={accessToken}
                isConnected={isConnected}
                lastPrice={lastPrice}
            />

            <div className="mt-12 grid grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">Position</h3>
                    {position ? (
                        <div className="space-y-4">
                            <p>Quantity: <span className={position.quantity >= 0 ? 'text-green-600' : 'text-red-600'}>{position.quantity}</span></p>
                            <p>Avg Price: ₹{position.avgPrice.toFixed(2)}</p>
                            <p className={`font-semibold ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Unrealized P&L: ₹{unrealizedPnl.toFixed(2)}
                            </p>
                            <p className={`font-semibold ${pnl.realized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Realized P&L: ₹{pnl.realized.toFixed(2)}
                            </p>
                            <p className={`font-bold ${(pnl.realized + unrealizedPnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Total P&L: ₹{(pnl.realized + unrealizedPnl).toFixed(2)}
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-500">No open position</p>
                    )}
                </div>

                <div className="bg-gray-50 p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">Place Order</h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                            <input
                                type="number"
                                value={orderQuantity}
                                onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                                min="1"
                                disabled={!isConnected}
                            />
                        </div>
                        <div className="text-sm text-gray-600">
                            Order Value: ₹{(orderQuantity * lastPrice).toFixed(2)}
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleTrade('BUY')}
                                disabled={!isConnected || lastPrice <= 0}
                                className="flex-1 bg-green-500 text-white px-4 py-3 rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                Buy
                            </button>
                            <button
                                onClick={() => handleTrade('SELL')}
                                disabled={!isConnected || lastPrice <= 0}
                                className="flex-1 bg-red-500 text-white px-4 py-3 rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                Sell
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Trade History ({trades.length} trades)</h3>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {trades.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        No trades yet
                                    </td>
                                </tr>
                            ) : (
                                trades.slice().reverse().map((trade, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(trade.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                                                trade.type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {trade.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{trade.quantity}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">₹{trade.price.toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};