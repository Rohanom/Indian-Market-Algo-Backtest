// @ts-nocheck
const fs = require('fs');

// Load credentials
const envFile = fs.readFileSync('.env', 'utf8');
const username = envFile.match(/TRUEDATA_USERNAME=(.+)/)?.[1];
const password = envFile.match(/TRUEDATA_PASSWORD=(.+)/)?.[1];

console.log('🔍 Quick API Test');
console.log('================');
console.log('Username:', username);

try {
    const { historical } = require('truedata-nodejs');
    
    console.log('🔐 Auth...');
    historical.auth(username, password);
    
    console.log('📊 Testing with corrected format...');
    
    // Test with the exact format that worked in sandbox
    historical.getBarData('NIFTY25052924000CE', '250520T00:00:00', '250525T18:35:00', '5min')
        .then(data => {
            console.log('✅ Result:', typeof data, Array.isArray(data) ? `Array[${data.length}]` : data);
            if (data && data.length > 0) {
                console.log('Sample:', data[0]);
            }
        })
        .catch(error => {
            console.log('❌ Error:', error.message);
        });
        
} catch (error) {
    console.log('❌ Package error:', error.message);
} 