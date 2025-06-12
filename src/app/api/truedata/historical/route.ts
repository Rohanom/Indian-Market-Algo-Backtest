// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

// Import TrueData historical API (CommonJS)
const { historical } = require('truedata-nodejs');

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, from, to, interval = '1min' } = body;
        
        console.log(`📊 Historical data request:`, { symbol, from, to, interval });

        // Validate required parameters
        if (!symbol || !from || !to) {
            return NextResponse.json(
                {
                    status: 'error',
                    message: 'Missing required parameters: symbol, from, to',
                    example: {
                        symbol: 'NIFTY-I',
                        from: '2024-06-10 09:15:00',
                        to: '2024-06-10 15:30:00',
                        interval: '1min'
                    },
                    timestamp: new Date().toISOString()
                },
                { status: 400 }
            );
        }

        const username = process.env.TRUEDATA_USERNAME;
        const password = process.env.TRUEDATA_PASSWORD;

        if (!username || !password) {
            return NextResponse.json(
                {
                    status: 'error',
                    message: 'TrueData credentials not configured',
                    timestamp: new Date().toISOString()
                },
                { status: 500 }
            );
        }

        // Authenticate with TrueData
        console.log('🔐 Authenticating with TrueData...');
        historical.auth(username, password);
        
        // Fetch historical data
        console.log(`📈 Fetching data for ${symbol}...`);
        const data = await historical.getBarData(symbol, from, to, interval);
        
        console.log(`✅ Retrieved ${data ? data.length || 0 : 0} data points`);

        return NextResponse.json({
            status: 'success',
            symbol,
            interval,
            from,
            to,
            dataPoints: data ? data.length || 0 : 0,
            data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching historical data:', error);
        return NextResponse.json(
            {
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

// GET endpoint for documentation
export async function GET() {
    return NextResponse.json({
        title: 'TrueData Historical Data API',
        description: 'Fetch historical bar data from TrueData',
        method: 'POST',
        parameters: {
            symbol: 'Stock/Index symbol (e.g., NIFTY-I, RELIANCE)',
            from: 'Start datetime (YYYY-MM-DD HH:MM:SS)',
            to: 'End datetime (YYYY-MM-DD HH:MM:SS)',
            interval: 'Data interval (1min, 5min, 15min, 30min, 1hour, 1day)'
        },
        example: {
            symbol: 'NIFTY-I',
            from: '2024-06-10 09:15:00',
            to: '2024-06-10 15:30:00',
            interval: '1min'
        },
        supportedSymbols: {
            indices: ['NIFTY-I', 'BANKNIFTY-I', 'SENSEX-I', 'BANKEX-I'],
            stocks: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
            futures: ['NIFTY24JANFUT', 'BANKNIFTY24JANFUT'],
            options: ['NIFTY2431818000CE', 'NIFTY2431818000PE']
        },
        timestamp: new Date().toISOString()
    });
} 