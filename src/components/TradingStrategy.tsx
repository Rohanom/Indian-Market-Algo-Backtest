import { useState, useEffect, useMemo } from 'react';
import { RSICharts } from './RSICharts';

interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    date: string;
}

interface Trade {
    type: 'BUY' | 'SELL';
    price: number;
    date: string;
    quantity: number;
    strategy: string;
}

interface TradingStrategyProps {
    data5min: Candle[];
    data15min: Candle[];
    onTrade: (trade: Trade) => void;
    capital: number;
    currentPrice?: number;
}

export const TradingStrategy = ({ data5min, data15min, onTrade, capital, currentPrice }: TradingStrategyProps) => {
    const [lastBuyPrice, setLastBuyPrice] = useState<number | null>(null);
    const [currentRSI, setCurrentRSI] = useState({
        rsi5min: [] as number[],
        rsi15min: [] as number[],
        rsiSMA5min: [] as number[],
        rsiSMA15min: [] as number[]
    });

    // Memoize the strategy calculations to prevent infinite re-renders
    const { rsi5min, rsi15min, rsiSMA5min, rsiSMA15min } = useMemo(() => {
        if (data5min.length < 40 || data15min.length < 40) {
            return {
                rsi5min: [],
                rsi15min: [],
                rsiSMA5min: [],
                rsiSMA15min: []
            };
        }

        // Calculate RSI and RSI-SMA for both timeframes
        const rsi5min = calculateRSI(data5min, 14);
        const rsi15min = calculateRSI(data15min, 14);
        
        // Calculate RSI-SMA(20) for both timeframes
        const rsiSMA5min = calculateRSISMA(rsi5min, 20);
        const rsiSMA15min = calculateRSISMA(rsi15min, 20);

        return { rsi5min, rsi15min, rsiSMA5min, rsiSMA15min };
    }, [data5min, data15min]);

    // Update current RSI state when calculations change
    useEffect(() => {
        setCurrentRSI({
            rsi5min,
            rsi15min,
            rsiSMA5min,
            rsiSMA15min
        });
    }, [rsi5min, rsi15min, rsiSMA5min, rsiSMA15min]);

    // Handle trading logic in a separate useEffect
    useEffect(() => {
        if (data5min.length < 40 || data15min.length < 40 || 
            rsi5min.length === 0 || rsi15min.length === 0 || 
            rsiSMA5min.length === 0 || rsiSMA15min.length === 0) {
            return;
        }

        const currentPrice5min = data5min[data5min.length - 1].close;
        const currentTimestamp = data5min[data5min.length - 1].date;

        const latestRSI5min = rsi5min[rsi5min.length - 1];
        const latestRSISMA5min = rsiSMA5min[rsiSMA5min.length - 1];
        const latestRSI15min = rsi15min[rsi15min.length - 1];
        const latestRSISMA15min = rsiSMA15min[rsiSMA15min.length - 1];

        // Check for buy signal: RSI >= RSI-SMA for 5min AND RSI > RSI-SMA for 15min
        if (!lastBuyPrice && 
            latestRSI5min >= latestRSISMA5min && 
            latestRSI15min > latestRSISMA15min) {
            
            const trade: Trade = {
                type: 'BUY',
                price: currentPrice5min,
                date: currentTimestamp,
                quantity: 1,
                strategy: 'RSI-SMA Strategy'
            };
            
            onTrade(trade);
            setLastBuyPrice(currentPrice5min);
        }

        // Check for sell signal: 0.1% profit target
        if (lastBuyPrice && currentPrice5min >= lastBuyPrice * 1.10) {
            const trade: Trade = {
                type: 'SELL',
                price: currentPrice5min,
                date: currentTimestamp,
                quantity: 1,
                strategy: 'RSI-SMA Strategy'
            };
            
            onTrade(trade);
            setLastBuyPrice(null);
        }
    }, [data5min, data15min, rsi5min, rsi15min, rsiSMA5min, rsiSMA15min, lastBuyPrice, onTrade]);

    return (
        <div className="space-y-4">
            {/* RSI Charts */}
            <RSICharts 
                rsi5min={currentRSI.rsi5min.map((value, index) => ({
                    timestamp: data5min[index + 14]?.date || '',
                    value: value
                }))}
                rsiSma5min={currentRSI.rsiSMA5min.map((value, index) => ({
                    timestamp: data5min[index + 34]?.date || '',
                    value: value
                }))}
                rsi15min={currentRSI.rsi15min.map((value, index) => ({
                    timestamp: data15min[index + 14]?.date || '',
                    value: value
                }))}
                rsiSma15min={currentRSI.rsiSMA15min.map((value, index) => ({
                    timestamp: data15min[index + 34]?.date || '',
                    value: value
                }))}
            />

            {/* Trading Controls */}
            <div className="bg-gray-900 p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-4 text-white">RSI-SMA Strategy Status</h3>
                <div className="space-y-4 text-white">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800 p-3 rounded">
                            <h4 className="text-sm font-medium text-gray-400 mb-2">5min Timeframe</h4>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>RSI:</span>
                                    <span className={currentRSI.rsi5min.length > 0 && currentRSI.rsiSMA5min.length > 0 && 
                                        currentRSI.rsi5min[currentRSI.rsi5min.length - 1] >= currentRSI.rsiSMA5min[currentRSI.rsiSMA5min.length - 1] ? 'text-green-400' : 'text-red-400'}>
                                        {currentRSI.rsi5min.length > 0 ? currentRSI.rsi5min[currentRSI.rsi5min.length - 1].toFixed(2) : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>RSI-SMA:</span>
                                    <span>{currentRSI.rsiSMA5min.length > 0 ? currentRSI.rsiSMA5min[currentRSI.rsiSMA5min.length - 1].toFixed(2) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Signal:</span>
                                    <span className={currentRSI.rsi5min.length > 0 && currentRSI.rsiSMA5min.length > 0 && 
                                        currentRSI.rsi5min[currentRSI.rsi5min.length - 1] >= currentRSI.rsiSMA5min[currentRSI.rsiSMA5min.length - 1] ? 'text-green-400' : 'text-red-400'}>
                                        {currentRSI.rsi5min.length > 0 && currentRSI.rsiSMA5min.length > 0 ? 
                                            (currentRSI.rsi5min[currentRSI.rsi5min.length - 1] >= currentRSI.rsiSMA5min[currentRSI.rsiSMA5min.length - 1] ? 'RSI >= RSI-SMA ✓' : 'RSI < RSI-SMA ✗') : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-800 p-3 rounded">
                            <h4 className="text-sm font-medium text-gray-400 mb-2">15min Timeframe</h4>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>RSI:</span>
                                    <span className={currentRSI.rsi15min.length > 0 && currentRSI.rsiSMA15min.length > 0 && 
                                        currentRSI.rsi15min[currentRSI.rsi15min.length - 1] > currentRSI.rsiSMA15min[currentRSI.rsiSMA15min.length - 1] ? 'text-green-400' : 'text-red-400'}>
                                        {currentRSI.rsi15min.length > 0 ? currentRSI.rsi15min[currentRSI.rsi15min.length - 1].toFixed(2) : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>RSI-SMA:</span>
                                    <span>{currentRSI.rsiSMA15min.length > 0 ? currentRSI.rsiSMA15min[currentRSI.rsiSMA15min.length - 1].toFixed(2) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Signal:</span>
                                    <span className={currentRSI.rsi15min.length > 0 && currentRSI.rsiSMA15min.length > 0 && 
                                        currentRSI.rsi15min[currentRSI.rsi15min.length - 1] > currentRSI.rsiSMA15min[currentRSI.rsiSMA15min.length - 1] ? 'text-green-400' : 'text-red-400'}>
                                        {currentRSI.rsi15min.length > 0 && currentRSI.rsiSMA15min.length > 0 ? 
                                            (currentRSI.rsi15min[currentRSI.rsi15min.length - 1] > currentRSI.rsiSMA15min[currentRSI.rsiSMA15min.length - 1] ? 'RSI > RSI-SMA ✓' : 'RSI <= RSI-SMA ✗') : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Combined Signal */}
                    <div className="bg-gray-800 p-3 rounded">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Combined Signal</h4>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Status:</span>
                                <span className={
                                    currentRSI.rsi5min.length > 0 && currentRSI.rsiSMA5min.length > 0 &&
                                    currentRSI.rsi15min.length > 0 && currentRSI.rsiSMA15min.length > 0 &&
                                    currentRSI.rsi5min[currentRSI.rsi5min.length - 1] >= currentRSI.rsiSMA5min[currentRSI.rsiSMA5min.length - 1] &&
                                    currentRSI.rsi15min[currentRSI.rsi15min.length - 1] > currentRSI.rsiSMA15min[currentRSI.rsiSMA15min.length - 1]
                                    ? 'text-green-400 font-bold' : 'text-red-400'
                                }>
                                    {currentRSI.rsi5min.length > 0 && currentRSI.rsiSMA5min.length > 0 &&
                                     currentRSI.rsi15min.length > 0 && currentRSI.rsiSMA15min.length > 0 ? (
                                        (currentRSI.rsi5min[currentRSI.rsi5min.length - 1] >= currentRSI.rsiSMA5min[currentRSI.rsiSMA5min.length - 1] &&
                                         currentRSI.rsi15min[currentRSI.rsi15min.length - 1] > currentRSI.rsiSMA15min[currentRSI.rsiSMA15min.length - 1])
                                        ? 'BUY SIGNAL ACTIVE 🟢' : 'NO SIGNAL 🔴'
                                    ) : 'Calculating...'}
                                </span>
                            </div>
                            {lastBuyPrice && (
                                <>
                                    <div className="flex justify-between">
                                        <span>Position:</span>
                                        <span className="text-blue-400">LONG @ ₹{lastBuyPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Target:</span>
                                        <span className="text-yellow-400">₹{(lastBuyPrice * 1.001).toFixed(2)} (+0.1%)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Current P&L:</span>
                                        <span className={currentPrice && currentPrice > lastBuyPrice ? 'text-green-400' : 'text-red-400'}>
                                            {currentPrice ? `₹${(currentPrice - lastBuyPrice).toFixed(2)} (${(((currentPrice - lastBuyPrice) / lastBuyPrice) * 100).toFixed(3)}%)` : 'N/A'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper functions for technical analysis
const calculateRSI = (data: Candle[], period: number): number[] => {
    if (data.length < period + 1) {
        return [];
    }
    
    const rsi: number[] = [];
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change >= 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calculate RSI for the initial period
    if (avgLoss === 0) {
        rsi.push(100);
    } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    
    // Calculate RSI for the rest of the data using smoothed averages
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        let gain = 0;
        let loss = 0;
        
        if (change >= 0) {
            gain = change;
        } else {
            loss = -change;
        }
        
        // Smoothed averages (Wilder's smoothing)
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        if (avgLoss === 0) {
            rsi.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
    }
    
    return rsi;
};

// Function to calculate SMA of RSI values
const calculateRSISMA = (rsiValues: number[], smaPeriod: number): number[] => {
    if (rsiValues.length < smaPeriod) {
        return [];
    }
    
    const rsiSMA: number[] = [];
    
    for (let i = smaPeriod - 1; i < rsiValues.length; i++) {
        const slice = rsiValues.slice(i - smaPeriod + 1, i + 1);
        const sum = slice.reduce((acc, val) => acc + val, 0);
        rsiSMA.push(sum / smaPeriod);
    }
    
    return rsiSMA;
}; 