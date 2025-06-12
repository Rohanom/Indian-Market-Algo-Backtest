'use client';

import { useState } from 'react';

interface HistoricalData {
    status: string;
    symbol?: string;
    interval?: string;
    from?: string;
    to?: string;
    dataPoints?: number;
    data?: any[];
    message?: string;
    timestamp: string;
}

export default function TrueDataTest() {
    const [authResult, setAuthResult] = useState<any>(null);
    const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form data for historical request
    const [symbol, setSymbol] = useState('NIFTY-I');
    const [fromDate, setFromDate] = useState('2024-06-10 09:15:00');
    const [toDate, setToDate] = useState('2024-06-10 15:30:00');
    const [interval, setInterval] = useState('1min');

    const testAuth = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/truedata/auth');
            const data = await response.json();
            
            if (data.status === 'success') {
                setAuthResult(data);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Failed to test authentication');
            console.error('Auth test error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoricalData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/truedata/historical', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbol,
                    from: fromDate,
                    to: toDate,
                    interval
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                setHistoricalData(data);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Failed to fetch historical data');
            console.error('Historical data error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">TrueData API Test</h1>
            
            {/* Authentication Test */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Authentication Test</h2>
                
                <button
                    onClick={testAuth}
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                    {loading ? 'Testing...' : 'Test Authentication'}
                </button>
                
                {authResult && (
                    <div className="mt-4 p-4 bg-green-100 rounded">
                        <h3 className="font-semibold text-green-800">Authentication Successful!</h3>
                        <pre className="text-sm mt-2 text-green-700">
                            {JSON.stringify(authResult, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {/* Historical Data Test */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Historical Data Test</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Symbol</label>
                        <select 
                            value={symbol} 
                            onChange={(e) => setSymbol(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                        >
                            <option value="NIFTY-I">NIFTY-I</option>
                            <option value="BANKNIFTY-I">BANKNIFTY-I</option>
                            <option value="RELIANCE">RELIANCE</option>
                            <option value="TCS">TCS</option>
                            <option value="INFY">INFY</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">Interval</label>
                        <select 
                            value={interval} 
                            onChange={(e) => setInterval(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                        >
                            <option value="1min">1 Minute</option>
                            <option value="5min">5 Minutes</option>
                            <option value="15min">15 Minutes</option>
                            <option value="30min">30 Minutes</option>
                            <option value="1hour">1 Hour</option>
                            <option value="1day">1 Day</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">From Date</label>
                        <input
                            type="text"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                            placeholder="YYYY-MM-DD HH:MM:SS"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">To Date</label>
                        <input
                            type="text"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                            placeholder="YYYY-MM-DD HH:MM:SS"
                        />
                    </div>
                </div>
                
                <button
                    onClick={fetchHistoricalData}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                    {loading ? 'Fetching...' : 'Fetch Historical Data'}
                </button>
                
                {historicalData && (
                    <div className="mt-4 p-4 bg-green-100 rounded">
                        <h3 className="font-semibold text-green-800">
                            Historical Data Retrieved! ({historicalData.dataPoints} data points)
                        </h3>
                        <div className="text-sm mt-2 text-green-700">
                            <p><strong>Symbol:</strong> {historicalData.symbol}</p>
                            <p><strong>Interval:</strong> {historicalData.interval}</p>
                            <p><strong>From:</strong> {historicalData.from}</p>
                            <p><strong>To:</strong> {historicalData.to}</p>
                        </div>
                        
                        {historicalData.data && historicalData.data.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold mb-2">Sample Data (First 5 records):</h4>
                                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                    {JSON.stringify(historicalData.data.slice(0, 5), null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* API Endpoints Info */}
            <div className="bg-gray-100 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Available API Endpoints</h2>
                <div className="space-y-2 text-sm">
                    <div>
                        <code className="bg-blue-100 px-2 py-1 rounded">GET /api/truedata/auth</code>
                        <span className="ml-2">- Test authentication</span>
                    </div>
                    <div>
                        <code className="bg-green-100 px-2 py-1 rounded">POST /api/truedata/historical</code>
                        <span className="ml-2">- Fetch historical data</span>
                    </div>
                    <div>
                        <code className="bg-purple-100 px-2 py-1 rounded">GET /api/truedata/historical</code>
                        <span className="ml-2">- API documentation</span>
                    </div>
                </div>
            </div>
        </div>
    );
} 