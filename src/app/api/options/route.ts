import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { kiteService } from '@/services/kiteService';
import { OptionsService } from '@/services/optionsService';
import { KiteConnect } from 'kiteconnect';

// Type for exchange
type Exchange = 'NSE' | 'NFO' | 'BSE' | 'BFO' | 'CDS' | 'MCX';

// Interface for instrument data
interface Instrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
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

// Interface for historical data
interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

// Utility function to format date for comparison
const formatDateForComparison = (date: any): string => {
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  if (typeof date === 'string') {
    // Handle different date string formats
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
    return date;
  }
  return date.toString();
};

// Utility function to validate date format
const isValidDateFormat = (dateString: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const underlying = searchParams.get('underlying');
    const expiry = searchParams.get('expiry');
    const date = searchParams.get('date');

    // Input validation
    if (!underlying || !expiry || !date) {
      return NextResponse.json(
        { error: 'Missing required parameters: underlying, expiry, date' },
        { status: 400 }
      );
    }

    // Validate date format
    if (!isValidDateFormat(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Get access token from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('kite_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Kite API credentials not configured' },
        { status: 401 }
      );
    }

    try {
      const data = await kiteService.getOptionsData(
        accessToken,
        underlying,
        expiry,
        [], // Empty strikes array for current data
        date,
        date,
        'minute'
      );
      return NextResponse.json(data);
    } catch (error: any) {
      console.error('Options API error:', error);
      return NextResponse.json({ error: error.message || 'Failed to fetch option chain' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Options API error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch option chain',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST method for historical option data (for backtesting)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      underlying, 
      expiry, 
      strikes, 
      fromDate, 
      toDate, 
      interval = 'day',
      exchange = 'NFO'
    } = body;

    // Input validation
    if (!underlying || !expiry || !strikes || !fromDate || !toDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: underlying, expiry, strikes, fromDate, toDate' },
        { status: 400 }
      );
    }

    // Validate strikes array
    if (!Array.isArray(strikes) || strikes.length === 0) {
      return NextResponse.json(
        { error: 'strikes must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate date formats
    if (!isValidDateFormat(fromDate) || !isValidDateFormat(toDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD for fromDate and toDate' },
        { status: 400 }
      );
    }

    // Validate date range
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from >= to) {
      return NextResponse.json(
        { error: 'fromDate must be earlier than toDate' },
        { status: 400 }
      );
    }

    // Validate exchange
    const validExchanges: Exchange[] = ['NSE', 'NFO', 'BSE', 'BFO', 'CDS', 'MCX'];
    if (!validExchanges.includes(exchange as Exchange)) {
      return NextResponse.json(
        { error: `Invalid exchange. Must be one of: ${validExchanges.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate interval
    const validIntervals = ['minute', '3minute', '5minute', '10minute', '15minute', '30minute', 'hour', 'day'];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json(
        { error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` },
        { status: 400 }
      );
    }

    // Get access token from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('kite_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Kite API credentials not configured' },
        { status: 401 }
      );
    }

    const data = await kiteService.getOptionsData(
      accessToken,
      underlying,
      expiry,
      strikes,
      fromDate,
      toDate,
      interval
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching historical option data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch historical option data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}