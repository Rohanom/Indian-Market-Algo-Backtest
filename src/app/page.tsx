'use client';

import { useState, useEffect, useCallback } from 'react';
import { BacktestSimulator } from '../components/BacktestSimulator';
import { AdvancedChart } from '../components/AdvancedChart';
import { LoginButton } from '../components/LoginButton';
import { fetchHistoricalData } from '../utils/kiteApi';
import { UpstoxLoginButton } from '@/components/upstoxLoginButton';
import { useRouter } from 'next/navigation';

type Timeframe = 'minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day';
type ViewMode = 'chart' | 'simulation';

interface StockData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface Stock {
    instrument_token: number;
    tradingsymbol: string;
}

export default function Home() {
    const router = useRouter();
    const [stockData, setStockData] = useState<StockData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5minute');
    const [viewMode, setViewMode] = useState<ViewMode>('chart');
    const [startDate, setStartDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [availableStocks, setAvailableStocks] = useState<Stock[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedStock, setSelectedStock] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [accessToken, setAccessToken] = useState<string>('');
    const [instrumentToken, setInstrumentToken] = useState('');

    // Connection status states
    const [isKiteConnected, setIsKiteConnected] = useState(false);
    const [isUpstoxConnected, setIsUpstoxConnected] = useState(false);

    // Calculate valid date range based on timeframe
    const getValidDateRange = (timeframe: Timeframe) => {
        const today = new Date();
        const daysToSubtract = timeframe === 'minute' ? 60 : 100;
        const minDate = new Date(today);
        minDate.setDate(today.getDate() - daysToSubtract);
        
        return {
            min: minDate.toISOString().split('T')[0],
            max: today.toISOString().split('T')[0]
        };
    };

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchAccessToken();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Fetch stock data
    const fetchStockData = async (timeframe = selectedTimeframe, fromDate?: string, stockSymbol?: string) => {
        try {
            setLoading(true);
            setError('');
            
            console.log('Fetching instruments...');
            const instrumentsResponse = await fetch('/api/instruments');
            if (!instrumentsResponse.ok) {
                throw new Error('Failed to fetch instruments');
            }
            const instruments = await instrumentsResponse.json();
            
            setAvailableStocks(instruments);
            
            const targetSymbol = stockSymbol || 'NIFTY 50';
            const selectedInstrument = instruments.find((inst: any) => inst.tradingsymbol === targetSymbol);
            
            if (!selectedInstrument) {
                throw new Error(`${targetSymbol} instrument not found`);
            }
            
            const instrumentToken = selectedInstrument.instrument_token;
            
            // Format current date to yyyy-mm-dd hh:mm:ss
            const now = new Date();
            const toDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            
            // Set date range based on timeframe or provided start date
            let fromDateStr: string;
            if (fromDate) {
                // For simulation mode, ensure we're using the correct date format
                const dateObj = new Date(fromDate);
                if (isNaN(dateObj.getTime())) {
                    throw new Error('Invalid date format');
                }
                fromDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
            } else {
                const daysToFetch = timeframe === 'minute' ? 60 : 100;
                const defaultDate = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);
                fromDateStr = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')} ${String(defaultDate.getHours()).padStart(2, '0')}:${String(defaultDate.getMinutes()).padStart(2, '0')}:${String(defaultDate.getSeconds()).padStart(2, '0')}`;
            }
            
            // console.log('Fetching data with date range:', { fromDateStr, toDate });
            
            const data = await fetchHistoricalData(instrumentToken, fromDateStr, toDate, timeframe);
            setStockData(data);
            setIsAuthenticated(true);
            setSelectedStock(targetSymbol);
            setInstrumentToken(instrumentToken);

        } catch (err: any) {
            console.error('Error in fetchStockData:', err);
            setError(`Failed to fetch stock data: ${err.response?.data?.details || err.message || 'Unknown error'}`);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    // Handle timeframe change
    const handleTimeframeChange = (timeframe: Timeframe) => {
        setSelectedTimeframe(timeframe);
        fetchStockData(timeframe);
    };

    // Handle start date change
    const handleStartDateChange = (date: string) => {
        if (!date) return;
        
        try {
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                throw new Error('Invalid date format');
            }
            
            const formattedDate = dateObj.toISOString().split('T')[0];
            setStartDate(formattedDate);
            fetchStockData(selectedTimeframe, formattedDate);
        } catch (error) {
            console.error('Error handling date change:', error);
            setError('Invalid date format');
        }
    };

    // Toggle view mode
    const toggleViewMode = (mode: ViewMode) => {
        setViewMode(mode);
    };

    // Handle stock selection
    const handleStockSelect = (stock: string) => {
        setSearchQuery(stock);
        setShowSuggestions(false);
        fetchStockData(selectedTimeframe, startDate, stock);
    };

    const filteredStocks = availableStocks.filter(stock => 
        stock.tradingsymbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Initialize component
    useEffect(() => {
        fetchStockData();
    }, []);

    // Dark mode detection
    useEffect(() => {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(darkModeMediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => {
            setIsDarkMode(e.matches);
        };

        darkModeMediaQuery.addEventListener('change', handleChange);
        return () => darkModeMediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Fetch access token
    const fetchAccessToken = async () => {
        try {
            const response = await fetch('/api/token');
            const data = await response.json();
            
            if (data.accessToken) {
                setAccessToken(data.accessToken);
                setIsAuthenticated(true);
                setIsKiteConnected(true);
                
                // Fetch available stocks
                const stockResponse = await fetch('/api/instruments');
                const stockData = await stockResponse.json();
                if (stockData && stockData.length > 0) {
                    setAvailableStocks(stockData);
                }
            }
        } catch (error) {
            console.error('Error fetching access token:', error);
            setIsAuthenticated(false);
            setIsKiteConnected(false);
        }
    };

    // Handle Upstox login
    const handleUpstoxLogin = async () => {
        try {
            const response = await fetch('/api/auth/upstox');
            const data = await response.json();
            if (data.loginURL) {
                window.location.href = data.loginURL;
            }
        } catch (error) {
            console.error('Error initiating Upstox login:', error);
        }
    };

    // // Test Upstox token
    // const testUpstoxToken = async () => {
    //     try {
    //         const response = await fetch('/api/token/upstox');
    //         const data = await response.json();
    //         console.log('Upstox Token Response:', data);
    //         if (data.accessToken) {
    //             console.log('Upstox token found:', data.accessToken);
    //         } else {
    //             console.log('No Upstox token found');
    //         }
    //     } catch (error) {
    //         console.error('Error checking Upstox token:', error);
    //     }
    // };

    // Initial data fetch
    useEffect(() => {
        fetchAccessToken();
    }, []);

    return (
        <main className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-white'}`}>
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Stock Backtesting
                    </h1>
                    <div className="flex space-x-4 items-center">
                        <div className="flex items-center space-x-2">
                            <LoginButton onLoginSuccess={fetchAccessToken} />
                            {isKiteConnected && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                    Kite Connected
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            <UpstoxLoginButton onLoginSuccess={handleUpstoxLogin} />
                            {isUpstoxConnected && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    Upstox Connected
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {!isAuthenticated ? (
                    <div className={`text-center py-12 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Please log in to access the application
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    placeholder="Search stocks..."
                                    className={`w-full p-2 rounded border ${
                                        isDarkMode 
                                            ? 'bg-gray-800 border-gray-700 text-white' 
                                            : 'bg-white border-gray-300'
                                    }`}
                                />
                                {showSuggestions && searchQuery && (
                                    <div className={`absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md shadow-lg ${
                                        isDarkMode ? 'bg-gray-800' : 'bg-white'
                                    }`}>
                                        {availableStocks
                                            .filter(stock => 
                                                stock.tradingsymbol.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map(stock => (
                                                <div
                                                    key={stock.instrument_token}
                                                    onClick={() => handleStockSelect(stock.tradingsymbol)}
                                                    className={`p-2 cursor-pointer hover:bg-gray-100 ${
                                                        isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {stock.tradingsymbol}
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>

                            {/* <select
                                value={selectedTimeframe}
                                onChange={(e) => handleTimeframeChange(e.target.value as Timeframe)}
                                className={`p-2 rounded border ${
                                    isDarkMode 
                                        ? 'bg-gray-800 border-gray-700 text-white' 
                                        : 'bg-white border-gray-300'
                                }`}
                            >
                                <option value="minute">1 Minute</option>
                                <option value="5minute">5 Minutes</option>
                                <option value="15minute">15 Minutes</option>
                                <option value="30minute">30 Minutes</option>
                                <option value="60minute">1 Hour</option>
                                <option value="day">1 Day</option>
                            </select> */}

                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                min={getValidDateRange(selectedTimeframe).min}
                                max={getValidDateRange(selectedTimeframe).max}
                                className={`p-2 rounded border ${
                                    isDarkMode 
                                        ? 'bg-gray-800 border-gray-700 text-white' 
                                        : 'bg-white border-gray-300'
                                }`}
                            />

                            <div className="flex space-x-2">
                                <button
                                    onClick={() => toggleViewMode('chart')}
                                    className={`px-4 py-2 rounded ${
                                        viewMode === 'chart'
                                            ? 'bg-blue-600 text-white'
                                            : isDarkMode
                                                ? 'bg-gray-700 text-gray-300'
                                                : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    Chart
                                </button>
                                <button
                                    onClick={() => toggleViewMode('simulation')}
                                    className={`px-4 py-2 rounded ${
                                        viewMode === 'simulation'
                                            ? 'bg-blue-600 text-white'
                                            : isDarkMode
                                                ? 'bg-gray-700 text-gray-300'
                                                : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    Simulation
                                </button>
                                <button
                                    onClick={() => router.push('/live')}
                                    className={`px-4 py-2 rounded ${
                                        isDarkMode
                                            ? 'bg-gray-700 text-gray-300'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    Live Trading
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className={`p-4 rounded ${
                                isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-700'
                            }`}>
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                Loading...
                            </div>
                        ) : (
                            <div className="mt-4">
                                {viewMode === 'chart' ? (
                                    <AdvancedChart
                                        data={stockData}
                                        title={selectedStock}
                                        onTimeframeChange={handleTimeframeChange}
                                        selectedTimeframe={selectedTimeframe}
                                    />
                                ) : (
                                    <BacktestSimulator
                                        historicalData={stockData}
                                        timeframe={selectedTimeframe}
                                        onTimeframeChange={handleTimeframeChange}
                                        selectedTimeframe={selectedTimeframe}
                                        selectedStock={selectedStock}
                                        instrumentToken={instrumentToken}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}