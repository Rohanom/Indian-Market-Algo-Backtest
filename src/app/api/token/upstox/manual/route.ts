import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { accessToken } = await request.json();
        
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token provided' }, { status: 400 });
        }

        // Store the access token in a cookie
        const response = NextResponse.json({ message: 'Token stored successfully' });
        response.cookies.set('upstox_access_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 86400, // 24 hours
        });

        return response;
    } catch (error) {
        console.error('Error storing token:', error);
        return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });
    }
} 