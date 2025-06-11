import { NextResponse } from 'next/server';
import { kiteService } from '../../../services/kiteService';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestToken = searchParams.get('request_token');

        if (!requestToken) {
            // If no request token, return the login URL
            const loginURL = kiteService.getLoginURL();
            return NextResponse.json({ loginURL });
        }

        // Generate session with request token
        const response = await kiteService.generateSession(requestToken);
        
        // Store the access token in cookies
        const cookieStore = await cookies();
        
        // Store secure HTTP-only cookie for server-side use
        cookieStore.set('kite_access_token', response.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/', // Explicitly set path to root
            maxAge: 60 * 60 * 24, // 1 day
        });
        
        // Store client-accessible cookie for frontend use
        cookieStore.set('kite_access_token_client', response.access_token, {
            httpOnly: false, // Allow JavaScript access
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        console.log('✅ Access token cookie set successfully');

        return NextResponse.json({
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Error in auth:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        );
    }
} 