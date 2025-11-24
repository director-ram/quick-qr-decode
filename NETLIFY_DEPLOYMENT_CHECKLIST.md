# 🚀 Netlify Deployment Checklist

This checklist covers everything you need to update in Netlify for deploying the frontend with all new features (including workflow automations).

## ✅ Required Updates

### 1. **Environment Variables** (CRITICAL)

Go to **Netlify Dashboard** → **Site settings** → **Environment variables** and ensure you have:

#### Frontend Variables (VITE_*):
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.region.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### Backend Function Variables (NEW - Required for Automations):
```
FIREBASE_SERVICE_ACCOUNT={...your_service_account_json...}
```

**How to get FIREBASE_SERVICE_ACCOUNT:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** (gear icon) → **Service accounts**
4. Click **Generate new private key**
5. Download the JSON file
6. Copy the entire JSON content and paste it as the value for `FIREBASE_SERVICE_ACCOUNT` in Netlify

**OR** encode it as base64:
```bash
# On Mac/Linux:
cat service-account.json | base64

# On Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

#### Optional Variable:
```
AUTOMATION_NOTIFY_WEBHOOK=https://your-webhook-url.com/notify
```
(Only needed if you want automation notifications sent to a webhook)

---

### 2. **Netlify Functions Configuration**

The `netlify.toml` file is already configured correctly. It will automatically:
- Build your frontend (`npm run build`)
- Deploy to `dist` folder
- Deploy scheduled functions from `netlify/functions/`

**Verify your `netlify.toml` has:**
```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### 3. **Scheduled Function Setup**

The automation function (`run-automations.ts`) runs every 15 minutes automatically. No additional setup needed if:
- ✅ `FIREBASE_SERVICE_ACCOUNT` environment variable is set
- ✅ Function is in `netlify/functions/run-automations.ts`
- ✅ Function exports `config` with schedule: `'*/15 * * * *'`

**To verify it's working:**
1. After deployment, check **Netlify Dashboard** → **Functions**
2. You should see `run-automations` listed
3. Check **Function logs** to see if it's running

---

### 4. **Build Settings** (Usually Auto-detected)

Netlify should auto-detect these from `netlify.toml`, but verify in **Site settings** → **Build & deploy**:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: `18` (or higher)

---

### 5. **Firebase Security Rules** (Update in Firebase, not Netlify)

Make sure your Firestore rules include workflow automations:

```javascript
match /qr_workflows/{workflowId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow create: if isSignedIn()
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.triggerType in ['schedule', 'scan_threshold', 'inactivity', 'expiry'];
  allow update, delete: if isSignedIn() && resource.data.userId == request.auth.uid;
}
```

---

## 📋 Deployment Steps

### Option 1: Git Integration (Recommended)

1. **Push your code to Git:**
   ```bash
   git add .
   git commit -m "Add workflow automations feature"
   git push origin main
   ```

2. **Netlify will auto-deploy** (if connected to Git)

3. **Add environment variables** (if not already set):
   - Go to **Site settings** → **Environment variables**
   - Add `FIREBASE_SERVICE_ACCOUNT` (see above)
   - Redeploy if needed

### Option 2: Manual Deploy

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI:**
   ```bash
   netlify deploy --prod
   ```

3. **Or drag & drop** the `dist` folder to Netlify dashboard

---

## 🔍 Post-Deployment Verification

### 1. Check Frontend
- ✅ Visit your Netlify URL
- ✅ Test QR generation
- ✅ Test QR scanning
- ✅ Test authentication
- ✅ Test workflow automations tab

### 2. Check Functions
- ✅ Go to **Netlify Dashboard** → **Functions**
- ✅ Verify `run-automations` function exists
- ✅ Check function logs (should show runs every 15 minutes)

### 3. Check Environment Variables
- ✅ Go to **Site settings** → **Environment variables**
- ✅ Verify all `VITE_*` variables are set
- ✅ Verify `FIREBASE_SERVICE_ACCOUNT` is set
- ✅ **Important**: Redeploy after adding new variables

---

## ⚠️ Common Issues

### Issue: Functions not running
**Solution**: 
- Check that `FIREBASE_SERVICE_ACCOUNT` is set correctly
- Verify the JSON is valid (no extra quotes or escaping issues)
- Check function logs for errors

### Issue: "Missing or insufficient permissions" in functions
**Solution**:
- Ensure the service account has proper Firestore permissions
- Check Firebase IAM settings for the service account

### Issue: Environment variables not working
**Solution**:
- Make sure variables start with `VITE_` for frontend
- Redeploy after adding/updating variables
- Check for typos in variable names

### Issue: Build fails
**Solution**:
- Check Node.js version (should be 18+)
- Run `npm install` locally to check for dependency issues
- Check build logs in Netlify dashboard

---

## 🎯 Quick Checklist

Before deploying, make sure:

- [ ] All Firebase environment variables (`VITE_*`) are set in Netlify
- [ ] `FIREBASE_SERVICE_ACCOUNT` is set (for automations)
- [ ] `netlify.toml` is in the root directory
- [ ] `netlify/functions/run-automations.ts` exists
- [ ] Firebase security rules include `qr_workflows` collection
- [ ] Your Netlify domain is added to Firebase authorized domains
- [ ] Code is pushed to Git (if using Git integration)

---

## 📝 Summary

**What you NEED to update in Netlify:**

1. ✅ **Add `FIREBASE_SERVICE_ACCOUNT` environment variable** (NEW - Required for automations)
2. ✅ **Verify all existing `VITE_*` variables are set**
3. ✅ **Redeploy after adding new variables**

**What's already configured:**
- ✅ `netlify.toml` is set up correctly
- ✅ Build settings are configured
- ✅ Functions directory is configured
- ✅ Scheduled function is ready to deploy

**No changes needed to:**
- Build command
- Publish directory
- Redirects
- Headers

---

## 🚀 Ready to Deploy?

1. Add `FIREBASE_SERVICE_ACCOUNT` to Netlify environment variables
2. Push your code or deploy manually
3. Verify functions are running
4. Test the automation feature!

That's it! Your frontend will deploy with all the new features. 🎉

