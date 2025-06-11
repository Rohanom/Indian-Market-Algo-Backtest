export const KITE_CONFIG = {
    API_KEY: process.env.NEXT_PUBLIC_KITE_API_KEY || '',
    API_SECRET: process.env.NEXT_PUBLIC_KITE_API_SECRET || '',
    ACCESS_TOKEN: process.env.KITE_ACCESS_TOKEN || '',
    ROOT_URL: 'https://api.kite.trade',
    LOGIN_URI: 'https://kite.trade/connect/login',
    DEBUG: process.env.NODE_ENV === 'development',
    TIMEOUT: 60000,
};

export const DEFAULT_INSTRUMENT = 'NIFTY 50'; // Default instrument to track
export const DEFAULT_TIMEFRAME = '5minute'; // Default timeframe for data 