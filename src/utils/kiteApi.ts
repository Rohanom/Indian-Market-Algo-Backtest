import axios from 'axios';

export const fetchHistoricalData = async (
    instrumentToken: string,
    fromDate: string,
    toDate: string,
    interval: 'day' | 'minute' | '3minute' | '5minute' | '10minute' | '15minute' | '30minute' | '60minute' = 'day'
) => {
    try {
        // Format dates for API (YYYY-MM-DD HH:mm:ss)
        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toISOString().replace('T', ' ').replace('Z', '');
        };

        const formattedFromDate = formatDate(fromDate);
        const formattedToDate = formatDate(toDate);

        console.log('Making request to /api/stock with params:', {
            instrumentToken,
            fromDate: formattedFromDate,
            toDate: formattedToDate,
            interval
        });

        const response = await axios.get('/api/stock', {
            params: {
                instrumentToken,
                fromDate: formattedFromDate,
                toDate: formattedToDate,
                interval,
            },
        });
        return response.data;
    } catch (error: any) {
        console.error('Error fetching historical data:', error.response?.data || error);
        throw error;
    }
};

export const searchInstruments = async (query: string) => {
    try {
        // This will be implemented when we add the search API endpoint
        throw new Error('Search functionality not implemented yet');
    } catch (error) {
        console.error('Error searching instruments:', error);
        throw error;
    }
};

export interface OptionData {
    instrumentToken: number;
    tradingSymbol: string;
    ltp: number;
    volume: number;
    oi: number;
    bid: number;
    ask: number;
    change: number;
    changePercent: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    lastTradeTime: string | null;
}

export interface StrikeData {
    strike: number;
    expiry: string;
    call: OptionData | null;
    put: OptionData | null;
}

export interface OptionChainResponse {
    underlying: string;
    expiry: string;
    exchange: string;
    totalStrikes: number;
    optionChain: StrikeData[];
}

export const fetchOptionChain = async (
    underlying: string,
    expiry: string,
    exchange: string = 'NFO'
): Promise<OptionChainResponse> => {
    try {
        console.log('Making request to /api/options with params:', {
            underlying,
            expiry,
            exchange
        });

        const response = await axios.get('/api/options', {
            params: {
                underlying,
                expiry,
                exchange,
            },
        });
        return response.data;
    } catch (error: any) {
        console.error('Error fetching option chain:', error.response?.data || error);
        throw error;
    }
};

export interface LiveOptionData {
    instrumentToken: number;
    tradingSymbol: string;
    ltp: number;
    volume: number;
    oi: number;
    bid: number;
    ask: number;
    change: number;
    changePercent: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    lastTradeTime: string | null;
}

export interface LiveStrikeData {
    strike: number;
    expiry: string;
    call: LiveOptionData | null;
    put: LiveOptionData | null;
}

export interface LiveOptionChainResponse {
    underlying: string;
    expiry: string;
    timestamp: string;
    strikes: number[];
    optionChain: LiveStrikeData[];
}

export const fetchLiveOptionChain = async (
    underlying: string,
    expiry: string
): Promise<LiveOptionChainResponse> => {
    try {
        console.log('Fetching live option chain:', {
            underlying,
            expiry
        });

        const response = await axios.get('/api/live-options', {
            params: {
                underlying,
                expiry
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('Error fetching live option chain:', error.response?.data || error);
        throw error;
    }
}; 