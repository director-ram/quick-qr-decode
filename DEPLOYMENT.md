# 🚀 Deployment Guide

This guide will help you deploy your QR Code Scanner app to Netlify with Firebase backend.

## 📋 Prerequisites

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **Firebase Project**: Create a project at [firebase.google.com](https://firebase.google.com)
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, etc.)

## 🔧 Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter project name (e.g., "qr-scanner-app")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication
3. Enable **Google** authentication
4. Add your domain to authorized domains (will be your Netlify URL)

### 3. Create Firestore Database
1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode**
4. Select a location (choose closest to your users)

### 4. Set Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own QR history
    match /qr-history/{userId}/items/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow users to read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Get Firebase Configuration
1. Go to **Project Settings** (gear icon)
2. Scroll down to **Your apps**
3. Click **Web app** icon (`</>`)
4. Register your app with a nickname
5. Copy the configuration object

## 🌐 Netlify Deployment

### Method 1: Git Integration (Recommended)

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Log in to [Netlify](https://app.netlify.com)
   - Click **"New site from Git"**
   - Choose your Git provider (GitHub, GitLab, Bitbucket)
   - Select your repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
   - Click **"Deploy site"**

3. **Set Environment Variables**
   - Go to **Site settings** → **Environment variables**
   - Add each variable from your Firebase config:
     ```
     VITE_FIREBASE_API_KEY = your_api_key_here
     VITE_FIREBASE_AUTH_DOMAIN = your_project.firebaseapp.com
     VITE_FIREBASE_DATABASE_URL = https://your_project-default-rtdb.region.firebasedatabase.app
     VITE_FIREBASE_PROJECT_ID = your_project_id
     VITE_FIREBASE_STORAGE_BUCKET = your_project.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID = your_sender_id
     VITE_FIREBASE_APP_ID = your_app_id
     VITE_FIREBASE_MEASUREMENT_ID = your_measurement_id
     ```

4. **Redeploy**
   - Go to **Deploys** tab
   - Click **"Trigger deploy"** → **"Deploy site"**

### Method 2: Manual Deploy

1. **Build the Project**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to [Netlify](https://app.netlify.com)
   - Drag and drop the `dist` folder to the deploy area
   - Set environment variables as described above

## 🔒 Security Configuration

### Update Firebase Authorized Domains
1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Add your Netlify domain (e.g., `your-app-name.netlify.app`)
3. Keep `localhost` for local development

### Update CORS Settings (if needed)
If you encounter CORS issues, update your Firebase project's CORS settings or use Firebase Functions.

## 🧪 Testing Your Deployment

1. **Visit Your Site**: Go to your Netlify URL
2. **Test Features**:
   - QR Code generation with different options
   - Camera scanning (requires HTTPS)
   - File upload scanning
   - User authentication (sign up/login)
   - QR history saving
   - WiFi QR code auto-connection

## 🔧 Troubleshooting

### Common Issues

1. **Firebase Connection Errors**
   - Check that all environment variables are set correctly
   - Verify Firebase project ID and configuration

2. **Authentication Issues**
   - Ensure your Netlify domain is added to Firebase authorized domains
   - Check that authentication methods are enabled

3. **Camera Not Working**
   - Camera features require HTTPS (Netlify provides this automatically)
   - Check browser permissions

4. **Build Failures**
   - Check for any missing dependencies
   - Verify Node.js version compatibility

### Environment Variables Not Working?
- Make sure variables start with `VITE_`
- Redeploy after adding environment variables
- Check for typos in variable names

## 📱 Custom Domain (Optional)

1. **Buy a Domain** (e.g., from Namecheap, GoDaddy)
2. **Add to Netlify**:
   - Go to **Domain settings**
   - Click **Add custom domain**
   - Follow DNS configuration instructions
3. **Update Firebase**: Add your custom domain to authorized domains

## 🎉 You're Live!

Your QR Scanner app is now deployed and ready to use! Users can:
- Generate custom QR codes with logos and colors
- Scan QR codes with camera or file upload
- Connect to WiFi networks automatically
- Save QR history to their account

## 📊 Monitoring

- **Netlify**: Monitor deployments and performance in Netlify dashboard
- **Firebase**: Check usage and errors in Firebase Console
- **Analytics**: If enabled, view user analytics in Firebase Analytics 