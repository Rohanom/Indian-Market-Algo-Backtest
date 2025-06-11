import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { kiteService } from '@/services/kiteService';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const underlying = searchParams.get('underlying');
        const expiry = searchParams.get('expiry');

        // Input validation
        if (!underlying || !expiry) {
            return NextResponse.json(
                { error: 'Missing required parameters: underlying, expiry' },
                { status: 400 }
            );
        }

        // Get access token from cookies
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('kite_access_token')?.value;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Kite API credentials not configured' },
                { status: 401 }
            );
        }

        try {
            const data = await kiteService.getLiveOptionsData(
                accessToken,
                underlying,
                expiry
            );
            return NextResponse.json(data);
        } catch (error: any) {
            console.error('Live Options API error:', error);
            return NextResponse.json(
                { error: error.message || 'Failed to fetch live option chain' },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Live Options API error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to fetch live option chain',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
} 