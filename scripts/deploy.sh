#!/bin/bash
# scripts/deploy.sh
# Deployment script for HCH Restaurant Next.js on cPanel VPS

echo "Starting deployment for HCH Restaurant..."

# 1. Install dependencies
echo "Installing dependencies..."
npm install

# 2. Build Next.js
echo "Building the application..."
npm run build

# 3. Handle PM2 (start or restart)
echo "Restarting PM2 cluster..."
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

echo "Deployment complete! ✅"
