import axios from 'axios';

class UpstoxService {
    private static instance: UpstoxService;
    private baseUrl = 'https://api.upstox.com/v2';

    private constructor() {}

    static getInstance(): UpstoxService {
        if (!UpstoxService.instance) {
            UpstoxService.instance = new UpstoxService();
        }
        return UpstoxService.instance;
    }

    async getOptionsData(
        symbol: string,
        expiry: string,
        strike: number,
        fromDate: string,
        toDate: string,
        interval: string = '1D'
    ) {
        try {
            const response = await axios.get(`${this.baseUrl}/historical-data/option`, {
                headers: {
                    'Authorization': `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
                },
                params: {
                    symbol,
                    expiry,
                    strike,
                    fromDate,
                    toDate,
                    interval,
                },
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching options data:', error);
            throw error;
        }
    }

    // Add more methods as needed for other API endpoints
}

export default UpstoxService; 