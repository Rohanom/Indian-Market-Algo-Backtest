import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (code) {
            console.log('Received auth code:', code);
            
            // Exchange code for access token
            const tokenResponse = await fetch('https://api.upstox.com/v2/login/authorization/token', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    code: code,
                    client_id: process.env.UPSTOX_API_KEY!,
                    client_secret: process.env.UPSTOX_API_SECRET!,
                    redirect_uri: 'http://localhost:3000/api/auth/upstox',
                    grant_type: 'authorization_code',
                }),
            });

            if (!tokenResponse.ok) {
                const error = await tokenResponse.json();
                console.error('Token exchange failed:', error);
                return NextResponse.json({ error: 'Failed to exchange code for token' }, { status: 500 });
            }

            const tokenData = await tokenResponse.json();
            console.log('Received token data:', tokenData);
            
            // Store the token using the token/upstox endpoint
            const storeResponse = await fetch('http://localhost:3000/api/token/upstox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accessToken: tokenData.access_token }),
            });

            if (!storeResponse.ok) {
                console.error('Failed to store token:', await storeResponse.text());
                throw new Error('Failed to store token');
            }

            console.log('Token stored successfully');
            // Redirect back to home page
            return NextResponse.redirect(new URL('/', request.url));
        }

        // If no code, return the login URL
        const loginURL = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.UPSTOX_API_KEY}&redirect_uri=http://localhost:3000/api/auth/upstox`;
        return NextResponse.json({ loginURL });
    } catch (error) {
        console.error('Upstox auth error:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
} 