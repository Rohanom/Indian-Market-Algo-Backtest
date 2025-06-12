/**
 * Calculate the next Thursday (NIFTY weekly expiry) from a given date
 * @param date - The reference date
 * @returns Date object for the next Thursday
 */
export function getNextThursday(date: Date): Date {
    const nextThursday = new Date(date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Thursday is day 4
    let daysToAdd = 4 - dayOfWeek;
    
    // If today is Thursday or past Thursday, get next Thursday
    if (daysToAdd <= 0) {
        daysToAdd += 7;
    }
    
    nextThursday.setDate(date.getDate() + daysToAdd);
    return nextThursday;
}

/**
 * Format date as YYMMDD for NIFTY options symbol
 * @param date - Date to format
 * @returns Formatted string (YYMMDD)
 */
export function formatDateForNifty(date: Date): string {
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month (01-12)
    const day = date.getDate().toString().padStart(2, '0'); // Day (01-31)
    
    return `${year}${month}${day}`;
}

/**
 * Generate NIFTY options symbol for a given date
 * @param referenceDate - The date for which to get the option symbol
 * @returns NIFTY symbol with expiry (e.g., NIFTY250529)
 */
export function getNiftyOptionSymbol(referenceDate: Date | string): string {
    const date = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
    const expiryDate = getNextThursday(date);
    const formattedExpiry = formatDateForNifty(expiryDate);
    
    return `NIFTY${formattedExpiry}`;
}

/**
 * Generate NIFTY options symbol with strike and type
 * @param referenceDate - The date for which to get the option symbol
 * @param strike - Strike price (e.g., 18000)
 * @param optionType - 'CE' for Call or 'PE' for Put
 * @returns Complete NIFTY option symbol (e.g., NIFTY25052918000CE)
 */
export function getNiftyOptionSymbolWithStrike(
    referenceDate: Date | string, 
    strike: number, 
    optionType: 'CE' | 'PE'
): string {
    const baseSymbol = getNiftyOptionSymbol(referenceDate);
    return `${baseSymbol}${strike}${optionType}`;
}

/**
 * Get all Thursdays in a given month (for monthly expiry calculations)
 * @param year - Year
 * @param month - Month (0-11, JavaScript month format)
 * @returns Array of Thursday dates
 */
export function getThursdaysInMonth(year: number, month: number): Date[] {
    const thursdays: Date[] = [];
    const firstDay = new Date(year, month, 1);
    
    // Find first Thursday of the month
    let firstThursday = 1;
    while (new Date(year, month, firstThursday).getDay() !== 4) {
        firstThursday++;
    }
    
    // Add all Thursdays in the month
    for (let day = firstThursday; day <= 31; day += 7) {
        const thursday = new Date(year, month, day);
        if (thursday.getMonth() === month) {
            thursdays.push(thursday);
        }
    }
    
    return thursdays;
}

/**
 * Get the last Thursday of a month (monthly expiry)
 * @param year - Year
 * @param month - Month (0-11, JavaScript month format)
 * @returns Date of last Thursday
 */
export function getLastThursdayOfMonth(year: number, month: number): Date {
    const thursdays = getThursdaysInMonth(year, month);
    return thursdays[thursdays.length - 1];
}

/**
 * Check if a date is a NIFTY expiry date (Thursday)
 * @param date - Date to check
 * @returns true if it's a Thursday (expiry date)
 */
export function isNiftyExpiryDate(date: Date): boolean {
    return date.getDay() === 4; // Thursday
}

/**
 * Get formatted date range for historical data
 * @param targetDate - Date for which to get historical data
 * @returns Object with formatted dates and option symbol
 */
export function getHistoricalDataParams(targetDate: Date | string) {
    const date = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    const optionSymbol = getNiftyOptionSymbol(date);
    const expiryDate = getNextThursday(date);
    
    // Format dates for TrueData API (YYMMDDT00:00:00 format)
    const formatForAPI = (d: Date) => {
        const yy = d.getFullYear().toString().slice(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        const hh = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        return `${yy}${mm}${dd}T${hh}:${min}:${ss}`;
    };
    
    // Get data for the trading day (9:15 AM to 3:30 PM)
    const startTime = new Date(date);
    startTime.setHours(9, 15, 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(15, 30, 0, 0);
    
    return {
        symbol: optionSymbol,
        fromDate: formatForAPI(startTime),
        toDate: formatForAPI(endTime),
        expiryDate: formatForAPI(expiryDate),
        tradingDate: formatForAPI(date)
    };
}

// Example usage and testing
export const examples = {
    // For May 25, 2024, get NIFTY250529 (next Thursday: May 29, 2024)
    may25Example: getNiftyOptionSymbol('2024-05-25'), // Returns: NIFTY240529
    
    // With strike and option type
    may25CallExample: getNiftyOptionSymbolWithStrike('2024-05-25', 18000, 'CE'), // Returns: NIFTY24052918000CE
    
    // Historical data params for May 25
    may25HistoricalParams: getHistoricalDataParams('2024-05-25')
}; 