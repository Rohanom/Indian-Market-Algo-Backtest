async function testLiveOptions(underlying = 'NIFTY') {
    try {
        // Get the current date and next Thursday's date for expiry
        const today = new Date();
        const nextThursday = new Date(today);
        nextThursday.setDate(today.getDate() + (4 + 7 - today.getDay()) % 7);
        const expiry = nextThursday.toISOString().split('T')[0];

        console.log(`Testing live options API for ${underlying}:`, {
            underlying,
            expiry,
            date: new Date().toLocaleString()
        });

        const response = await fetch(`/api/live-options?underlying=${underlying}&expiry=${expiry}`);
        const data = await response.json();

        if (data.error) {
            console.error('API Error:', {
                message: data.error,
                details: data.details || 'No additional details available'
            });
            return;
        }

        if (!data.optionChain || data.optionChain.length === 0) {
            console.error('No option chain data received:', data);
            return;
        }

        // Log raw data for debugging
        console.log(`Raw API Response for ${underlying}:`, data);

        console.log(`${underlying} Options Data Summary:`, {
            underlying: data.underlying,
            expiry: data.expiry,
            timestamp: data.timestamp,
            totalStrikes: data.strikes.length,
            strikes: data.strikes,
            firstStrike: data.optionChain[0]
        });

        // Log all strikes with their call and put prices
        data.optionChain.forEach(strike => {
            console.log(`${underlying} Strike ${strike.strike}:`, {
                'CE': strike.call ? {
                    LTP: strike.call.ltp,
                    Volume: strike.call.volume,
                    OI: strike.call.oi,
                    'Bid/Ask': `${strike.call.bid}/${strike.call.ask}`,
                    'Change': `${strike.call.change.toFixed(2)} (${strike.call.changePercent.toFixed(2)}%)`
                } : 'N/A',
                'PE': strike.put ? {
                    LTP: strike.put.ltp,
                    Volume: strike.put.volume,
                    OI: strike.put.oi,
                    'Bid/Ask': `${strike.put.bid}/${strike.put.ask}`,
                    'Change': `${strike.put.change.toFixed(2)} (${strike.put.changePercent.toFixed(2)}%)`
                } : 'N/A'
            });
        });

    } catch (error) {
        console.error('Error testing live options:', {
            message: error.message,
            stack: error.stack
        });
    }
}

// Test both NIFTY and BANKNIFTY
async function testAllOptionChains() {
    console.log('Testing all option chains...');
    await testLiveOptions('NIFTY');
    // await testLiveOptions('BANKNIFTY');
}

// Run the test
testAllOptionChains(); 