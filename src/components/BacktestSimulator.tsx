import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AdvancedChart } from './AdvancedChart';
import { TradingStrategy } from './TradingStrategy';
import { TradingStrategy2 } from './TradingStrategy2';
import { fetchHistoricalData } from '../utils/kiteApi';

// Type definitions
type Timeframe = 'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day';

interface Candle {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface Position {
    id: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    realizedPnL: number;
    strategy: string;
    entryTime: string;
    marketValue: number;
}

interface Portfolio {
    totalValue: number;
    cash: number;
    positions: Position[];
    totalPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    returnsPercent: number;
    maxDrawdown: number;
    peakValue: number;
    lastTradeDate: string;
}

interface Trade {
    type: 'BUY' | 'SELL';
    price: number;
    date: string;
    quantity: number;
    strategy: string;
    id: string;
}

interface StrategyData {
    data5min: Candle[];
    data15min: Candle[];
    isLoading: boolean;
    error: string | null;
    lastUpdate: number;
}

interface BacktestSimulatorProps {
    historicalData: Candle[];
    timeframe: Timeframe;
    onTimeframeChange: (timeframe: Timeframe) => void;
    selectedTimeframe: Timeframe;
    selectedStock: string;
    instrumentToken: string;
}

// Constants
const INITIAL_CAPITAL = 1000000; // 10 Lakhs
const MIN_INTERVAL = 16; // Minimum 60 FPS
const MAX_UPDATES_PER_SECOND = 60;
const UPDATE_BATCH_SIZE = 5;
const BASE_INTERVAL = 100; // Base interval for simulation

export const BacktestSimulator = ({
    historicalData,
    timeframe,
    onTimeframeChange,
    selectedTimeframe,
    selectedStock,
    instrumentToken
}: BacktestSimulatorProps) => {
    // Core simulation state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [simulationSpeed, setSimulationSpeed] = useState(1);
    
    // Portfolio state
    const [portfolio, setPortfolio] = useState<Portfolio>({
        totalValue: INITIAL_CAPITAL,
        cash: INITIAL_CAPITAL,
        positions: [],
        totalPnL: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        returnsPercent: 0,
        maxDrawdown: 0,
        peakValue: INITIAL_CAPITAL,
        lastTradeDate: ''
    });

    // Trading state
    const [trades, setTrades] = useState<Trade[]>([]);

    // Refs
    const simulationRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateRef = useRef<number>(0);

    // Add strategy data state
    const [strategyData, setStrategyData] = useState<StrategyData>({
        data5min: [],
        data15min: [],
        isLoading: false,
        error: null,
        lastUpdate: 0
    });

    // Prepare visible data for chart
    const visibleData = useMemo(() => {
        return historicalData.slice(0, currentIndex + 1);
    }, [historicalData, currentIndex]);

    // Get current market price
    const currentPrice = useCallback(() => {
        if (visibleData.length === 0) return 0;
        return visibleData[visibleData.length - 1].close;
    }, [visibleData]);

    // Fetch strategy data
    const fetchStrategyData = useCallback(async () => {
        if (!instrumentToken || historicalData.length === 0) {
            // console.log('Strategy data fetch skipped:', { 
            //     hasInstrumentToken: !!instrumentToken, 
            //     historicalDataLength: historicalData.length 
            // });
            setStrategyData(prev => ({ ...prev, error: 'No instrument token or historical data available' }));
            return;
        }

        try {
            setStrategyData(prev => ({ ...prev, isLoading: true, error: null }));
            
            const firstCandle = historicalData[0];
            const lastCandle = historicalData[historicalData.length - 1];

            // console.log('Strategy data fetch attempt:', {
            //     firstCandle,
            //     lastCandle,
            //     historicalDataLength: historicalData.length,
            //     firstCandleKeys: firstCandle ? Object.keys(firstCandle) : [],
            //     lastCandleKeys: lastCandle ? Object.keys(lastCandle) : [],
            //     firstCandleTimestamp: firstCandle?.timestamp,
            //     lastCandleTimestamp: lastCandle?.timestamp,
            //     firstCandleDate: firstCandle?.date,
            //     lastCandleDate: lastCandle?.date
            // });

            // Get timestamps more reliably
            const getTimestamp = (candle: any) => {
                const ts = candle?.date || candle?.timestamp || candle?.time;
                if (!ts) return null;
                
                // If it's already a Date object, return it
                if (ts instanceof Date) return ts;
                
                // If it's a string or number, try to parse it
                const parsed = new Date(ts);
                return isNaN(parsed.getTime()) ? null : parsed;
            };

            const firstTimestamp = getTimestamp(firstCandle);
            const lastTimestamp = getTimestamp(lastCandle);

            if (!firstTimestamp || !lastTimestamp) {
                console.error('Missing or invalid timestamp data:', {
                    firstCandle: firstCandle,
                    lastCandle: lastCandle,
                    firstTimestamp: firstTimestamp,
                    lastTimestamp: lastTimestamp
                });
                throw new Error('Invalid candle data: missing or invalid timestamps');
            }

            // Format dates exactly like page.tsx
            const formatDate = (date: Date) => {
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
            };

            const fromDate = formatDate(firstTimestamp);
            const toDate = formatDate(lastTimestamp);
            // console.log('Fetching strategy data with date range:', { fromDate, toDate });

            const [result5min, result15min] = await Promise.allSettled([
                fetchHistoricalData(instrumentToken, fromDate, toDate, '5minute'),
                fetchHistoricalData(instrumentToken, fromDate, toDate, '15minute')
            ]);
            
            // console.log('Strategy data fetch results:', {
            //     result5min: result5min.status,
            //     result15min: result15min.status,
            //     result5minValue: result5min.status === 'fulfilled' ? result5min.value?.length : null,
            //     result15minValue: result15min.status === 'fulfilled' ? result15min.value?.length : null
            // });

            let data5min: Candle[] = [];
            let data15min: Candle[] = [];

            if (result5min.status === 'fulfilled' && Array.isArray(result5min.value)) {
                data5min = result5min.value
                    .filter(d => d && (d.date || d.timestamp))
                    .map(d => ({ ...d, date: d.date || d.timestamp }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }
            
            if (result15min.status === 'fulfilled' && Array.isArray(result15min.value)) {
                data15min = result15min.value
                    .filter(d => d && (d.date || d.timestamp))
                    .map(d => ({ ...d, date: d.date || d.timestamp }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }
            
            setStrategyData({
                data5min,
                data15min,
                isLoading: false,
                error: null,
                lastUpdate: Date.now()
            });
            
        } catch (error) {
            console.error('Strategy data fetch error:', error);
            setStrategyData(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to fetch strategy data'
            }));
        }
    }, [instrumentToken, historicalData]);

    // Get filtered strategy data based on current timestamp
    const getFilteredStrategyData = useCallback((
        data: Candle[],
        currentTimestamp: Date,
        timeframeMinutes: number
    ): Candle[] => {
        const currentTime = currentTimestamp.getTime();
        const cutoffTime = currentTime;
        
        return data.filter(candle => {
            const candleTime = new Date(candle.date).getTime();
            return candleTime <= cutoffTime;
        });
    }, []);

    // Get current strategy data
    const { current5minData, current15minData } = useMemo(() => {
        if (visibleData.length === 0) {
            return { current5minData: [], current15minData: [] };
        }

        const currentCandle = visibleData[visibleData.length - 1];
        const currentTimestamp = new Date(currentCandle.date);

        return {
            current5minData: getFilteredStrategyData(strategyData.data5min, currentTimestamp, 5),
            current15minData: getFilteredStrategyData(strategyData.data15min, currentTimestamp, 15)
        };
    }, [visibleData, strategyData.data5min, strategyData.data15min, getFilteredStrategyData]);

    // Transform data for strategy component
    const transformedStrategyData = useMemo(() => {
        // Ensure timestamps are in ISO format and data is properly sorted
        const transformData = (data: Candle[]) => {
            return data
                .filter(candle => candle && candle.date)
                .map(candle => ({
                    ...candle,
                    date: new Date(candle.date).toISOString()
                }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        };

        const transformed5min = transformData(current5minData);
        const transformed15min = transformData(current15minData);

        // console.log('Strategy Data Check:', {
        //     '5min data length': transformed5min.length,
        //     '15min data length': transformed15min.length,
        //     '5min first candle': transformed5min[0],
        //     '5min last candle': transformed5min[transformed5min.length - 1],
        //     '15min first candle': transformed15min[0],
        //     '15min last candle': transformed15min[transformed15min.length - 1]
        // });

        return {
            data5min: transformed5min,
            data15min: transformed15min
        };
    }, [current5minData, current15minData]);

    // Fetch strategy data when instrument token or historical data changes
    useEffect(() => {
        if (!instrumentToken || !historicalData.length) {
            // console.log('Strategy data fetch skipped:', { 
            //     hasInstrumentToken: !!instrumentToken, 
            //     historicalDataLength: historicalData.length 
            // });
            return;
        }

        // console.log('fetchStrategyData useEffect triggered:', {
        //     instrumentToken,
        //     historicalDataLength: historicalData.length
        // });
        
        fetchStrategyData();
    }, [instrumentToken, historicalData.length]);

    // Update portfolio metrics
    const updatePortfolioMetrics = useCallback(() => {
        if (!currentPrice()) return;

        setPortfolio(prev => {
            // Update position values
            const updatedPositions = prev.positions.map(position => {
                const unrealizedPnL = (currentPrice() - position.avgPrice) * position.quantity;
                const marketValue = currentPrice() * position.quantity;
                
                return {
                    ...position,
                    currentPrice: currentPrice(),
                    unrealizedPnL,
                    marketValue
                };
            });

            // Calculate total values
            const totalMarketValue = updatedPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
            const totalValue = prev.cash + totalMarketValue;
            const unrealizedPnL = updatedPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
            const totalPnL = prev.realizedPnL + unrealizedPnL;
            const returnsPercent = ((totalValue - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

            // Calculate max drawdown
            const peakValue = Math.max(prev.peakValue || INITIAL_CAPITAL, totalValue);
            const drawdown = ((peakValue - totalValue) / peakValue) * 100;

            return {
                ...prev,
                positions: updatedPositions,
                totalValue,
                totalPnL,
                realizedPnL: prev.realizedPnL,
                unrealizedPnL,
                returnsPercent,
                peakValue,
                maxDrawdown: Math.max(prev.maxDrawdown, drawdown)
            };
        });
    }, [currentPrice]);

    // Update portfolio metrics when current price changes (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            updatePortfolioMetrics();
        }, 50); // Small debounce to prevent excessive updates

        return () => clearTimeout(timeoutId);
    }, [currentPrice, updatePortfolioMetrics]);

    // Simulation controls
    const handlePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleReset = useCallback(() => {
        setIsPlaying(false);
        setCurrentIndex(0);
        
        // Reset portfolio to initial state
        setPortfolio({
            totalValue: INITIAL_CAPITAL,
            cash: INITIAL_CAPITAL,
            positions: [],
            totalPnL: 0,
            realizedPnL: 0,
            unrealizedPnL: 0,
            returnsPercent: 0,
            maxDrawdown: 0,
            peakValue: INITIAL_CAPITAL,
            lastTradeDate: ''
        });
        
        // Reset trades history
        setTrades([]);
        
        // Reset strategy data (will be refetched automatically)
        setStrategyData({
            data5min: [],
            data15min: [],
            isLoading: false,
            error: null,
            lastUpdate: 0
        });
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
        setSimulationSpeed(speed);
    }, []);

    // Simulation effect
    useEffect(() => {
        if (!isPlaying) {
            if (simulationRef.current) {
                clearInterval(simulationRef.current);
                simulationRef.current = null;
            }
            return;
        }

        const interval = Math.max(MIN_INTERVAL, BASE_INTERVAL / simulationSpeed);
        
        simulationRef.current = setInterval(() => {
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateRef.current;
            const minTimeBetweenUpdates = 1000 / MAX_UPDATES_PER_SECOND; // Max 60 updates per second
            
            // Throttle updates to prevent overwhelming the strategy
            if (timeSinceLastUpdate >= minTimeBetweenUpdates) {
                lastUpdateRef.current = now;
                setCurrentIndex(prev => {
                    if (prev >= historicalData.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    
                    // At high speeds, advance multiple candles at once for better performance
                    const batchSize = simulationSpeed >= 5 ? UPDATE_BATCH_SIZE : 1;
                    const nextIndex = Math.min(prev + batchSize, historicalData.length - 1);
                    
                    return nextIndex;
                });
            }
        }, interval);

        return () => {
            if (simulationRef.current) {
                clearInterval(simulationRef.current);
                simulationRef.current = null;
            }
        };
    }, [isPlaying, simulationSpeed, historicalData.length]);

    // Handle trade execution
    const handleTrade = useCallback((trade: Omit<Trade, 'id'>) => {
        const tradeWithId = {
            ...trade,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        setPortfolio(prev => {
            const newPortfolio = { ...prev };
            
            if (tradeWithId.type === 'BUY') {
                const totalCost = tradeWithId.price * tradeWithId.quantity;
                if (totalCost > newPortfolio.cash) return prev; // Insufficient funds
                
                newPortfolio.cash -= totalCost;
                
                // Check if there's already a position for this strategy
                const existingPositionIndex = newPortfolio.positions.findIndex(
                    p => p.strategy === tradeWithId.strategy
                );
                
                if (existingPositionIndex !== -1) {
                    // Update existing position - calculate new average price
                    const existingPosition = newPortfolio.positions[existingPositionIndex];
                    const totalQuantity = existingPosition.quantity + tradeWithId.quantity;
                    const totalValue = (existingPosition.avgPrice * existingPosition.quantity) + (tradeWithId.price * tradeWithId.quantity);
                    const newAvgPrice = totalValue / totalQuantity;
                    
                    newPortfolio.positions[existingPositionIndex] = {
                        ...existingPosition,
                        quantity: totalQuantity,
                        avgPrice: newAvgPrice,
                        currentPrice: tradeWithId.price,
                        marketValue: tradeWithId.price * totalQuantity,
                        unrealizedPnL: (tradeWithId.price - newAvgPrice) * totalQuantity
                    };
                } else {
                    // Create new position
                    newPortfolio.positions.push({
                        id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`,
                        symbol: selectedStock,
                        quantity: tradeWithId.quantity,
                        avgPrice: tradeWithId.price,
                        currentPrice: tradeWithId.price,
                        unrealizedPnL: 0,
                        realizedPnL: 0,
                        strategy: tradeWithId.strategy,
                        entryTime: tradeWithId.date,
                        marketValue: totalCost
                    });
                }
            } else {
                // For SELL trades, find position by strategy base name (handles exit reason suffixes)
                const positionIndex = newPortfolio.positions.findIndex(
                    p => {
                        // Handle exact match first
                        if (p.strategy === tradeWithId.strategy) return true;
                        
                        // Handle CCI strategy variations
                        const isCCIStrategy = tradeWithId.strategy.includes('CCI Strategy') || tradeWithId.strategy.includes('CCI Momentum Strategy');
                        const isCCIPosition = p.strategy.includes('CCI Strategy') || p.strategy.includes('CCI Momentum Strategy');
                        
                        return isCCIStrategy && isCCIPosition && p.quantity > 0;
                    }
                );
                
                if (positionIndex !== -1) {
                    const position = newPortfolio.positions[positionIndex];
                    const sellValue = tradeWithId.price * tradeWithId.quantity;
                    const realizedPnL = (tradeWithId.price - position.avgPrice) * tradeWithId.quantity;
                    
                    if (position.quantity === tradeWithId.quantity) {
                        newPortfolio.positions.splice(positionIndex, 1);
                    } else {
                        position.quantity -= tradeWithId.quantity;
                        position.marketValue = position.quantity * position.currentPrice;
                        position.unrealizedPnL = (position.currentPrice - position.avgPrice) * position.quantity;
                    }
                    
                    newPortfolio.cash += sellValue;
                    newPortfolio.realizedPnL += realizedPnL;
                }
            }
            
            return newPortfolio;
        });
        
        // Record the trade in history
        setTrades(prev => [...prev, tradeWithId]);
        
    }, [selectedStock]);

    return (
        <div className="space-y-4">
            {/* Control Panel */}
            <div className="bg-gray-900 p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Backtest Simulator</h3>
                    <div className="text-sm text-gray-400">
                        {currentIndex + 1} / {historicalData.length} candles 
                        ({((currentIndex / historicalData.length) * 100).toFixed(1)}%)
                    </div>
                </div>
                
                <div className="flex items-center space-x-4">
                    {/* Play/Pause Button */}
                    <button
                        onClick={handlePlayPause}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>

                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        🔄 Reset
                    </button>

                    {/* Speed Control */}
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-sm">Speed:</span>
                        <select 
                            value={simulationSpeed} 
                            onChange={(e) => handleSpeedChange(Number(e.target.value))}
                            className="bg-gray-800 text-white px-2 py-1 rounded text-sm"
                        >
                            <option value={0.5}>0.5x</option>
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={5}>5x</option>
                            <option value={10}>10x</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-gray-900 p-4 rounded-lg shadow">
                <AdvancedChart
                    data={visibleData}
                    title={`${selectedStock} Backtest`}
                    onTimeframeChange={onTimeframeChange}
                    selectedTimeframe={selectedTimeframe}
                />
            </div>

            {/* Portfolio Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Portfolio Summary */}
                <div className="bg-gray-900 p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4 text-white">Portfolio Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Total Value</span>
                            <span className="text-xl font-bold text-white">
                                ₹{portfolio.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Cash Balance</span>
                            <span className="text-white">
                                ₹{portfolio.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Total P&L</span>
                            <span className={`font-medium ${portfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {portfolio.totalPnL >= 0 ? '+' : ''}₹{portfolio.totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Realized P&L</span>
                            <span className={`font-medium ${portfolio.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {portfolio.realizedPnL >= 0 ? '+' : ''}₹{portfolio.realizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Unrealized P&L</span>
                            <span className={`font-medium ${portfolio.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {portfolio.unrealizedPnL >= 0 ? '+' : ''}₹{portfolio.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Returns</span>
                            <span className={`font-medium ${portfolio.returnsPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {portfolio.returnsPercent >= 0 ? '+' : ''}{portfolio.returnsPercent.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Max Drawdown</span>
                            <span className="text-red-400">{portfolio.maxDrawdown.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* Positions Table */}
                <div className="bg-gray-900 p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4 text-white">Open Positions</h3>
                    {portfolio.positions.length > 0 ? (
                        <div className="space-y-2">
                            {portfolio.positions.map((position) => (
                                <div key={position.id} className="bg-gray-800 p-3 rounded">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-white font-medium">{position.symbol}</div>
                                            <div className="text-gray-400 text-sm">
                                                {position.quantity} @ ₹{position.avgPrice.toFixed(2)}
                                            </div>
                                            <div className="text-gray-400 text-xs">
                                                {position.strategy}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {position.unrealizedPnL >= 0 ? '+' : ''}₹{position.unrealizedPnL.toFixed(0)}
                                            </div>
                                            <div className="text-gray-400 text-sm">
                                                ₹{position.marketValue.toFixed(0)}
                                            </div>
                                            <div className="text-gray-400 text-xs">
                                                {((position.currentPrice - position.avgPrice) / position.avgPrice * 100).toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-center py-4">No open positions</div>
                    )}
                </div>
            </div>

            {/* Trade History and Strategy Data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Trade History */}
                <div className="bg-gray-900 p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4 text-white">Trade History ({trades.length})</h3>
                    {trades.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {trades.slice().reverse().map((trade) => (
                                <div key={trade.id} className="bg-gray-800 p-3 rounded text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className={`font-medium ${trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                {trade.type} {trade.quantity} @ ₹{trade.price.toFixed(2)}
                                            </div>
                                            <div className="text-gray-400 text-xs">
                                                {trade.strategy}
                                            </div>
                                            <div className="text-gray-500 text-xs">
                                                {new Date(trade.date).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-white font-medium">
                                                ₹{(trade.price * trade.quantity).toFixed(0)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-center py-8">No trades executed yet</div>
                    )}
                </div>

                {/* Strategy Data Status */}
                <div className="bg-gray-900 p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4 text-white">Strategy Data Status</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">5min Data</span>
                            <span className="text-white">{current5minData.length} / {strategyData.data5min.length} candles</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">15min Data</span>
                            <span className="text-white">{current15minData.length} / {strategyData.data15min.length} candles</span>
                        </div>
                        {strategyData.isLoading && (
                            <div className="text-blue-400 text-center py-2">
                                Loading strategy data...
                            </div>
                        )}
                        {strategyData.error && (
                            <div className="text-red-400 text-center py-2">
                                Error: {strategyData.error}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Trading Strategy Component */}
            <div className="bg-gray-900 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4 text-white">Trading Strategy</h3>
                {strategyData.isLoading ? (
                    <div className="text-white text-center py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        Loading strategy data...
                    </div>
                ) : strategyData.error ? (
                    <div className="text-red-400 text-center py-8">
                        Strategy Error: {strategyData.error}
                    </div>
                ) : (
                    // <TradingStrategy 
                    //     data5min={transformedStrategyData.data5min}
                    //     data15min={transformedStrategyData.data15min}
                    //     onTrade={handleTrade}
                    //     capital={portfolio.totalValue}
                    //     currentPrice={currentPrice()}
                    // />
                    <TradingStrategy2 
                        data5min={transformedStrategyData.data5min}
                        onTrade={handleTrade}
                        capital={portfolio.totalValue}
                        currentPrice={currentPrice()}
                    />
                )}
            </div>
        </div>
    );
}; 