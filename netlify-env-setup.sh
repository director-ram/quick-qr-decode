#!/bin/bash

# Netlify Environment Variables Setup Script
# Run this script after installing Netlify CLI and logging in

echo "🚀 Setting up Netlify Environment Variables for QR Scanner App..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Login to Netlify (if not already logged in)
echo "🔐 Please log in to Netlify if prompted..."
netlify login

# Set environment variables
echo "⚙️ Setting Firebase environment variables..."

netlify env:set VITE_FIREBASE_API_KEY "AIzaSyDmv9blz5rP55kp8_a9gnGdn1UQcI1753k"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "qr-users-8e1c4.firebaseapp.com"
netlify env:set VITE_FIREBASE_DATABASE_URL "https://qr-users-8e1c4-default-rtdb.asia-southeast1.firebasedatabase.app"
netlify env:set VITE_FIREBASE_PROJECT_ID "qr-users-8e1c4"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "qr-users-8e1c4.firebasestorage.app"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "802989435149"
netlify env:set VITE_FIREBASE_APP_ID "1:802989435149:web:a14939bb8fe04599a3e844"
netlify env:set VITE_FIREBASE_MEASUREMENT_ID "G-YQLS5FXCX1"

echo "✅ Environment variables set successfully!"
echo "🔄 Triggering a new deployment..."

# Trigger a new deployment to use the new environment variables
netlify deploy --prod

echo "🎉 Deployment complete! Your environment variables are now active."
echo "🌐 Check your site to verify everything is working." 