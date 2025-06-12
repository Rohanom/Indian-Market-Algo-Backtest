// @ts-nocheck
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

// Import TrueData historical API (CommonJS)
const { historical } = require('truedata-nodejs');

export async function GET() {
    try {
        const username = process.env.TRUEDATA_USERNAME;
        const password = process.env.TRUEDATA_PASSWORD;

        if (!username || !password) {
            return NextResponse.json(
                {
                    status: 'error',
                    message: 'TrueData credentials not configured',
                    timestamp: new Date().toISOString()
                },
                { status: 400 }
            );
        }

        console.log('🔐 Testing TrueData authentication...');
        
        // Test authentication
        const authResult = historical.auth(username, password);
        console.log('✅ Authentication result:', authResult);

        return NextResponse.json({
            status: 'success',
            message: 'Authentication successful',
            username: username,
            timestamp: new Date().toISOString(),
            authResult: authResult
        });

    } catch (error) {
        console.error('❌ Authentication failed:', error);
        return NextResponse.json(
            {
                status: 'error',
                message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
} 