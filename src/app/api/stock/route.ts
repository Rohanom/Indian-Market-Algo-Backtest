import { NextResponse } from 'next/server';
import { kiteService } from '../../../services/kiteService';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('kite_access_token')?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'No access token found' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { searchParams } = new URL(request.url);
        const instrumentToken = searchParams.get('instrumentToken');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');
        const interval = searchParams.get('interval') as 'day' | 'minute' | '3minute' | '5minute' | '10minute' | '15minute' | '30minute' | '60minute' || '5minute';
        const timeframes = searchParams.get('timeframes')?.split(',') as ('5minute' | '15minute')[];

        console.log('Request parameters:', {
            instrumentToken,
            fromDate,
            toDate,
            interval,
            timeframes,
            url: request.url
        });

        if (!instrumentToken || !fromDate || !toDate) {
            console.log('Missing required parameters:', {
                hasInstrumentToken: !!instrumentToken,
                hasFromDate: !!fromDate,
                hasToDate: !!toDate
            });
            return NextResponse.json(
                { 
                    error: 'Missing required parameters',
                    details: {
                        instrumentToken: !instrumentToken,
                        fromDate: !fromDate,
                        toDate: !toDate
                    }
                },
                { status: 400 }
            );
        }

        try {
            // If timeframes are specified, fetch data for all timeframes
            if (timeframes && timeframes.length > 0) {
                const dataPromises = timeframes.map(tf => 
                    kiteService.getHistoricalData(
                        accessToken,
                        instrumentToken,
                        fromDate,
                        toDate,
                        tf
                    )
                );

                const results = await Promise.all(dataPromises);
                const responseData = timeframes.reduce((acc, tf, index) => {
                    acc[tf] = results[index];
                    return acc;
                }, {} as Record<string, any>);

                return NextResponse.json(responseData);
            }

            // Single timeframe request
            console.log('Calling kiteService.getHistoricalData with:', {
                instrumentToken,
                fromDate,
                toDate,
                interval
            });
            
            const data = await kiteService.getHistoricalData(
                accessToken,
                instrumentToken,
                fromDate,
                toDate,
                interval
            );
            return NextResponse.json(data);
        } catch (kiteError: any) {
            console.error('Kite API error:', kiteError);
            return NextResponse.json(
                { 
                    error: 'Failed to fetch stock data',
                    details: kiteError.message || 'Unknown error'
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error in stock API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 