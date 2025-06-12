const http = require('http');

const SERVICE_URL = 'http://localhost:3001';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVICE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(body);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing TrueData Service...\n');

    try {
        // Test 1: Health check
        console.log('1️⃣ Testing health endpoint...');
        const health = await makeRequest('/health');
        console.log(`Status: ${health.status}`);
        console.log(`Response:`, health.data);
        console.log('');

        // Test 2: Auth test
        console.log('2️⃣ Testing authentication...');
        const auth = await makeRequest('/auth/test');
        console.log(`Status: ${auth.status}`);
        console.log(`Response:`, auth.data);
        console.log('');

        // Test 3: NIFTY Options
        console.log('3️⃣ Testing NIFTY options endpoint...');
        const optionsData = {
            tradingDate: '2025-05-25',
            strike: 24000,
            optionType: 'CE',
            interval: '1min'
        };
        const options = await makeRequest('/nifty/options', 'POST', optionsData);
        console.log(`Status: ${options.status}`);
        console.log(`Symbol: ${options.data.symbol}`);
        console.log(`Data points: ${options.data.dataPoints}`);
        console.log(`From: ${options.data.fromDate}`);
        console.log(`To: ${options.data.toDate}`);
        console.log('');

        // Test 4: Custom symbol
        console.log('4️⃣ Testing custom symbol...');
        const customData = {
            tradingDate: '2025-06-10',
            customSymbol: 'NIFTY25061224000CE',
            interval: '5min'
        };
        const custom = await makeRequest('/nifty/options', 'POST', customData);
        console.log(`Status: ${custom.status}`);
        console.log(`Symbol: ${custom.data.symbol}`);
        console.log(`Data points: ${custom.data.dataPoints}`);
        console.log('');

        console.log('✅ All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('Make sure the service is running: npm start');
    }
}

// Check if service is running
console.log(`Checking if service is running on ${SERVICE_URL}...`);
runTests(); 