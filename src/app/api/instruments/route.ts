import { NextResponse } from 'next/server';
import { kiteService } from '../../../services/kiteService';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('kite_access_token')?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'No access token found' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        try {
            const instruments = await kiteService.getInstruments(accessToken);
            const nseInstruments = instruments.filter((inst: any) => inst.exchange === 'NSE');
            return new Response(JSON.stringify(nseInstruments), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Error fetching instruments:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch instruments' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
} 