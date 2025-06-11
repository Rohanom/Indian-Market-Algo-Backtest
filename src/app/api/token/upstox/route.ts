import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('upstox_access_token');
        console.log('Checking for token in cookies:', token);
        
        if (!token) {
            return NextResponse.json({ error: 'No access token found' }, { status: 401 });
        }

        return NextResponse.json({ accessToken: token.value });
    } catch (error) {
        console.error('Error getting token:', error);
        return NextResponse.json({ error: 'Failed to get token' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { accessToken } = await request.json();
        console.log('Received token to store:', accessToken ? 'Token present' : 'No token');
        
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

        console.log('Token stored in cookie');
        return response;
    } catch (error) {
        console.error('Error storing token:', error);
        return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });
    }
}

// Temporary method for manual token setting
export async function PUT(request: Request) {
    try {
        const { accessToken } = await request.json();
        console.log('Manually setting token:', accessToken ? 'Token present' : 'No token');
        
        if (!accessToken) {
            return NextResponse.json({ error: 'No access token provided' }, { status: 400 });
        }

        // Store the access token in a cookie
        const response = NextResponse.json({ message: 'Token manually set successfully' });
        response.cookies.set('upstox_access_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 86400, // 24 hours
        });

        console.log('Token manually set in cookie');
        return response;
    } catch (error) {
        console.error('Error manually setting token:', error);
        return NextResponse.json({ error: 'Failed to manually set token' }, { status: 500 });
    }
} 