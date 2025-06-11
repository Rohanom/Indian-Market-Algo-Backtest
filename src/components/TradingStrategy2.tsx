import { useState, useEffect, useMemo } from 'react';
import { CCIChart } from './CCIChart';

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

interface TradingStrategy2Props {
    data5min: Candle[];
    onTrade: (trade: Trade) => void;
    capital: number;
    currentPrice?: number;
}

export const TradingStrategy2 = ({ data5min, onTrade, capital, currentPrice }: TradingStrategy2Props) => {
    const [position, setPosition] = useState<{
        type: 'LONG' | 'SHORT' | null;
        entryPrice: number | null;
        stopLoss: number | null;
    }>({
        type: null,
        entryPrice: null,
        stopLoss: null
    });
    const [isTrading, setIsTrading] = useState<boolean>(false);
    const [currentCCI, setCurrentCCI] = useState<{
        cci: number[];
        signals: { date: string; type: string; value: number }[];
    }>({
        cci: [],
        signals: []
    });

    // Calculate CCI (Commodity Channel Index)
    const { cci, signals } = useMemo(() => {
        if (data5min.length < 21) { // Need at least 21 periods for CCI calculation
            return { cci: [], signals: [] };
        }

        const period = 20;
        const cci = calculateCCI(data5min, period);
        const signals = detectCCISignals(cci, data5min);

        return { cci, signals };
    }, [data5min]);

    // Update current CCI state
    useEffect(() => {
        setCurrentCCI({ cci, signals });
    }, [cci, signals]);

    // Main trading logic
    useEffect(() => {
        if (data5min.length < 21 || cci.length === 0) {
            return;
        }

        const currentPrice5min = data5min[data5min.length - 1].close;
        const currentTimestamp = data5min[data5min.length - 1].date;
        const latestCCI = cci[cci.length - 1];

        // Check for stop loss first
        if (position.type && position.stopLoss) {
            const shouldTriggerStopLoss = 
                (position.type === 'LONG' && currentPrice5min <= position.stopLoss) ||
                (position.type === 'SHORT' && currentPrice5min >= position.stopLoss);

            if (shouldTriggerStopLoss && !isTrading) {
                setIsTrading(true);
                
                const trade: Trade = {
                    type: position.type === 'LONG' ? 'SELL' : 'BUY',
                    price: currentPrice5min,
                    date: currentTimestamp,
                    quantity: 1,
                    strategy: 'CCI Strategy (Stop Loss)'
                };
                
                onTrade(trade);
                setPosition({ type: null, entryPrice: null, stopLoss: null });
                
                setTimeout(() => setIsTrading(false), 50);
                return;
            }
        }

        // CCI Momentum Strategy
        // BUY Signal: CCI > 100 (overbought momentum)
        // SELL Signal: CCI < -100 (oversold momentum)
        
        if (!position.type && !isTrading) {
            // Long Entry: CCI > 100 (momentum buy)
            if (latestCCI > 100) {
                setIsTrading(true);
                
                const stopLossPrice = currentPrice5min * 0.98; // 2% stop loss
                
                const trade: Trade = {
                    type: 'BUY',
                    price: currentPrice5min,
                    date: currentTimestamp,
                    quantity: 1,
                    strategy: 'CCI Strategy'
                };
                
                onTrade(trade);
                setPosition({
                    type: 'LONG',
                    entryPrice: currentPrice5min,
                    stopLoss: stopLossPrice
                });
                
                setTimeout(() => setIsTrading(false), 50);
            }
        }
        // Exit Logic
        else if (position.type && !isTrading) {
            let shouldExit = false;
            let exitReason = '';
            
            if (position.type === 'LONG' && position.entryPrice) {
                const profitPercent = ((currentPrice5min - position.entryPrice) / position.entryPrice) * 100;
                
                // Exit conditions for Long position
                if (latestCCI < -100) {
                    shouldExit = true;
                    exitReason = 'CCI Sell Signal';
                }
                // Take profit at 10%
                else if (profitPercent >= 10) {
                    shouldExit = true;
                    exitReason = 'Take Profit (10%)';
                }
            }
            
            if (shouldExit) {
                setIsTrading(true);
                
                const trade: Trade = {
                    type: position.type === 'LONG' ? 'SELL' : 'BUY',
                    price: currentPrice5min,
                    date: currentTimestamp,
                    quantity: 1,
                    strategy: `CCI Strategy (${exitReason})`
                };
                
                onTrade(trade);
                setPosition({ type: null, entryPrice: null, stopLoss: null });
                
                setTimeout(() => setIsTrading(false), 50);
            }
        }
    }, [data5min, cci, position, isTrading, onTrade]);

    return (
        <div className="space-y-4">
            {/* CCI Chart */}
            <CCIChart 
                cci={currentCCI.cci.map((value, index) => ({
                    timestamp: data5min[index + 20]?.date || '', // Adjust for period offset
                    value: value
                }))}
            />

            {/* CCI Strategy Status */}
            <div className="bg-gray-900 p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-4 text-white">CCI Momentum Strategy</h3>
                <div className="space-y-4 text-white">
                    
                    {/* CCI Indicator */}
                    <div className="bg-gray-800 p-3 rounded">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">CCI Indicator (5min)</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span>Current CCI:</span>
                                <span className={
                                    currentCCI.cci.length > 0 ? 
                                        currentCCI.cci[currentCCI.cci.length - 1] > 200 ? 'text-red-400 font-bold' :
                                        currentCCI.cci[currentCCI.cci.length - 1] < -200 ? 'text-green-400 font-bold' :
                                        'text-yellow-400' : 'text-gray-400'
                                }>
                                    {currentCCI.cci.length > 0 ? 
                                        currentCCI.cci[currentCCI.cci.length - 1].toFixed(2) : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Trend Status:</span>
                                <span className={
                                    currentCCI.cci.length > 0 ? 
                                        currentCCI.cci[currentCCI.cci.length - 1] > 100 ? 'text-red-400 font-bold' :
                                        currentCCI.cci[currentCCI.cci.length - 1] < -100 ? 'text-green-400 font-bold' :
                                        'text-blue-400' : 'text-gray-400'
                                }>
                                    {currentCCI.cci.length > 0 ? 
                                        currentCCI.cci[currentCCI.cci.length - 1] > 100 ? 'Overbought 🔴' :
                                        currentCCI.cci[currentCCI.cci.length - 1] < -100 ? 'Oversold 🟢' :
                                        'Normal Range 🔵' : 'Calculating...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Position Status */}
                    <div className="bg-gray-800 p-3 rounded">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Position Status</h4>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Position:</span>
                                <span className={position.type ? 
                                    position.type === 'LONG' ? 'text-green-400 font-bold' : 'text-red-400 font-bold' 
                                    : 'text-gray-400'}>
                                    {position.type ? `${position.type} @ ₹${position.entryPrice?.toFixed(2)}` : 'No Position'}
                                </span>
                            </div>
                            {position.stopLoss && (
                                <div className="flex justify-between">
                                    <span>Stop Loss:</span>
                                    <span className="text-red-400">₹{position.stopLoss.toFixed(2)}</span>
                                </div>
                            )}
                            {position.entryPrice && currentPrice && (
                                <div className="flex justify-between">
                                    <span>Current P&L:</span>
                                    <span className={
                                        position.type === 'LONG' ? 
                                            (currentPrice > position.entryPrice ? 'text-green-400' : 'text-red-400') :
                                            (currentPrice < position.entryPrice ? 'text-green-400' : 'text-red-400')
                                    }>
                                        {position.type === 'LONG' ? 
                                            `₹${(currentPrice - position.entryPrice).toFixed(2)} (${(((currentPrice - position.entryPrice) / position.entryPrice) * 100).toFixed(2)}%)` :
                                            `₹${(position.entryPrice - currentPrice).toFixed(2)} (${(((position.entryPrice - currentPrice) / position.entryPrice) * 100).toFixed(2)}%)`
                                        }
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Strategy Rules */}
                    <div className="bg-gray-800 p-3 rounded">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Strategy Rules</h4>
                        <div className="text-xs space-y-1">
                            <div>🟢 <strong>Buy Signal:</strong> CCI &gt; +100 (Overbought Momentum)</div>
                            <div>🔴 <strong>Sell Signal:</strong> CCI &lt; -100 (Oversold Exit)</div>
                            <div>🎯 <strong>Take Profit:</strong> 10% profit</div>
                            <div>🛑 <strong>Stop Loss:</strong> 2% from entry price</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// CCI Calculation Function
const calculateCCI = (data: Candle[], period: number): number[] => {
    if (data.length < period) {
        return [];
    }

    const cci: number[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        
        // Calculate Typical Price for each candle
        const typicalPrices = slice.map(candle => (candle.high + candle.low + candle.close) / 3);
        
        // Calculate SMA of Typical Prices
        const smaTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
        
        // Calculate Mean Deviation
        const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
        
        // Calculate CCI
        const currentTP = typicalPrices[typicalPrices.length - 1];
        const cciValue = meanDeviation === 0 ? 0 : (currentTP - smaTP) / (0.015 * meanDeviation);
        
        cci.push(cciValue);
    }
    
    return cci;
};

// Detect CCI Signals
const detectCCISignals = (cci: number[], data: Candle[]): { date: string; type: string; value: number }[] => {
    const signals: { date: string; type: string; value: number }[] = [];
    
    for (let i = 1; i < cci.length; i++) {
        const current = cci[i];
        const previous = cci[i - 1];
        const dataIndex = i + 19; // Adjust for period offset
        
        if (dataIndex < data.length) {
            // Extreme Oversold Signal
            if (previous >= -100 && current < -100) {
                signals.push({
                    date: data[dataIndex].date,
                    type: 'EXTREME_OVERSOLD',
                    value: current
                });
            }
            // Extreme Overbought Signal
            else if (previous <= 200 && current > 200) {
                signals.push({
                    date: data[dataIndex].date,
                    type: 'EXTREME_OVERBOUGHT',
                    value: current
                });
            }
        }
    }
    
    return signals;
}; 