# Auto-Redirect Feature for QR Codes

## Overview
The QR Scanner app now automatically redirects users to the appropriate applications based on the QR code content type. This provides a seamless user experience by eliminating the need to manually click buttons to open URLs, send emails, make calls, etc.

## How Auto-Redirect Works

### Automatic Detection and Redirection
When a QR code is scanned (either via camera or file upload), the app:
1. **Scans the QR code** and displays the content
2. **Analyzes the content type** (URL, email, phone, SMS, WiFi, contact, etc.)
3. **Waits 1 second** to let users see the scanned content
4. **Automatically redirects** to the appropriate app or action

### Supported Content Types

#### 🌐 **Website URLs**
- **Formats**: `http://example.com`, `https://example.com`, `example.com`, `www.example.com`
- **Action**: Opens the website in a new browser tab
- **Toast**: "Website detected! Opening..."

#### 📧 **Email Addresses**
- **Formats**: `mailto:user@example.com`, `user@example.com`
- **Action**: Opens default email application to compose email
- **Toast**: "Email detected! Opening..."

#### 📞 **Phone Numbers**
- **Formats**: `tel:+1234567890`, `+1234567890`, `1234567890`
- **Action**: Opens phone application to make a call
- **Toast**: "Phone number detected! Opening..."

#### 💬 **SMS Messages**
- **Formats**: `sms:+1234567890`, `sms:+1234567890?body=Hello`
- **Action**: Opens messaging application to send SMS
- **Toast**: "SMS detected! Opening..."

#### 📶 **WiFi Networks**
- **Format**: `WIFI:T:WPA;S:NetworkName;P:Password;;`
- **Action**: Attempts to connect to WiFi network
- **Toast**: "WiFi QR code detected! Redirecting..."

#### 👤 **Contact Cards**
- **Format**: `MECARD:N:John Doe;TEL:+1234567890;EMAIL:john@example.com;;`
- **Action**: Downloads a .vcf contact file for adding to contacts
- **Toast**: "Contact card detected! Downloading..."

#### 🔍 **Plain Text**
- **Format**: Any plain text under 100 characters
- **Action**: Opens Google search for the text (after 2 seconds)
- **Toast**: "Search Option Available"

## Technical Implementation

### Auto-Redirect Function
```typescript
const handleAutoRedirect = (data: string) => {
  // Detects content type and redirects accordingly
  if (data.startsWith('WIFI:')) {
    handleWiFiConnection(data);
  } else if (data.startsWith('MECARD:')) {
    handleContactCard(data);
  } else if (data.startsWith('http')) {
    window.open(data, '_blank');
  } else if (data.startsWith('mailto:')) {
    window.location.href = data;
  } else if (data.startsWith('tel:')) {
    window.location.href = data;
  } else if (data.startsWith('sms:')) {
    window.location.href = data;
  } else if (isValidUrl(data)) {
    window.open(`https://${data}`, '_blank');
  } else if (isValidEmail(data)) {
    window.location.href = `mailto:${data}`;
  } else if (isValidPhoneNumber(data)) {
    window.location.href = `tel:${data}`;
  } else {
    handlePlainText(data);
  }
};
```

### Timing and User Experience
- **1 second delay**: Allows users to see the scanned content before redirect
- **Toast notifications**: Inform users about the detected content type and action
- **Manual buttons**: Still available for users who want manual control
- **Error handling**: Graceful fallback if auto-redirect fails

## Features

### 🎯 **Smart Content Detection**
- Recognizes URLs without protocols (adds https automatically)
- Validates email addresses and phone numbers
- Handles international phone number formats
- Supports various WiFi security types

### 📱 **Cross-Platform Compatibility**
- **Desktop**: Opens default applications (browser, email client, etc.)
- **Mobile**: Uses native URL schemes to open mobile apps
- **Android**: Special handling for WiFi connections and intents
- **iOS**: Optimized for iOS app launching

### 🔒 **PIN Protection Integration**
- Auto-redirect works with PIN-protected QR codes
- Redirects only after successful PIN verification
- Maintains security while providing convenience

### 🎨 **Enhanced User Interface**
- **Dynamic toast messages** based on content type
- **Contextual button labels** (e.g., "📞 Call Number", "📧 Open Email")
- **Visual feedback** during redirect process
- **Loading states** and progress indicators

## Usage Examples

### Example 1: Website QR Code
```
QR Content: https://github.com
1. Scan QR code
2. See "Website detected! Opening..." toast
3. After 1 second, GitHub opens in new tab
```

### Example 2: Contact Card QR Code
```
QR Content: MECARD:N:John Doe;TEL:+1234567890;EMAIL:john@example.com;;
1. Scan QR code
2. See "Contact card detected! Downloading..." toast
3. After 1 second, john-doe.vcf file downloads
4. Open file to add contact to phone/computer
```

### Example 3: Phone Number QR Code
```
QR Content: tel:+1234567890
1. Scan QR code
2. See "Phone number detected! Opening..." toast
3. After 1 second, phone app opens ready to call
```

### Example 4: WiFi QR Code
```
QR Content: WIFI:T:WPA;S:MyNetwork;P:MyPassword;;
1. Scan QR code
2. See "WiFi QR code detected! Redirecting..." toast
3. After 1 second, attempts WiFi connection
4. Shows connection status and instructions
```

## Manual Override
Users can still manually trigger actions using the enhanced buttons:
- **🌐 Open Website** - For URLs
- **📧 Open Email** - For email addresses
- **📞 Call Number** - For phone numbers
- **💬 Send SMS** - For SMS messages
- **📶 Connect to WiFi** - For WiFi networks
- **👤 Download Contact** - For contact cards

## Error Handling
- **Redirect failures**: Shows error toast with manual options
- **Invalid content**: Graceful fallback to plain text handling
- **Network issues**: Provides alternative instructions
- **Unsupported formats**: Offers copy-to-clipboard functionality

## Security Considerations
- **Safe redirects**: Only opens trusted URL schemes
- **No arbitrary code execution**: Content is validated before redirect
- **User control**: 1-second delay allows users to cancel if needed
- **PIN protection**: Maintains security for protected content

## Benefits
- **Seamless UX**: No manual button clicks required
- **Universal compatibility**: Works across all platforms and devices
- **Smart detection**: Handles various formats automatically
- **Time-saving**: Instant action after scanning
- **Intuitive**: Users get immediate feedback and action

The auto-redirect feature transforms the QR scanning experience from a multi-step process to a single, seamless action, making the app more user-friendly and efficient. 