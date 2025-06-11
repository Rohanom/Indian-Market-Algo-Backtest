import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        console.log('=== Cookie Debug Session ===');
        console.log('Request URL:', request.url);
        console.log('Request headers:', Object.fromEntries(request.headers.entries()));
        
        // Method 1: Using Next.js cookies() helper
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        console.log('Method 1 - cookies() helper:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value, length: c.value?.length })));
        
        // Method 2: Using request headers directly
        const cookieHeader = request.headers.get('cookie');
        console.log('Method 2 - Raw cookie header:', cookieHeader);
        
        // Method 3: Parse cookies manually
        const parsedCookies: Record<string, string> = {};
        if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
                const [name, ...rest] = cookie.trim().split('=');
                if (name && rest.length > 0) {
                    parsedCookies[name] = rest.join('=');
                }
            });
        }
        console.log('Method 3 - Parsed cookies:', Object.keys(parsedCookies));
        
        // Method 4: Check specific cookie with different variations
        const variations = ['kite_access_token', 'kiteAccessToken', 'KITE_ACCESS_TOKEN', 'access_token'];
        let foundToken = null;
        let foundMethod = null;
        
        // Try with cookies() helper first (should work for httpOnly cookies)
        for (const variation of variations) {
            try {
                const cookie = cookieStore.get(variation);
                console.log(`Checking ${variation}:`, cookie ? 'Found' : 'Not found');
                if (cookie?.value) {
                    foundToken = cookie.value;
                    foundMethod = `cookies().get('${variation}')`;
                    console.log(`✅ Found token via ${foundMethod}, length: ${foundToken.length}`);
                    break;
                }
            } catch (cookieError) {
                console.log(`Error accessing cookie ${variation}:`, cookieError);
            }
        }
        
        // Try with parsed cookies if not found
        if (!foundToken) {
            for (const variation of variations) {
                if (parsedCookies[variation]) {
                    foundToken = parsedCookies[variation];
                    foundMethod = `Manual parsing - '${variation}'`;
                    console.log(`✅ Found token via ${foundMethod}, length: ${foundToken.length}`);
                    break;
                }
            }
        }
        
        console.log('Final result - Found token:', foundToken ? 'YES' : 'NO');
        console.log('Found method:', foundMethod);
        console.log('Token length:', foundToken?.length || 0);
        
        // Debug response
        const debugInfo = {
            method1_cookies: allCookies.map(c => c.name),
            method2_raw_header: cookieHeader || 'No cookie header',
            method3_parsed_keys: Object.keys(parsedCookies),
            method4_found_token: !!foundToken,
            method4_found_method: foundMethod,
            request_url: request.url,
            user_agent: request.headers.get('user-agent') || 'Unknown'
        };
        
        if (!foundToken) {
            return NextResponse.json({
                error: 'No access token found',
                debug: debugInfo,
                message: 'Token not found with any method. Please re-authenticate.'
            }, { status: 401 });
        }
        
        // Validate token format
        if (foundToken.length < 10) {
            return NextResponse.json({
                error: 'Invalid access token format',
                tokenLength: foundToken.length,
                debug: debugInfo
            }, { status: 401 });
        }
        
        return NextResponse.json({
            accessToken: foundToken,
            success: true,
            method: foundMethod,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting access token:', error);
        return NextResponse.json({
            error: 'Failed to get access token',
            details: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
} 