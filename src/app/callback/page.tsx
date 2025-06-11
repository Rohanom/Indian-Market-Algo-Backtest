'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CallbackPage() {
    const [status, setStatus] = useState('Processing...');
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the request token from URL
                const urlParams = new URLSearchParams(window.location.search);
                const requestToken = urlParams.get('request_token');

                if (!requestToken) {
                    setStatus('No request token found');
                    return;
                }

                // Send the request token to our API
                const response = await fetch(`/api/auth?request_token=${requestToken}`);
                const data = await response.json();

                if (response.ok) {
                    setStatus('Login successful! Redirecting...');
                    // Close this tab and refresh the main window
                    if (window.opener) {
                        window.opener.location.reload();
                        window.close();
                    } else {
                        // If no opener (direct access), redirect to home
                        router.push('/');
                    }
                } else {
                    setStatus('Login failed: ' + (data.error || 'Unknown error'));
                    console.error('Login failed:', data);
                }
            } catch (error) {
                setStatus('Error processing login');
                console.error('Login error:', error);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-4">Processing Login</h1>
                <p className="text-gray-600">{status}</p>
            </div>
        </div>
    );
} 