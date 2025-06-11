import { KiteConnect } from 'kiteconnect';

interface OptionInstrument {
    instrumentToken: number;
    tradingSymbol: string;
    strike: number;
    expiry: string;
    type: 'CE' | 'PE';
}

interface OptionData {
    oi: number;
    volume: number;
    ltp: number;
    instrumentToken: number;
}

interface OptionChainState {
    currentDate: string;
    underlying: string;
    expiry: string;
    strikes: {
        [strike: number]: {
            call: OptionData | null;
            put: OptionData | null;
        }
    }
}

interface KiteInstrument {
    instrument_token: number;
    tradingsymbol: string;
    exchange_token: number;
    name: string;
    last_price: number;
    expiry: string;
    strike: number;
    tick_size: number;
    lot_size: number;
    instrument_type: string;
    segment: string;
    exchange: string;
}

class OptionsService {
    private kite: KiteConnect;
    private instrumentsCache: Map<string, OptionInstrument[]> = new Map();
    private lastFetchTime: number = 0;
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    constructor(kite: KiteConnect) {
        this.kite = kite;
    }

    // Fetch and cache all option instruments for an underlying
    async fetchOptionInstruments(underlying: string): Promise<OptionInstrument[]> {
        const cacheKey = underlying;
        const now = Date.now();

        // Return cached data if it's still valid
        if (this.instrumentsCache.has(cacheKey) && (now - this.lastFetchTime) < this.CACHE_DURATION) {
            return this.instrumentsCache.get(cacheKey)!;
        }

        try {
            // Fetch all instruments from NFO exchange
            // @ts-ignore: getInstruments may not be typed in kiteconnect, but it exists in the API
            const instruments = await (this.kite as any).getInstruments('NFO') as KiteInstrument[];
            
            // Filter for options instruments
            const optionInstruments = instruments
                .filter((instrument: KiteInstrument) => {
                    const symbol = instrument.tradingsymbol;
                    return symbol.startsWith(underlying) && 
                           (symbol.includes('CE') || symbol.includes('PE'));
                })
                .map((instrument: KiteInstrument) => {
                    const parts = instrument.tradingsymbol.split(underlying)[1];
                    const strike = parseInt(parts.match(/\d+/)?.[0] || '0');
                    let type: 'CE' | 'PE' = 'CE';
                    if (parts.includes('PE')) type = 'PE';
                    else if (parts.includes('CE')) type = 'CE';
                    const expiry = parts.match(/\d{2}[A-Z]{3}\d{2}/)?.[0] || '';

                    return {
                        instrumentToken: instrument.instrument_token,
                        tradingSymbol: instrument.tradingsymbol,
                        strike,
                        expiry,
                        type
                    } as OptionInstrument;
                });

            // Cache the results
            this.instrumentsCache.set(cacheKey, optionInstruments);
            this.lastFetchTime = now;

            return optionInstruments;
        } catch (error) {
            console.error('Error fetching option instruments:', error);
            throw error;
        }
    }

    // Get option chain for a specific date and expiry
    async getOptionChain(
        underlying: string,
        date: string,
        expiry: string
    ): Promise<OptionChainState> {
        try {
            // Fetch all option instruments
            const instruments = await this.fetchOptionInstruments(underlying);
            
            // Filter instruments for the specific expiry
            const expiryInstruments = instruments.filter(instrument => 
                instrument.expiry === expiry
            );

            // Fetch historical data for all instruments
            const historicalDataPromises = expiryInstruments.map(async (instrument) => {
                try {
                    // @ts-ignore: getHistoricalData may not be typed in kiteconnect, but it exists in the API
                    const data = await (this.kite as any).getHistoricalData(
                        instrument.instrumentToken,
                        'minute',
                        date,
                        date,
                        true
                    );
                    
                    // Get the last candle of the day
                    const lastCandle = data[data.length - 1];
                    if (!lastCandle) return null;

                    return {
                        instrument,
                        data: {
                            oi: lastCandle.oi,
                            volume: lastCandle.volume,
                            ltp: lastCandle.close,
                            instrumentToken: instrument.instrumentToken
                        }
                    };
                } catch (error) {
                    console.error(`Error fetching historical data for ${instrument.tradingSymbol}:`, error);
                    return null;
                }
            });

            const historicalData = await Promise.all(historicalDataPromises);

            // Build option chain state
            const strikes: { [key: number]: { call: OptionData | null; put: OptionData | null } } = {};

            historicalData.forEach(result => {
                if (!result) return;
                const { instrument, data } = result;

                if (!strikes[instrument.strike]) {
                    strikes[instrument.strike] = { call: null, put: null };
                }

                if (instrument.type === 'CE') {
                    strikes[instrument.strike].call = data;
                } else {
                    strikes[instrument.strike].put = data;
                }
            });

            return {
                currentDate: date,
                underlying,
                expiry,
                strikes
            };
        } catch (error) {
            console.error('Error fetching option chain:', error);
            throw error;
        }
    }

    // Get next expiry date from available instruments
    async getNextExpiry(underlying: string): Promise<string> {
        const instruments = await this.fetchOptionInstruments(underlying);
        const expiries = [...new Set(instruments.map(i => i.expiry))].sort();
        return expiries[0] || '';
    }
}

export { OptionsService };
export type { OptionInstrument, OptionData, OptionChainState }; 