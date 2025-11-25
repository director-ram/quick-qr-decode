# 🔐 Setting FIREBASE_SERVICE_ACCOUNT in Netlify

## ⚠️ SECURITY WARNING
**NEVER share your service account JSON publicly!** If you've shared it anywhere:
1. Go to Firebase Console → IAM & Admin → Service Accounts
2. Delete this service account
3. Create a new one
4. Update Netlify with the new credentials

---

## Method 1: Via Netlify Dashboard (Recommended)

1. **Go to Netlify Dashboard**
   - Visit [app.netlify.com](https://app.netlify.com)
   - Select your site

2. **Navigate to Environment Variables**
   - Go to **Site settings** → **Environment variables**

3. **Add the Variable**
   - Click **Add variable**
   - **Key**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Paste the **ENTIRE JSON** (all on one line, or with proper formatting)
   
   **Important**: The value should be the complete JSON object, like:
   ```json
   {"type":"service_account","project_id":"qr-users-8e1c4","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"...","universe_domain":"googleapis.com"}
   ```

4. **Save and Redeploy**
   - Click **Save**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**

---

## Method 2: Via Netlify CLI

```bash
# Set the environment variable (paste the entire JSON as the value)
netlify env:set FIREBASE_SERVICE_ACCOUNT '{"type":"service_account","project_id":"qr-users-8e1c4",...}'

# Or use a file
netlify env:set FIREBASE_SERVICE_ACCOUNT "$(cat service-account.json)"
```

---

## Method 3: Base64 Encoded (Alternative)

If the JSON is too large or has formatting issues, you can encode it:

### On Mac/Linux:
```bash
cat service-account.json | base64 | pbcopy
# Then paste the base64 string in Netlify
```

### On Windows (PowerShell):
```powershell
$json = Get-Content service-account.json -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
# Copy the output and paste in Netlify
```

**Note**: The function code already handles both JSON and base64 formats.

---

## ✅ Verification

After setting the variable:

1. **Check it's set:**
   ```bash
   netlify env:list
   ```

2. **Check function logs:**
   - Go to **Netlify Dashboard** → **Functions**
   - Click on `run-automations`
   - Check **Function logs**
   - Should see successful runs (every 15 minutes)

3. **Test an automation:**
   - Create a scheduled automation
   - Wait for it to trigger
   - Check if it executes successfully

---

## 🔒 Security Best Practices

1. ✅ **Never commit** service account JSON to Git
2. ✅ **Never share** it in public forums/chat
3. ✅ **Rotate keys** if accidentally exposed
4. ✅ **Use environment variables** (not hardcoded)
5. ✅ **Limit permissions** - only grant necessary Firestore access

---

## 🐛 Troubleshooting

### Error: "Missing required environment variable: FIREBASE_SERVICE_ACCOUNT"
- **Solution**: Make sure the variable name is exactly `FIREBASE_SERVICE_ACCOUNT` (case-sensitive)
- Redeploy after adding the variable

### Error: "Invalid service account JSON"
- **Solution**: 
  - Make sure the entire JSON is on one line (or properly formatted)
  - Check for extra quotes or escaping issues
  - Try base64 encoding method instead

### Error: "Permission denied" in function logs
- **Solution**: 
  - Check Firebase IAM settings for the service account
  - Ensure it has "Firebase Admin SDK Administrator Service Agent" role
  - Or grant "Cloud Datastore User" role

---

## 📝 Quick Copy-Paste Format

For Netlify dashboard, use this format (all on one line), but replace the placeholder values with your actual credentials:

```
{"type":"service_account","project_id":"<YOUR_PROJECT_ID>","private_key_id":"<PRIVATE_KEY_ID>","private_key":"-----BEGIN PRIVATE KEY-----\n<YOUR_PRIVATE_KEY_BLOCK>\n-----END PRIVATE KEY-----\n","client_email":"<SERVICE_ACCOUNT_EMAIL>","client_id":"<CLIENT_ID>","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/<SERVICE_ACCOUNT_PATH>","universe_domain":"googleapis.com"}
```

**Important**: Remove all line breaks and make it one continuous line, or keep the JSON formatting if Netlify supports it. Never commit the real values to Git.

