# Automation Testing Guide

## Understanding Workflow Automations

**Important:** Workflow Automations do **NOT** generate QR codes. They work on **existing PIN-protected QR codes** that you've already created.

## How Automation Works

1. **Step 1: Create a PIN-Protected QR Code**
   - Go to the **Generate** tab
   - Enter your data (URL, text, WiFi, etc.)
   - Enable **PIN Protection** and set a PIN (4-6 digits)
   - Generate and save the QR code
   - **Note the QR ID** (it will be in the format `PIN_PROTECTED:qr_xxxxx`)

2. **Step 2: Create an Automation**
   - Go to the **Automations** tab
   - Click **Create Automation**
   - Choose a template or create custom:
     - **Trigger**: When should it run? (Schedule, Scan Threshold, Inactivity, Expiry)
     - **Action**: What should happen? (Notify, Pause QR, Update Destination)
   - **Optional**: Enter the QR ID from Step 1 in the "QR ID" field
   - Save the automation

3. **Step 3: Automation Execution**
   - The backend function runs **every 15 minutes** to check automations
   - When trigger conditions are met, actions execute automatically
   - Results are logged in Firestore collections:
     - `qr_workflow_runs` - Execution history
     - `qr_workflow_notifications` - Notification records

## Testing Automations

### For Scheduled Automations:
- Create a workflow with a **Schedule** trigger (daily/weekly/monthly)
- The automation will run at the specified time (default: 9:00 AM UTC)
- **Note**: Requires the Netlify function to be deployed with Firebase credentials

### For Scan Threshold Automations:
- Create a workflow with a **Scan Threshold** trigger
- Set a threshold (e.g., 10 scans for testing)
- Generate a PIN-protected QR code
- Scan the QR code multiple times to reach the threshold
- The automation will trigger on the next backend run (within 15 minutes)

### For Inactivity Automations:
- Create a workflow with an **Inactivity** trigger
- Set days of inactivity (e.g., 1 day for testing)
- Generate a PIN-protected QR code
- Wait for the specified days without scanning
- The automation will trigger on the next backend run

## Backend Setup (Required for Scheduled Automations)

To enable scheduled automations, you need to:

1. **Deploy the Netlify Function**
   - The function is located at `netlify/functions/run-automations.ts`
   - It runs on a schedule: `*/15 * * * *` (every 15 minutes)

2. **Set Environment Variables in Netlify**
   - `FIREBASE_SERVICE_ACCOUNT`: Your Firebase service account JSON (base64 encoded or raw JSON)
   - `AUTOMATION_NOTIFY_WEBHOOK` (optional): Webhook URL for notifications

3. **Verify Function is Running**
   - Check Netlify Functions dashboard
   - View function logs to see execution results
   - Check Firestore `qr_workflow_runs` collection for execution history

## Quick Test Checklist

- [ ] Created a PIN-protected QR code in Generate tab
- [ ] Created an automation in Automations tab
- [ ] Automation is set to "Active" status
- [ ] For scheduled: Wait for the scheduled time
- [ ] For scan threshold: Scan QR code enough times
- [ ] For inactivity: Wait for the specified days
- [ ] Check `qr_workflow_runs` collection in Firestore
- [ ] Check `qr_workflow_notifications` collection for notifications
- [ ] Verify action was executed (QR paused, destination updated, etc.)

## Troubleshooting

**Automation not running?**
- Check if automation status is "Active"
- Verify trigger conditions are met
- Check Netlify function logs for errors
- Verify Firebase service account credentials are correct
- Check Firestore security rules allow the function to read/write

**QR code not found?**
- Make sure you're using a PIN-protected QR code
- Verify the QR ID matches in the automation
- Check that the QR code exists in `pin_protected_qr_codes` collection

**Notifications not appearing?**
- Check `qr_workflow_notifications` collection in Firestore
- Verify webhook URL is correct (if using webhook notifications)
- Check browser console for errors

## Example Workflow

1. **Generate QR**: Create a PIN-protected QR with URL "https://example.com"
2. **Create Automation**: 
   - Name: "High Traffic Alert"
   - Trigger: Scan Threshold (100 scans)
   - Action: Notify me
   - QR ID: (from step 1)
3. **Test**: Scan the QR code 100+ times
4. **Result**: Automation triggers, notification created in Firestore

