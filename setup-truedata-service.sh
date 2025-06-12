#!/bin/bash

echo "🚀 Setting up TrueData Service..."

# Navigate to truedata-service directory
cd truedata-service

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Go back to root
cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# TrueData API Credentials
TRUEDATA_USERNAME=your_username_here
TRUEDATA_PASSWORD=your_password_here

# TrueData Service Configuration
TRUEDATA_SERVICE_URL=http://localhost:3001
TRUEDATA_SERVICE_PORT=3001

# KiteConnect API (if needed)
KITE_API_KEY=your_kite_api_key_here
KITE_API_SECRET=your_kite_api_secret_here
EOL
    echo "⚠️  Please update .env with your actual TrueData credentials"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your TrueData credentials"
echo "2. Start the TrueData service: cd truedata-service && npm start"
echo "3. Start your Next.js app: npm run dev"
echo ""
echo "Test endpoints:"
echo "- Health: http://localhost:3001/health"
echo "- Auth: http://localhost:3001/auth/test"
echo "- Options: POST http://localhost:3001/nifty/options" 