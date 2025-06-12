import { NextApiRequest, NextApiResponse } from 'next';

const TRUEDATA_SERVICE_URL = process.env.TRUEDATA_SERVICE_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { tradingDate, strike, optionType = 'CE', interval = '1min', customSymbol } = req.body;

    if (!tradingDate && !customSymbol) {
      return res.status(400).json({
        status: 'error',
        message: 'tradingDate or customSymbol required',
        example: {
          tradingDate: '2024-05-25',
          strike: 24000,
          optionType: 'CE',
          interval: '1min'
        }
      });
    }

    console.log('🔄 Forwarding request to TrueData service...');
    console.log('Service URL:', TRUEDATA_SERVICE_URL);
    console.log('Request:', { tradingDate, strike, optionType, interval, customSymbol });

    // Forward request to TrueData service
    const response = await fetch(`${TRUEDATA_SERVICE_URL}/nifty/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tradingDate,
        strike,
        optionType,
        interval,
        customSymbol
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ TrueData service error:', errorData);
      return res.status(response.status).json({
        status: 'error',
        message: `TrueData service error: ${errorData.message || response.statusText}`,
        serviceUrl: TRUEDATA_SERVICE_URL
      });
    }

    const data = await response.json();
    console.log('✅ Received data from TrueData service');
    console.log('Data points:', data.dataPoints);

    // Forward the response
    res.json({
      ...data,
      serviceUsed: 'truedata-service',
      serviceUrl: TRUEDATA_SERVICE_URL
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      serviceUrl: TRUEDATA_SERVICE_URL
    });
  }
} 