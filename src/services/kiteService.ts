import { KiteConnect } from 'kiteconnect';
import { KITE_CONFIG } from '../config/kite';

type Exchanges = 'NSE' | 'NFO' | 'BSE' | 'BFO' | 'CDS' | 'MCX';

interface KiteInstrument {
    instrument_token: string;
    tradingsymbol: string;
    exchange_token: string;
    name: string;
    last_price: number;
    expiry: Date | string;
    strike: number;
    tick_size: number;
    lot_size: number;
    instrument_type: string;
    segment: string;
    exchange: string;
}

class KiteService {
    private static instance: KiteService;
    private apiKey: string;
    private apiSecret: string;

    private constructor() {
        this.apiKey = KITE_CONFIG.API_KEY;
        this.apiSecret = KITE_CONFIG.API_SECRET;
    }

    public static getInstance(): KiteService {
        if (!KiteService.instance) {
            KiteService.instance = new KiteService();
        }
        return KiteService.instance;
    }

    public createKiteInstance(accessToken?: string) {
        return new KiteConnect({
            api_key: this.apiKey,
            access_token: accessToken,
            root: KITE_CONFIG.ROOT_URL,
            login_uri: KITE_CONFIG.LOGIN_URI,
            debug: KITE_CONFIG.DEBUG,
            timeout: KITE_CONFIG.TIMEOUT,
        });
    }

    public getLoginURL(): string {
        return `https://kite.trade/connect/login?api_key=${process.env.NEXT_PUBLIC_KITE_API_KEY}&v=3&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000/callback')}`;
    }

    public async generateSession(requestToken: string) {
        try {
            const kite = this.createKiteInstance();
            const response = await kite.generateSession(requestToken, this.apiSecret);
            return {
                access_token: response.access_token
            };
        } catch (error) {
            console.error('Error generating session:', error);
            throw error;
        }
    }

    public async getProfile(accessToken: string) {
        try {
            const kite = this.createKiteInstance(accessToken);
            return await kite.getProfile();
        } catch (error) {
            console.error('Error getting profile:', error);
            throw error;
        }
    }

    public async getHistoricalData(
        accessToken: string,
        instrumentToken: string,
        fromDate: string,
        toDate: string,
        interval: 'day' | 'minute' | '3minute' | '5minute' | '10minute' | '15minute' | '30minute' | '60minute' = 'day'
    ) {
        try {
            const kite = this.createKiteInstance(accessToken);
            return await kite.getHistoricalData(
                instrumentToken,
                interval,
                fromDate,
                toDate
            );
        } catch (error) {
            console.error('Error fetching historical data:', error);
            throw error;
        }
    }

    public async getInstruments(accessToken: string, exchange: Exchanges = 'NSE') {
        try {
            const kite = this.createKiteInstance(accessToken);
            return await kite.getInstruments(exchange);
        } catch (error) {
            console.error('Error fetching instruments:', error);
            throw error;
        }
    }

