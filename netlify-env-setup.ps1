# Netlify Environment Variables Setup Script (PowerShell)
# Run this script in PowerShell after installing Netlify CLI

Write-Host "🚀 Setting up Netlify Environment Variables for QR Scanner App..." -ForegroundColor Green

# Check if Netlify CLI is installed
if (!(Get-Command "netlify" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Netlify CLI not found. Installing..." -ForegroundColor Red
    npm install -g netlify-cli
}

# Login to Netlify (if not already logged in)
Write-Host "🔐 Please log in to Netlify if prompted..." -ForegroundColor Yellow
netlify login

# Set environment variables
Write-Host "⚙️ Setting Firebase environment variables..." -ForegroundColor Cyan

netlify env:set VITE_FIREBASE_API_KEY "AIzaSyDmv9blz5rP55kp8_a9gnGdn1UQcI1753k"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "qr-users-8e1c4.firebaseapp.com"
netlify env:set VITE_FIREBASE_DATABASE_URL "https://qr-users-8e1c4-default-rtdb.asia-southeast1.firebasedatabase.app"
netlify env:set VITE_FIREBASE_PROJECT_ID "qr-users-8e1c4"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "qr-users-8e1c4.firebasestorage.app"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "802989435149"
netlify env:set VITE_FIREBASE_APP_ID "1:802989435149:web:a14939bb8fe04599a3e844"
netlify env:set VITE_FIREBASE_MEASUREMENT_ID "G-YQLS5FXCX1"

Write-Host "✅ Environment variables set successfully!" -ForegroundColor Green
Write-Host "🔄 Triggering a new deployment..." -ForegroundColor Yellow

# Trigger a new deployment to use the new environment variables
netlify deploy --prod

Write-Host "🎉 Deployment complete! Your environment variables are now active." -ForegroundColor Green
Write-Host "🌐 Check your site to verify everything is working." -ForegroundColor Cyan 