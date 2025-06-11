const axios = require('axios');

async function testOptionsAPI() {
    try {
        // Replace this with your actual access token from the browser
        const accessToken = "fH1Whe43YBL9wISaZ8ffF5ZJHcWzpM7f";

        if (!accessToken) {
            throw new Error('No access token found');
        }

        console.log('Using access token');

        const underlying = 'NIFTY';  // or 'BANKNIFTY'
        const currentPrice = 22000;  // Replace with actual price
        const expiry = '2024-06-04'; // Updated to a more recent expiry

        // Calculate strikes around the current price
        const strikes = Array.from({ length: 10 }, (_, i) => 
            Math.round(currentPrice / 100) * 100 + (i - 5) * 100
        );

        console.log('Testing options API with params:', {
            underlying,
            expiry,
            strikes,
            fromDate: '2024-06-02',
            toDate: '2024-06-04'
        });

        const response = await axios.post('http://localhost:3000/api/options', {
            underlying,
            expiry,
            strikes,
            fromDate: '2024-03-27',
            toDate: '2024-03-28',
            interval: 'minute',
            exchange: 'NFO'
        }, {
            headers: {
                'Cookie': `kite_access_token=${accessToken}`
            }
        });

        console.log('API Response:', {
            status: response.status,
            data: response.data
        });

    } catch (error) {
        console.error('Error:', {
            message: error.message,
            response: error.response?.data
        });
    }
}

testOptionsAPI(); 