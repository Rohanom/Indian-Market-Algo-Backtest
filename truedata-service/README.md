# TrueData Service

A standalone JavaScript service for TrueData API integration, providing clean separation from the main Next.js application.

## Features

- ✅ **Direct TrueData API Integration**: Pure JavaScript service without TypeScript conflicts
- ✅ **NIFTY Options Auto-Generation**: Automatically calculates next Thursday expiry dates
- ✅ **Live Data Retrieval**: Working with 2025 dates for current market data
- ✅ **RESTful API**: Clean endpoints for frontend integration
- ✅ **Error Handling**: Comprehensive error handling and logging

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables** (in root `.env`):
   ```bash
   TRUEDATA_USERNAME=your_username
   TRUEDATA_PASSWORD=your_password
   ```

3. **Start Service**:
   ```bash
   npm start
   ```

4. **Development Mode**:
   ```bash
   npm run dev
   ```

## Endpoints

### Health Check
```
GET http://localhost:3001/health
```

### Authentication Test
```
GET http://localhost:3001/auth/test
```

### NIFTY Options Data
```
POST http://localhost:3001/nifty/options
Content-Type: application/json

{
  "tradingDate": "2025-06-11",
  "strike": 23500,
  "optionType": "CE",
  "interval": "1min"
}
```

### General Historical Data
```
POST http://localhost:3001/historical/bars
Content-Type: application/json

{
  "symbol": "NIFTY25061223500CE",
  "from": "250611T09:15:00",
  "to": "250611T15:30:00",
  "interval": "5min"
}
```

## Response Format

```json
{
  "status": "success",
  "symbol": "NIFTY25061223500CE",
  "dataPoints": 75,
  "apiStatus": "Success",
  "records": [
    {
      "timestamp": "2025-06-11T09:15:00",
      "open": 1064.35,
      "high": 1083,
      "low": 1058.95,
      "close": 1058.95,
      "Volume": "1800",
      "oi": 2292225
    }
  ]
}
```

## Symbol Format

- **Base**: `NIFTY + YYMMDD` (e.g., `NIFTY250612`)
- **Options**: `NIFTY + YYMMDD + STRIKE + CE/PE` (e.g., `NIFTY25061223500CE`)
- **Auto-calculates**: Next Thursday expiry from any trading date

## Integration

The service runs on port 3001 and integrates with the Next.js app via API routes:

```typescript
// Next.js API route forwards to TrueData service
const response = await fetch('http://localhost:3001/nifty/options', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestData)
});
```

## Testing

Run the test suite:
```bash
npm test
```

## Troubleshooting

1. **Service not starting**: Check if port 3001 is available
2. **Authentication failing**: Verify TrueData credentials in `.env`
3. **No data returned**: Use 2025 dates for live data
4. **CORS issues**: Service includes CORS middleware for local development

## Architecture

```
Frontend (Next.js) → API Routes → TrueData Service → TrueData API
    :3000              :3000          :3001         External
```

This separation allows for clean TypeScript in the frontend while handling the CommonJS TrueData library in a dedicated service. 