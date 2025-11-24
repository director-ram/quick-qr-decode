# Automation Messaging Guide

This document explains how messages are displayed when workflow automations trigger.

## Overview

When automations trigger (scan threshold reached, scheduled time, etc.), users see messages in different ways depending on the context:

1. **When scanning a paused QR code** - Error message in PIN dialog + Toast notification
2. **In the Automations tab** - Visual indicators showing execution status
3. **For QR owners** - Execution status visible in workflow cards

---

## 1. Scan Threshold Reached

### For Scanners (Anyone trying to scan the QR):

When a QR code reaches its scan threshold and is paused:

1. **PIN Input Dialog Error**:
   - Shows a detailed error message explaining why the QR is paused
   - Message format: `⏸️ This QR code has been automatically paused after reaching {threshold} scans. The automation "{workflow name}" has been triggered.`

2. **Toast Notification**:
   - A toast notification appears with:
     - Title: "⏸️ QR Code Paused"
     - Description: The full pause reason message
     - Duration: 5 seconds
     - Variant: Destructive (red/warning style)

### Example Flow:
```
User scans QR → Enters PIN → Error appears:
"⏸️ This QR code has been automatically paused after reaching 10 scans. 
The automation 'Pause After 10 Scans' has been triggered."
```

---

## 2. Scheduled Time Ended

### For Scanners:

When a scheduled automation triggers and pauses the QR:

1. **PIN Input Dialog Error**:
   - Message: `⏸️ This QR code has been automatically paused by the scheduled automation "{workflow name}".`

2. **Toast Notification**:
   - Same toast notification as scan threshold

### Example Flow:
```
User scans QR → Enters PIN → Error appears:
"⏸️ This QR code has been automatically paused by the scheduled automation 
'Daily Maintenance Pause'."
```

---

## 3. Inactivity Triggered

### For Scanners:

When an inactivity automation triggers:

1. **PIN Input Dialog Error**:
   - Message: `⏸️ This QR code has been automatically paused due to inactivity. The automation "{workflow name}" has been triggered.`

---

## 4. Expiry Triggered

### For Scanners:

When an expiry automation triggers:

1. **PIN Input Dialog Error**:
   - Message: `⏸️ This QR code has been automatically paused as it has expired. The automation "{workflow name}" has been triggered.`

---

## 5. For QR Owners (Automations Tab)

### Visual Indicators:

In the **Automations** tab, workflow cards show:

1. **Execution Status Badge**:
   - ✅ **Green checkmark + "Executed X ago"** - If automation has run
   - ⏰ **Clock icon + "Not executed yet"** - If automation hasn't run

2. **Last Updated Time**:
   - Shows when the workflow was last modified

3. **Workflow Status**:
   - **Active** badge (green) - Automation is enabled
   - **Paused** badge (gray) - Automation is disabled

### Example Card Display:

```
┌─────────────────────────────────────────────────┐
│ Workflow Name                    [Active]        │
│ QR Label • Trigger details                       │
│ ✅ Executed 2 hours ago • Updated 1 day ago     │
│ [Toggle Switch] [Delete]                         │
└─────────────────────────────────────────────────┘
```

---

## 6. Message Customization

### Custom Pause Messages:

When creating an automation with "Pause QR" action, you can provide a custom message:

- **Custom Message**: If provided, this exact message will be shown
- **Default Message**: If not provided, a context-aware message is generated based on:
  - Trigger type (scan threshold, schedule, inactivity, expiry)
  - Threshold value (for scan threshold)
  - Workflow name

### Example Custom Messages:

```javascript
// Custom message in automation action payload:
{
  type: 'pause_qr',
  payload: {
    message: 'This QR code has reached its usage limit. Please contact support.'
  }
}
```

---

## 7. Real-Time vs Scheduled Execution

### Real-Time (Scan Threshold):
- ✅ **Immediate**: Triggers instantly when threshold is reached
- ✅ **No delay**: QR is paused right after the scan that crosses the threshold
- ✅ **Message appears**: Next scan attempt shows the pause message

### Scheduled (Backend Function):
- ⏰ **Up to 15 minutes delay**: Backend function runs every 15 minutes
- ⏰ **Batch processing**: Multiple automations checked at once
- ⏰ **Message appears**: When someone tries to scan after automation executes

---

## 8. Technical Details

### Where Messages Are Stored:

1. **Firestore Document** (`pin_protected_qr_codes/{qrId}`):
   ```javascript
   {
     automationStatus: 'paused',
     automationPausedAt: Timestamp,
     automationPausedBy: 'Workflow Name',
     automationPausedReason: 'Full message text'
   }
   ```

2. **Error Display** (`QRScanner.tsx`):
   - Checks `automationStatus === 'paused'` during PIN verification
   - Throws error with `automationPausedReason` message
   - Error is caught and displayed in PIN dialog + toast

3. **Execution Status** (`WorkflowAutomations.tsx`):
   - Reads `lastRunAt` from workflow document
   - Displays execution status in workflow cards

---

## 9. User Experience Flow

### Scenario: Scan Threshold Automation

1. **User creates automation**:
   - Threshold: 10 scans
   - Action: Pause QR
   - Status: Active

2. **QR is scanned 10 times**:
   - Scans 1-9: Normal operation
   - Scan 10: Threshold reached → QR paused immediately

3. **Scan 11 attempt**:
   - User scans QR
   - Enters PIN
   - **Error shown**: "⏸️ This QR code has been automatically paused after reaching 10 scans..."
   - **Toast appears**: Same message in notification
   - QR code cannot be accessed

4. **QR owner checks Automations tab**:
   - Sees workflow card with: "✅ Executed 5 minutes ago"
   - Knows automation has triggered

---

## 10. Best Practices

### For Clear Messaging:

1. **Use descriptive workflow names**: 
   - ❌ "Auto Pause"
   - ✅ "Pause After 100 Scans"

2. **Provide custom messages**:
   - Include context about why QR is paused
   - Add contact information if needed
   - Explain next steps if applicable

3. **Monitor execution status**:
   - Check Automations tab regularly
   - Review execution timestamps
   - Verify automations are working as expected

---

## Summary

- **Scanners see**: Error message in PIN dialog + Toast notification when trying to access paused QR
- **QR owners see**: Execution status in Automations tab workflow cards
- **Messages are**: Context-aware, customizable, and informative
- **Timing**: Real-time for scan threshold, up to 15 min delay for scheduled automations

