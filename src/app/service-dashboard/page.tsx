'use client';

import { useState, useEffect } from 'react';

interface ServiceStatus {
    name: string;
    url: string;
    status: 'running' | 'stopped' | 'error';
    data?: any;
    error?: string;
}

export default function ServiceDashboard() {
    const [services, setServices] = useState<ServiceStatus[]>([
        { name: 'TrueData Service', url: 'http://localhost:3001/health', status: 'stopped' },
        { name: 'Next.js API (via TrueData Service)', url: '/api/truedata/nifty-options', status: 'stopped' }
    ]);
    const [testResult, setTestResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const checkServiceStatus = async (service: ServiceStatus, index: number) => {
        try {
            const response = await fetch(service.url);
            const data = await response.json();
            
            setServices(prev => prev.map((s, i) => 
                i === index ? { 
                    ...s, 
                    status: 'running', 
                    data,
                    error: undefined 
                } : s
            ));
        } catch (error) {
            setServices(prev => prev.map((s, i) => 
                i === index ? { 
                    ...s, 
                    status: 'error', 
                    error: error instanceof Error ? error.message : 'Unknown error',
                    data: undefined 
                } : s
            ));
        }
    };

    const checkAllServices = async () => {
        setLoading(true);
        
        // Check TrueData service
        await checkServiceStatus(services[0], 0);
        
        // Wait a bit then check Next.js API
        setTimeout(async () => {
            await checkServiceStatus(services[1], 1);
            setLoading(false);
        }, 500);
    };

    const testNiftyOptions = async () => {
        setLoading(true);
        setTestResult(null);
        
        try {
            const response = await fetch('/api/truedata/nifty-options', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tradingDate: '2025-06-11',
                    strike: 23500,
                    optionType: 'CE',
                    interval: '1min'
                })
            });
            
            const data = await response.json();
            setTestResult(data);
        } catch (error) {
            setTestResult({
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAllServices();
    }, []);

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Service Dashboard</h1>
            
            {/* Service Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {services.map((service, index) => (
                    <div key={service.name} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{service.name}</h2>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                service.status === 'running' ? 'bg-green-100 text-green-800' :
                                service.status === 'error' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                                {service.status === 'running' ? '🟢 Running' :
                                 service.status === 'error' ? '🔴 Error' :
                                 '⚫ Unknown'}
                            </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{service.url}</p>
                        
                        {service.status === 'running' && service.data && (
                            <div className="bg-green-50 dark:bg-green-900 p-3 rounded">
                                <p className="text-sm text-green-800 dark:text-green-200">
                                    ✅ Service: {service.data.service || 'API Available'}
                                </p>
                                {service.data.credentials && (
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                        Username: {service.data.credentials.username}
                                    </p>
                                )}
                            </div>
                        )}
                        
                        {service.status === 'error' && (
                            <div className="bg-red-50 dark:bg-red-900 p-3 rounded">
                                <p className="text-sm text-red-800 dark:text-red-200">❌ {service.error}</p>
                                {service.name === 'TrueData Service' && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                        Start with: cd truedata-service && npm start
                                    </p>
                                )}
                            </div>
                        )}
                        
                        <button
                            onClick={() => checkServiceStatus(service, index)}
                            disabled={loading}
                            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 text-sm"
                        >
                            Recheck
                        </button>
                    </div>
                ))}
            </div>
            
            {/* Test Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Test Complete Integration</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This will test the full flow: Frontend → Next.js API → TrueData Service → TrueData API
                </p>
                
                <div className="flex space-x-4 mb-4">
                    <button
                        onClick={checkAllServices}
                        disabled={loading}
                        className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400"
                    >
                        {loading ? 'Checking...' : 'Check All Services'}
                    </button>
                    
                    <button
                        onClick={testNiftyOptions}
                        disabled={loading}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                    >
                        {loading ? 'Testing...' : 'Test NIFTY Options'}
                    </button>
                </div>
                
                {testResult && (
                    <div className={`p-4 rounded ${
                        testResult.status === 'success' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                    }`}>
                        <h3 className={`font-semibold ${
                            testResult.status === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                        }`}>
                            Integration Test {testResult.status === 'success' ? 'Successful!' : 'Failed'}
                        </h3>
                        
                        {testResult.status === 'success' && (
                            <div className="text-sm mt-2 text-green-700 dark:text-green-300 space-y-1">
                                <p><strong>Symbol:</strong> {testResult.symbol}</p>
                                <p><strong>Data Points:</strong> {testResult.dataPoints}</p>
                                <p><strong>API Status:</strong> {testResult.apiStatus}</p>
                                <p><strong>Service Used:</strong> {testResult.serviceUsed}</p>
                                <p><strong>From:</strong> {testResult.fromDate} <strong>To:</strong> {testResult.toDate}</p>
                            </div>
                        )}
                        
                        {testResult.status === 'error' && (
                            <p className="text-sm mt-2 text-red-700 dark:text-red-300">
                                {testResult.message}
                            </p>
                        )}
                    </div>
                )}
            </div>
            
            {/* Quick Links */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Quick Links</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <a 
                        href="/nifty-options-test" 
                        className="bg-blue-500 text-white px-4 py-2 rounded text-center hover:bg-blue-600"
                    >
                        NIFTY Options Test
                    </a>
                    <a 
                        href="/truedata-test" 
                        className="bg-green-500 text-white px-4 py-2 rounded text-center hover:bg-green-600"
                    >
                        TrueData Test
                    </a>
                    <a 
                        href="http://localhost:3001/health" 
                        target="_blank"
                        className="bg-purple-500 text-white px-4 py-2 rounded text-center hover:bg-purple-600"
                    >
                        Service Health
                    </a>
                    <a 
                        href="http://localhost:3001/auth/test" 
                        target="_blank"
                        className="bg-orange-500 text-white px-4 py-2 rounded text-center hover:bg-orange-600"
                    >
                        Direct Auth Test
                    </a>
                </div>
            </div>
        </div>
    );
} 