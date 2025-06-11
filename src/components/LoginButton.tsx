'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface LoginButtonProps {
    onLoginSuccess: () => void;
}

export const LoginButton = ({ onLoginSuccess }: LoginButtonProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            setLoading(true);
            setError('');
            
            // Get the login URL
            const response = await axios.get('/api/auth');
            const { loginURL } = response.data;
            
            // Redirect to Kite login page
            window.location.href = loginURL;
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to initiate login');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleKiteCallback = async (requestToken: string) => {
        try {
            setLoading(true);
            setError('');
            
            // Send request token to our API
            const response = await axios.get('/api/auth', {
                params: { request_token: requestToken }
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
        // Check for request token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const requestToken = urlParams.get('request_token');
        
        if (requestToken) {
            handleKiteCallback(requestToken);
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
                {loading ? 'Processing...' : 'Login with Kite'}
            </button>
        </div>
    );
}; 