    public async getOptionsData(
        accessToken: string,
        underlying: string,
        expiry: string,
        strikes: number[],
        fromDate: string,
        toDate: string,
        interval: 'day' | 'minute' | '3minute' | '5minute' | '10minute' | '15minute' | '30minute' | '60minute' = 'day'
    ) {
        try {
            const kite = this.createKiteInstance(accessToken);
            
            // Get all instruments for NFO exchange
            const instruments = await kite.getInstruments('NFO') as KiteInstrument[];
            
            console.log('Fetched instruments:', {
                total: instruments.length,
                sample: instruments[0],
                underlying: underlying.toUpperCase(),
                expiry,
                strikes
            });

            if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
                throw new Error('No instruments data received from Kite API');
            }

            // Filter option instruments for the specific criteria
            const optionInstruments = instruments.filter(instrument => {
                if (!instrument || !instrument.tradingsymbol) {
                    console.warn('Invalid instrument:', instrument);
                    return false;
                }

                const symbolMatch = instrument.tradingsymbol.startsWith(underlying.toUpperCase());
                const expiryMatch = instrument.expiry.toString() === expiry;
                const strikeMatch = strikes.includes(instrument.strike);
                const typeMatch = (instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE');

                if (!symbolMatch || !expiryMatch || !strikeMatch || !typeMatch) {
                    console.log('Instrument filtered out:', {
                        tradingsymbol: instrument.tradingsymbol,
                        underlying: underlying.toUpperCase(),
                        expiry: instrument.expiry,
                        expectedExpiry: expiry,
                        strike: instrument.strike,
                        expectedStrikes: strikes,
                        type: instrument.instrument_type,
                        matches: {
                            symbol: symbolMatch,
                            expiry: expiryMatch,
                            strike: strikeMatch,
                            type: typeMatch
                        }
                    });
                }

                return symbolMatch && expiryMatch && strikeMatch && typeMatch;
            });

            console.log('Filtered instruments:', {
                total: instruments.length,
                filtered: optionInstruments.length,
                underlying: underlying.toUpperCase(),
                expiry,
                strikes
            });

            // Fetch historical data for each instrument
            const historicalDataPromises = optionInstruments.map(async (instrument) => {
                try {
                    const data = await kite.getHistoricalData(
                        instrument.instrument_token,
                        interval,
                        fromDate,
                        toDate
                    );

                    return {
                        instrumentToken: instrument.instrument_token,
                        tradingSymbol: instrument.tradingsymbol,
                        strike: instrument.strike,
                        optionType: instrument.instrument_type,
                        expiry: instrument.expiry,
                        data: Array.isArray(data) ? data.map(candle => ({
                            date: candle.date,
                            open: candle.open,
                            high: candle.high,
                            low: candle.low,
                            close: candle.close,
                            volume: candle.volume,
                            oi: candle.oi || 0
                        })) : []
                    };
                } catch (error) {
                    console.error(`Error fetching data for ${instrument.tradingsymbol}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(historicalDataPromises);
            const validResults = results.filter(result => result !== null);

            // Group by strike price
            const groupedData = validResults.reduce((acc: any, item: any) => {
                const strike = item.strike;
                if (!acc[strike]) {
                    acc[strike] = {
                        strike,
                        expiry: item.expiry,
                        call: null,
                        put: null
                    };
                }

                if (item.optionType === 'CE') {
                    acc[strike].call = {
                        instrumentToken: item.instrumentToken,
                        tradingSymbol: item.tradingSymbol,
                        data: item.data
                    };
                } else if (item.optionType === 'PE') {
                    acc[strike].put = {
                        instrumentToken: item.instrumentToken,
                        tradingSymbol: item.tradingSymbol,
                        data: item.data
                    };
                }

                return acc;
            }, {});

            return {
                underlying: underlying.toUpperCase(),
                expiry,
                fromDate,
                toDate,
                interval,
                strikes: Object.keys(groupedData).map(Number).sort((a, b) => a - b),
                historicalData: Object.values(groupedData)
            };
        } catch (error) {
            console.error('Error fetching options data:', error);
            throw error;
        }
    }

    public async getLiveOptionsData(
        accessToken: string,
        underlying: string,
        expiry: string
    ) {
        try {
            const kite = this.createKiteInstance(accessToken);
            
            // Get all instruments for NFO exchange
            const instruments = await kite.getInstruments('NFO') as KiteInstrument[];
            
            console.log('Debug - Raw instruments:', {
                total: instruments.length,
                sample: instruments[0],
                underlying: underlying.toUpperCase(),
                expiry,
                firstFewSymbols: instruments.slice(0, 5).map(i => i.tradingsymbol)
            });

            if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
                throw new Error('No instruments data received from Kite API');
            }

            // Filter option instruments for the specific criteria
            const optionInstruments = instruments.filter(instrument => {
                if (!instrument || !instrument.tradingsymbol) {
                    console.warn('Invalid instrument:', instrument);
                    return false;
                }

                const symbolMatch = instrument.tradingsymbol.startsWith(underlying.toUpperCase());
                const expiryMatch = instrument.expiry.toString() === expiry;
                const typeMatch = (instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE');

                if (!symbolMatch || !expiryMatch || !typeMatch) {
                    console.log('Instrument filtered out:', {
                        tradingsymbol: instrument.tradingsymbol,
                        underlying: underlying.toUpperCase(),
                        expiry: instrument.expiry,
                        expectedExpiry: expiry,
                        type: instrument.instrument_type,
                        matches: {
                            symbol: symbolMatch,
                            expiry: expiryMatch,
                            type: typeMatch
                        }
                    });
                }

                return symbolMatch && expiryMatch && typeMatch;
            });

            console.log('Debug - Filtered instruments:', {
                total: instruments.length,
                filtered: optionInstruments.length,
                underlying: underlying.toUpperCase(),
                expiry,
                sampleFiltered: optionInstruments.slice(0, 5).map(i => ({
                    symbol: i.tradingsymbol,
                    expiry: i.expiry,
                    type: i.instrument_type
                }))
            });

            if (optionInstruments.length === 0) {
                throw new Error(`No option instruments found for ${underlying} with expiry ${expiry}`);
            }

            // Get instrument tokens for all filtered instruments
            const instrumentTokens = optionInstruments.map(instrument => instrument.instrument_token);

            // Fetch different types of quotes
            const [ltpQuotes, ohlcQuotes, fullQuotes] = await Promise.all([
                kite.getLTP(instrumentTokens),
                kite.getOHLC(instrumentTokens),
                kite.getQuote(instrumentTokens)
            ]);

            console.log('Debug - Quotes received:', {
                ltpQuotes: Object.keys(ltpQuotes).length,
                ohlcQuotes: Object.keys(ohlcQuotes).length,
                fullQuotes: Object.keys(fullQuotes).length,
                sampleQuote: fullQuotes[instrumentTokens[0]]
            });

            // Group by strike price
            const groupedData = optionInstruments.reduce((acc: any, instrument) => {
                const strike = instrument.strike;
                const ltpQuote = ltpQuotes[instrument.instrument_token];
                const ohlcQuote = ohlcQuotes[instrument.instrument_token];
                const fullQuote = fullQuotes[instrument.instrument_token];

                if (!acc[strike]) {
                    acc[strike] = {
                        strike,
                        expiry: instrument.expiry,
                        call: null,
                        put: null
                    };
                }

                const optionData = {
                    instrumentToken: instrument.instrument_token,
                    tradingSymbol: instrument.tradingsymbol,
                    ltp: ltpQuote.last_price,
                    volume: fullQuote.volume,
                    oi: fullQuote.open_interest || 0,
                    bid: fullQuote.depth.buy[0]?.price || 0,
                    ask: fullQuote.depth.sell[0]?.price || 0,
                    change: ltpQuote.last_price - ohlcQuote.ohlc.open,
                    changePercent: ((ltpQuote.last_price - ohlcQuote.ohlc.open) / ohlcQuote.ohlc.open) * 100,
                    ohlc: ohlcQuote.ohlc,
                    lastTradeTime: fullQuote.last_trade_time
                };

                if (instrument.instrument_type === 'CE') {
                    acc[strike].call = optionData;
                } else if (instrument.instrument_type === 'PE') {
                    acc[strike].put = optionData;
                }

                return acc;
            }, {});

            console.log('Debug - Final grouped data:', {
                totalStrikes: Object.keys(groupedData).length,
                sampleStrike: Object.values(groupedData)[0]
            });

            return {
                underlying: underlying.toUpperCase(),
                expiry,
                timestamp: new Date().toISOString(),
                strikes: Object.keys(groupedData).map(Number).sort((a, b) => a - b),
                optionChain: Object.values(groupedData)
            };
        } catch (error) {
            console.error('Error fetching live options data:', error);
            throw error;
        }
    }
}

export const kiteService = KiteService.getInstance(); 