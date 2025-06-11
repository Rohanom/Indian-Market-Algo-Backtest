from truedata_ws.websocket import TDClient
import asyncio
import json

# Replace with your actual credentials
USERNAME    = "trial992"
PASSWORD    = "agam992"
API_KEY     = "YOUR_APP_KEY"      # Often shown as "App Key" in your TrueData dashboard
HOST        = "realtime.truedata.in"  # Velocity host for live/historical
PORT        = 7709                   # Standard TrueData WS port

async def main():
    # 1. Initialize the client
    client = TDClient(
        username=USERNAME,
        password=PASSWORD,
        app_key=API_KEY,
        host=HOST,
        port=PORT,
        heartbeat=30,     # keep-alive pings every 30 seconds
        subscribe_to=None  # no real-time subscription; we only want history
    )

    # 2. Connect and authenticate
    await client.connect()         # establishes WS connection
    auth_response = await client.login()
    if auth_response.get("type") != "authorized":
        print("❌ Authentication failed →", auth_response)
        return

    print("✅ Logged in successfully.")

    # 3. Identify the instrument token for the expired option
    #    You need the “symbol” format recognized by TrueData. 
    #    Example: "NIFTY 50 SEP24 18000 CE" 
    #    (format: <Underlying> <ExpiryMMMYY> <Strike> <CE/PE>)
    #
    #    You can search for available symbols using:
    #    instr_response = await client.send_message({"type":"get_symbols"})
    #    (But usually you already know the exact symbol string.)

    symbol = "NIFTY 50 SEP24 18000 CE"  # Replace with your expired-option symbol
    time_frame = "1Min"                # TrueData’s nomenclature for 1-minute bars;
                                       # other options: "5Min", "15Min", "Day", etc.

    # 4. Request 1 year (365 days) of 1-min historical bars
    #    TrueData requires UTC timestamps in milliseconds for 'from' and 'to'.
    #    Let’s say today = June 7 2025; one year back = June 8 2024.
    import datetime
    import pytz

    # Convert local dates to UTC timestamps in ms
    def to_utc_ms(dt_str: str) -> int:
        # dt_str format: "YYYY-MM-DD HH:MM:SS"
        local = datetime.datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        # Assume IST +05:30 (since user is in India); convert to UTC
        ist = pytz.timezone("Asia/Kolkata")
        local_dt = ist.localize(local)
        utc_dt = local_dt.astimezone(pytz.UTC)
        return int(utc_dt.timestamp() * 1000)

    # Define range: June 8, 2024 09:15:00 IST to June 7, 2025 15:30:00 IST
    start_ms = to_utc_ms("2024-06-08 09:15:00")
    end_ms   = to_utc_ms("2025-06-07 15:30:00")

    # 5. Send the historical data request
    #    The ‘type’ for a historical request is “get_history”.
    #
    hist_request = {
        "type":    "get_history",
        "symbol":  symbol,
        "timeframe": time_frame,
        "from":    start_ms,
        "to":      end_ms,
        # Some payloads allow “continuous”: True → back-adjusted continuous futures/options,
        # but for an expired single contract you don’t need “continuous”.
    }

    # Make the request and await response
    history_response = await client.send_message(hist_request)

    # 6. Process the returned data
    if history_response.get("type") == "history":
        bars = history_response.get("data", [])
        print(f"Received {len(bars)} bars for {symbol} from 2024-06-08 to 2025-06-07.")
        # Example output: each bar = [ timestamp_ms, open, high, low, close, volume, oi ]
        for bar in bars[:5]:  # print first 5 bars
            ts, o, h, l, c, vol, oi = bar
            readable = datetime.datetime.fromtimestamp(ts/1000, pytz.UTC).strftime("%Y-%m-%d %H:%M")
            print(f"{readable} → O:{o}, H:{h}, L:{l}, C:{c}, Vol:{vol}, OI:{oi}")
    else:
        print("❌ Failed to fetch history:", history_response)

    # 7. Logout and close WebSocket cleanly
    await client.logout()
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
