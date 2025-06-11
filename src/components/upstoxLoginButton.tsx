'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface UpstoxLoginButtonProps {
    onLoginSuccess: () => void;
}

export const UpstoxLoginButton = ({ onLoginSuccess }: UpstoxLoginButtonProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            setLoading(true);
            setError('');
            
            // Get the login URL
            const response = await axios.get('/api/auth/upstox');
            const { loginURL } = response.data;
            
            // Redirect to Upstox login page
            window.location.href = loginURL;
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to initiate login');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpstoxCallback = async (code: string) => {
        try {
            setLoading(true);
            setError('');
            
            // Send authorization code to our API
            const response = await axios.get('/api/auth/upstox', {
                params: { code }
            });
            
            if (response.data.message === 'Login successful') {
                onLoginSuccess();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to complete login');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Check for authorization code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            handleUpstoxCallback(code);
        }
    }, []); // Empty dependency array means this runs once on mount

    return (
        <div className="text-center">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}
            
            <button
                onClick={handleLogin}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
                {loading ? 'Processing...' : 'Login with Upstox'}
            </button>
        </div>
    );
}; 