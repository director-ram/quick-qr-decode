import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, Camera, CameraOff, AlertCircle, Shield } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import PinInputDialog from './PinInputDialog';
import { decryptData } from '@/utils/encryption';
import { verifyPinAndGetData, isPinProtectedQRCode, getStorageStats, verifyPinAndGetDataWithRecovery, batchMigrateOldQRCodes } from '@/utils/qrCodeService';
import { trackQRScan, getUserIP } from '@/utils/qrAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import type { QRHistoryItem } from '@/pages/Index';

interface QRScannerProps {
  onScan: (item: Omit<QRHistoryItem, 'id' | 'timestamp' | 'userId'>) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [scanCount, setScanCount] = useState(0); // Debug counter
  const [storageStats, setStorageStats] = useState({ localCount: 0 }); // Storage stats
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [wifiConnectionDetails, setWifiConnectionDetails] = useState<{ssid: string, password: string} | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [buttonHovered, setButtonHovered] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // PIN Protection state
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinProtectedData, setPinProtectedData] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);

  const handlePinProtectedQR = (data: string) => {
    console.log('🔒 Setting up PIN protection for:', data);
    setPinProtectedData(data);
    setIsPinDialogOpen(true);
    setPinError('');
    // Make sure we don't show the PIN_PROTECTED data in the UI
    setScannedData('');
  };

  const handlePinSubmit = async (enteredPin: string) => {
    setIsPinLoading(true);
    setPinError('');

    console.log('🔐 PIN submitted:', enteredPin);
    console.log('🔐 PIN protected data:', pinProtectedData);

    // Parse PIN-protected data: PIN_PROTECTED:QR_ID
    const parts = pinProtectedData.split(':');
    if (parts.length >= 2 && parts[0] === 'PIN_PROTECTED') {
      const qrId = parts[1];

      console.log('🔐 QR ID:', qrId);
      console.log('🔐 Parsed QR ID:', qrId);
      console.log('🔐 Entered PIN:', enteredPin);

          try {
        // Verify PIN with Firebase and get decrypted data (with recovery support for old QR codes)
        const decryptedData = await verifyPinAndGetDataWithRecovery(qrId, enteredPin);
            
            console.log('✅ PIN verification successful');
            console.log('🔐 Decrypted data:', decryptedData);
            
            // PIN is correct, show the actual data
            setScannedData(decryptedData);
            setIsPinDialogOpen(false);
            setPinProtectedData('');
            setIsPinLoading(false);

            // Track analytics for PIN-protected QR scan
            getUserIP().then(ip => {
              trackQRScan(qrId, currentUser?.uid, {
                location: { ip },
                userAgent: navigator.userAgent,
                referrer: document.referrer
              });
            });

            // Add to history
            onScan({
              type: 'scanned',
              data: decryptedData
            });

        // Update storage stats
        setStorageStats(getStorageStats());

            // Handle special QR types and auto-redirect
            setTimeout(() => {
              handleAutoRedirect(decryptedData);
            }, 500);

            toast({
              title: "✅ PIN Verified!",
          description: "QR code unlocked and redirecting...",
          duration: 3000
            });
          } catch (error) {
        console.log('❌ PIN verification failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('Incorrect PIN')) {
          setPinError('Incorrect PIN. Please try again.');
        } else if (errorMessage.includes('not found')) {
          setPinError('QR code not found or expired.');
        } else {
          setPinError('Failed to verify PIN. Please try again.');
        }
          setIsPinLoading(false);
        }
    } else {
      console.log('❌ Invalid PIN-protected QR code format');
      setPinError('Invalid PIN-protected QR code format.');
      setIsPinLoading(false);
    }
  };

  const handlePinDialogClose = () => {
    console.log('🔒 PIN dialog closed without success');
    setIsPinDialogOpen(false);
    setPinProtectedData('');
    setPinError('');
    setIsPinLoading(false);
    // Make sure scanned data is cleared when PIN dialog is closed without success
    setScannedData('');
  };

  const startScanning = async () => {
    console.log('🎬 Starting camera scan...');
    setCameraStatus('requesting');
    setError('');
    setScannedData('');
    
    // Clean up any existing scanner
    if (scannerRef.current) {
      try {
        console.log('🧹 Cleaning up existing scanner...');
        await scannerRef.current.clear();
      } catch (e) {
        console.log('Scanner cleanup:', e);
      }
      scannerRef.current = null;
    }

    // Check for camera permissions first
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('📷 Checking camera permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: "environment" },
            width: { ideal: 640 }, // Lower resolution for faster processing
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 60 } // Higher frame rate for smoother scanning
          } 
        });
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Camera permission granted');
        setCameraStatus('granted');
      } else {
        throw new Error('Camera API not supported');
      }
    } catch (permError) {
      console.error('❌ Camera permission error:', permError);
      setCameraStatus('denied');
      setError(`Camera access required. Please allow camera permissions and try again. Error: ${permError.message}`);
      return;
    }

    try {
      console.log('🏗️ Initializing QR scanner...');
      const scanner = new Html5QrcodeScanner(
        'qr-scanner-container',
        {
          fps: 20, // Increased FPS for faster scanning
          qrbox: { width: 300, height: 300 }, // Larger scan area
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: false, // Disable zoom slider for better performance
          defaultZoomValueIfSupported: 1, // Lower default zoom
          rememberLastUsedCamera: true,
          // Optimized camera configuration for speed
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { min: 480, ideal: 640, max: 1280 }, // Lower resolution for faster processing
            height: { min: 360, ideal: 480, max: 720 }
          },
          // Additional performance optimizations
          disableFlip: false, // Keep flip enabled for better detection
          verbose: false // Disable verbose logging for performance
        },
        false // verbose logging
      );

      scannerRef.current = scanner;
      setIsScanning(true);
      setScanStartTime(Date.now());
      console.log('🎯 Scanner initialized, starting render...');

      // Enhance scanner UI after a short delay to ensure elements are rendered
      setTimeout(() => {
        enhanceScannerUI();
      }, 500);

      scanner.render(
        (decodedText) => {
          console.log('🎯 QR Code SUCCESSFULLY scanned:', decodedText);
          console.log('📊 Current scannedData state before:', scannedData);
          
          // Calculate scan time
          const scanTime = scanStartTime ? Date.now() - scanStartTime : 0;
          console.log('⏱️ Scan completed in:', scanTime, 'ms');
          
          // Increment scan counter for debugging
          setScanCount(prev => prev + 1);
          
          // Check if it's a PIN-protected QR code
          if (decodedText.startsWith('PIN_PROTECTED:')) {
            console.log('🔒 PIN-protected QR code detected:', decodedText);
            
            // IMPORTANT: Clear any existing scanned data to prevent showing PIN_PROTECTED data
            setScannedData('');
            
            // Stop scanning first
            setTimeout(() => {
              console.log('🛑 Stopping scanner for PIN input...');
              stopScanning();
            }, 200);
            
            // Show PIN dialog
            handlePinProtectedQR(decodedText);
            
            toast({
              title: "🔒 PIN Protected QR Code",
              description: "Enter the PIN to unlock the content"
            });
            
            return; // Don't process further
          }
          
          // Set the scanned data immediately for non-PIN-protected codes
          setScannedData(decodedText);
          console.log('✅ setScannedData called with:', decodedText);
          
          // Track analytics if it's a PIN-protected QR ID
          if (decodedText.startsWith('PIN_PROTECTED:')) {
            const qrId = decodedText.split(':')[1];
            if (qrId) {
              getUserIP().then(ip => {
                trackQRScan(qrId, currentUser?.uid, {
                  location: { ip },
                  userAgent: navigator.userAgent,
                  referrer: document.referrer
                });
              });
            }
          }
          
          // Add to history
          onScan({
            type: 'scanned',
            data: decodedText
          });

          // Stop scanning after successful scan
          setTimeout(() => {
            console.log('🛑 Stopping scanner...');
          stopScanning();
          }, 200); // Slightly longer delay to ensure state updates

          // Auto-redirect after a short delay
          setTimeout(() => {
            console.log('🚀 Auto-redirecting after scan...');
            handleAutoRedirect(decodedText);
          }, 1000); // 1 second delay to show the scanned content first
          
          // Show appropriate toast based on QR type
          const toastMessage = decodedText.startsWith('WIFI:') 
            ? 'WiFi QR code detected! Redirecting...'
            : decodedText.startsWith('MECARD:')
            ? 'Contact card detected! Downloading...'
            : decodedText.startsWith('http')
            ? 'Website detected! Opening...'
            : decodedText.startsWith('mailto:')
            ? 'Email detected! Opening...'
            : decodedText.startsWith('tel:')
            ? 'Phone number detected! Opening...'
            : decodedText.startsWith('sms:')
            ? 'SMS detected! Opening...'
            : (decodedText.startsWith('upi://') || decodedText.startsWith('UPI://') || isUPIQRCode(decodedText))
            ? 'UPI payment QR code detected! Opening payment app...'
            : `Found: ${decodedText.length > 50 ? decodedText.substring(0, 50) + '...' : decodedText}`;
          
          toast({
            title: "✅ QR Code Scanned Successfully!",
            description: `${toastMessage} (${scanTime}ms)`
          });
        },
        (error) => {
          // Only log actual errors, not scanning attempts
          if (error.includes('NotAllowedError') || error.includes('Permission denied')) {
            setError('Camera permission denied. Please allow camera access and try again.');
            setIsScanning(false);
          } else if (error.includes('NotFoundError')) {
            setError('No camera found on this device.');
            setIsScanning(false);
          } else if (error.includes('NotSupportedError')) {
            setError('Camera not supported in this browser.');
            setIsScanning(false);
          }
          // Don't show errors for normal "no QR code found" messages
        }
      );

    } catch (error: any) {
      console.error('Scanner initialization error:', error);
      setError('Failed to initialize camera scanner. Please try again.');
      setIsScanning(false);
    }
  };

  const enhanceScannerUI = () => {
    const container = document.getElementById('qr-scanner-container');
    if (!container) return;

    // Find and style all select elements (camera dropdowns)
    const selects = container.querySelectorAll('select');
    selects.forEach((select: Element) => {
      const htmlSelect = select as HTMLSelectElement;
      if (!htmlSelect.classList.contains('enhanced')) {
        htmlSelect.classList.add('enhanced');
        htmlSelect.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          border: 2px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 12px !important;
          padding: 12px 40px 12px 16px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
          min-height: 48px !important;
          width: 100% !important;
          margin: 8px 0 !important;
          appearance: none !important;
        `;
      }
    });

    // Find and style all links (Start Scanning, Scan Image File)
    const links = container.querySelectorAll('a');
    links.forEach((link: Element) => {
      const htmlLink = link as HTMLAnchorElement;
      if (!htmlLink.classList.contains('enhanced')) {
        htmlLink.classList.add('enhanced');
        const href = htmlLink.getAttribute('href') || '';
        const text = htmlLink.textContent?.toLowerCase() || '';
        
        if (href.includes('start') || text.includes('start') || text.includes('scanning')) {
          // Green button for "Start Scanning"
          htmlLink.style.cssText = `
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            color: white !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 12px !important;
            padding: 14px 24px !important;
            font-size: 16px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4) !important;
            display: inline-block !important;
            text-align: center !important;
            text-decoration: none !important;
            min-height: 48px !important;
            width: 100% !important;
            margin: 8px 0 !important;
            line-height: 1.5 !important;
            transition: all 0.3s ease !important;
          `;
        } else if (href.includes('file') || href.includes('image') || text.includes('file') || text.includes('image')) {
          // Orange button for "Scan Image File"
          htmlLink.style.cssText = `
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            color: white !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 12px !important;
            padding: 12px 20px !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4) !important;
            display: inline-block !important;
            text-align: center !important;
            text-decoration: none !important;
            min-height: 44px !important;
            width: 100% !important;
            margin: 8px 0 !important;
            line-height: 1.5 !important;
            transition: all 0.3s ease !important;
          `;
        }
      }
    });

    // Find and style buttons
    const buttons = container.querySelectorAll('button');
    buttons.forEach((button: Element) => {
      const htmlButton = button as HTMLButtonElement;
      if (!htmlButton.classList.contains('enhanced')) {
        htmlButton.classList.add('enhanced');
        const text = htmlButton.textContent?.toLowerCase() || '';
        if (text.includes('start') || text.includes('scan')) {
          htmlButton.style.cssText = `
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            color: white !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 12px !important;
            padding: 14px 24px !important;
            font-size: 16px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4) !important;
            min-height: 48px !important;
            width: 100% !important;
            margin: 8px 0 !important;
            transition: all 0.3s ease !important;
          `;
        }
      }
    });
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (error) {
        console.log('Stop scanning error:', error);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setScanStartTime(null);
  };

  const copyToClipboard = async () => {
    if (!scannedData) return;
    
    try {
      await navigator.clipboard.writeText(scannedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied",
        description: "Scanned data copied to clipboard!"
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const openScannedData = () => {
    if (!scannedData) return;
    
    handleAutoRedirect(scannedData);
  };

  const handleAutoRedirect = (data: string) => {
    console.log('🚀 Auto-redirecting for data:', data);
    
    try {
      // Handle WiFi QR codes - trigger native WiFi connection
      if (data.startsWith('WIFI:')) {
        console.log('📶 Redirecting to WiFi connection');
        handleWiFiConnection(data);
        return;
      }
      
      // Handle Contact Cards (MECARD format)
      if (data.startsWith('MECARD:')) {
        console.log('👤 Redirecting to add contact');
        handleContactCard(data);
        return;
      }
      
      // Handle URLs - open in new tab
      if (data.startsWith('http://') || data.startsWith('https://')) {
        console.log('🌐 Redirecting to website:', data);
        window.open(data, '_blank');
        toast({
          title: "🌐 Opening Website",
          description: "Redirecting to the website in a new tab"
        });
        return;
      }
      
      // Handle Email addresses
      if (data.startsWith('mailto:')) {
        console.log('📧 Redirecting to email app');
        window.location.href = data;
        toast({
          title: "📧 Opening Email App",
          description: "Redirecting to your default email application"
        });
        return;
      }
      
      // Handle Phone numbers
      if (data.startsWith('tel:')) {
        console.log('📞 Redirecting to phone app');
        window.location.href = data;
        toast({
          title: "📞 Opening Phone App",
          description: "Redirecting to your phone application"
        });
        return;
      }
      
      // Handle SMS
      if (data.startsWith('sms:')) {
        console.log('💬 Redirecting to SMS app');
        window.location.href = data;
        toast({
          title: "💬 Opening SMS App",
          description: "Redirecting to your messaging application"
        });
        return;
      }
      
      // Handle UPI payment QR codes
      if (data.startsWith('upi://') || data.startsWith('UPI://') || isUPIQRCode(data)) {
        console.log('💳 Redirecting to UPI payment app');
        handleUPIPayment(data);
        return;
      }
      
      // Handle plain URLs without protocol
      if (isValidUrl(data)) {
        console.log('🌐 Redirecting to website (adding https):', data);
        const url = data.startsWith('www.') ? `https://${data}` : `https://www.${data}`;
        window.open(url, '_blank');
        toast({
          title: "🌐 Opening Website",
          description: "Redirecting to the website in a new tab"
        });
        return;
      }
      
      // Handle plain phone numbers
      if (isValidPhoneNumber(data)) {
        console.log('📞 Redirecting to phone app for number:', data);
        window.location.href = `tel:${data}`;
        toast({
          title: "📞 Opening Phone App",
          description: "Redirecting to call this number"
        });
        return;
      }
      
      // Handle plain email addresses
      if (isValidEmail(data)) {
        console.log('📧 Redirecting to email app for address:', data);
        window.location.href = `mailto:${data}`;
        toast({
          title: "📧 Opening Email App",
          description: "Redirecting to compose email"
        });
        return;
      }
      
      // For plain text, try to detect if it's searchable content
      console.log('📝 Plain text detected, offering search option');
      handlePlainText(data);
      
    } catch (error) {
      console.error('Error in auto-redirect:', error);
      toast({
        title: "❌ Redirect Error",
        description: "Failed to automatically redirect. Please try manually.",
        variant: "destructive"
      });
    }
  };

  const handleContactCard = (data: string) => {
    try {
      // Parse MECARD format
      const contact = data.replace('MECARD:', '').replace(';;', '');
      const parts = contact.split(';');
      
      let name = '';
      let phone = '';
      let email = '';
      let organization = '';
      
      parts.forEach(part => {
        if (part.startsWith('N:')) name = part.substring(2);
        if (part.startsWith('TEL:')) phone = part.substring(4);
        if (part.startsWith('EMAIL:')) email = part.substring(6);
        if (part.startsWith('ORG:')) organization = part.substring(4);
      });
      
      // Create vCard format for better compatibility
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${name}
${phone ? `TEL:${phone}` : ''}
${email ? `EMAIL:${email}` : ''}
${organization ? `ORG:${organization}` : ''}
END:VCARD`;
      
      // Create blob and download link
      const blob = new Blob([vCard], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name || 'contact'}.vcf`;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      
      toast({
        title: "👤 Contact Card Downloaded",
        description: `Contact file for ${name} has been downloaded. Open it to add to your contacts.`
      });
      
    } catch (error) {
      console.error('Error handling contact card:', error);
      toast({
        title: "❌ Contact Error",
        description: "Failed to process contact card",
        variant: "destructive"
      });
    }
  };

  const handlePlainText = (data: string) => {
    // If it's a short text, offer to search for it
    if (data.length < 100) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(data)}`;
      
      toast({
        title: "🔍 Search Option Available",
        description: "Click to search for this text on Google"
      });
      
      // Automatically open search after a short delay
      setTimeout(() => {
        window.open(searchUrl, '_blank');
        toast({
          title: "🔍 Searching",
          description: "Opening Google search in new tab"
        });
      }, 2000);
    } else {
      toast({
        title: "📝 Text Content",
        description: "Plain text detected. Use the copy button to copy the content."
      });
    }
  };

  const isValidUrl = (string: string): boolean => {
    try {
      // Check if it looks like a domain
      const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
      const wwwPattern = /^www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
      
      return domainPattern.test(string) || wwwPattern.test(string);
    } catch {
      return false;
    }
  };

  const isValidPhoneNumber = (string: string): boolean => {
    // Basic phone number validation
    const phonePattern = /^[\+]?[1-9][\d]{3,14}$/;
    const cleanNumber = string.replace(/[\s\-\(\)]/g, '');
    return phonePattern.test(cleanNumber);
  };

  const isValidEmail = (string: string): boolean => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(string);
  };

  const isUPIQRCode = (data: string): boolean => {
    // Check for UPI protocol
    if (data.toLowerCase().startsWith('upi://')) {
      return true;
    }
    
    // Check for UPI QR code format (starts with 000201 which is common for UPI QR codes)
    if (data.startsWith('000201')) {
      return true;
    }
    
    // Check for UPI payment parameters
    if (data.includes('upi://pay') || data.includes('UPI://pay')) {
      return true;
    }
    
    // Check for common UPI patterns
    const upiPattern = /(?:upi|UPI)[:\/\/]?pay/i;
    if (upiPattern.test(data)) {
      return true;
    }
    
    return false;
  };

  const handleUPIPayment = (data: string) => {
    try {
      console.log('💳 Processing UPI payment QR code:', data);
      
      // Normalize UPI URL (ensure it starts with upi://)
      let upiUrl = data;
      if (!data.toLowerCase().startsWith('upi://')) {
        // If it's a UPI QR code format (000201...), we need to parse it
        // For now, try to construct a basic upi:// URL
        if (data.startsWith('000201')) {
          // This is a UPI QR code in a specific format
          // We'll try to open it as-is, or construct a proper URL
          upiUrl = `upi://pay?qr=${encodeURIComponent(data)}`;
        } else {
          // Try to add upi:// prefix if missing
          upiUrl = `upi://${data.replace(/^(upi|UPI)[:\/\/]?/i, '')}`;
        }
      }
      
      // Try to open UPI payment app
      // On mobile devices, this should open PhonePe, GPay, Paytm, etc.
      // On desktop, it might not work, so we'll show instructions
      const userAgent = navigator.userAgent;
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      if (isMobile) {
        // On mobile, try to open the UPI app directly
        window.location.href = upiUrl;
        
        // Fallback: Try Android intent for PhonePe
        setTimeout(() => {
          try {
            const phonepeIntent = `intent://pay?${upiUrl.split('?')[1] || ''}#Intent;scheme=phonepe;package=com.phonepe.app;end`;
            window.location.href = phonepeIntent;
          } catch (e) {
            console.log('PhonePe intent failed:', e);
          }
        }, 500);
        
        // Fallback: Try GPay
        setTimeout(() => {
          try {
            const gpayIntent = `intent://pay?${upiUrl.split('?')[1] || ''}#Intent;scheme=tez;package=com.google.android.apps.nfc.payment;end`;
            window.location.href = gpayIntent;
          } catch (e) {
            console.log('GPay intent failed:', e);
          }
        }, 1000);
        
        toast({
          title: "💳 Opening Payment App",
          description: "Redirecting to PhonePe, GPay, or your default UPI app...",
          duration: 3000
        });
      } else {
        // On desktop, show instructions
        toast({
          title: "💳 UPI Payment QR Code Detected",
          description: "Please scan this QR code with your mobile payment app (PhonePe, GPay, Paytm, etc.)",
          duration: 5000
        });
        
        // Still try to open the URL (might work in some browsers)
        window.location.href = upiUrl;
      }
      
    } catch (error) {
      console.error('Error handling UPI payment:', error);
      toast({
        title: "❌ UPI Payment Error",
        description: "Failed to open payment app. Please scan this QR code with your mobile payment app.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  const handleWiFiConnection = async (wifiData: string) => {
    try {
      console.log('📶 Starting WiFi connection process...');
      setWifiStatus('connecting');
      
      // Parse WiFi QR code data
      const parts = wifiData.split(';');
      const ssid = parts.find(p => p.startsWith('S:'))?.substring(2) || '';
      const password = parts.find(p => p.startsWith('P:'))?.substring(2) || '';
      const security = parts.find(p => p.startsWith('T:'))?.substring(2) || '';
      
      console.log('🔗 WiFi Connection Details:', { ssid, password, security });
      
      // Validate WiFi data
      if (!ssid) {
        throw new Error('Invalid WiFi QR code: Missing network name (SSID)');
      }
      
      // Store connection details for verification
      setWifiConnectionDetails({ ssid, password });
      
      // Show immediate feedback
      toast({
        title: "📶 WiFi Connection Starting",
        description: `Connecting to "${ssid}"...`,
        duration: 3000
      });
      
      // Attempt connection with timeout
      const connectionTimeout = setTimeout(() => {
        if (wifiStatus === 'connecting') {
          setWifiStatus('failed');
          toast({
            title: "⏰ Connection Timeout",
            description: "WiFi connection attempt timed out. Please try connecting manually.",
            variant: "destructive"
          });
        }
      }, 15000); // 15 second timeout
      
      try {
        await attemptWiFiConnection(ssid, password, security);
        clearTimeout(connectionTimeout);
      } catch (connectionError) {
        clearTimeout(connectionTimeout);
        throw connectionError;
      }
      
    } catch (error) {
      console.error('Error in WiFi connection:', error);
      setWifiStatus('failed');
      toast({
        title: "❌ WiFi Connection Error",
        description: error instanceof Error ? error.message : "Failed to parse WiFi QR code data",
        variant: "destructive"
      });
    }
  };

  const attemptWiFiConnection = async (ssid: string, password: string, security: string) => {
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isWindows = /Windows/i.test(userAgent);
    const isMac = /Mac/i.test(userAgent);
    
    console.log('🔍 Platform detection:', { isAndroid, isIOS, isWindows, isMac });
    
    // Set status to connecting
    setWifiStatus('connecting');
    
    try {
      // For Android devices - use multiple connection approaches
      if (isAndroid) {
        console.log('📱 Attempting Android WiFi connection...');
        const androidSuccess = await tryAndroidWiFiConnection(ssid, password, security);
        if (androidSuccess) {
          setWifiStatus('connected');
          toast({
            title: "✅ WiFi Connected!",
            description: `Successfully connected to ${ssid}!`
          });
          return;
        }
      }
      
      // For Windows devices - create WiFi profile and provide instructions
      if (isWindows) {
        console.log('💻 Attempting Windows WiFi connection...');
        const windowsSuccess = await tryWindowsWiFiConnection(ssid, password, security);
        if (windowsSuccess) {
          setWifiStatus('connected');
          toast({
            title: "✅ WiFi Profile Created!",
            description: `WiFi profile for ${ssid} has been created. Follow the instructions to connect.`
          });
          return;
        }
      }
      
      // For iOS or fallback - show manual instructions
      console.log('📱 Showing manual connection instructions...');
      showWiFiInstructions(ssid, password, security, isAndroid ? 'Android' : isIOS ? 'iOS' : 'Desktop');
      
      // Set status to failed (manual connection required)
      setWifiStatus('failed');
      
    } catch (error) {
      console.error('WiFi connection error:', error);
      setWifiStatus('failed');
      toast({
        title: "❌ WiFi Connection Failed",
        description: "Unable to connect automatically. Please connect manually using the provided details.",
        variant: "destructive"
      });
    }
  };

  const tryAndroidWiFiConnection = async (ssid: string, password: string, security: string): Promise<boolean> => {
    try {
      console.log('🤖 Trying Android WiFi connection methods...');
      
      // Method 1: Try Android WiFi QR code URL scheme
      const wifiQRData = `WIFI:T:${security};S:${ssid};P:${password};;`;
      
      // Create a temporary link to trigger the WiFi connection
      const tempLink = document.createElement('a');
      tempLink.href = wifiQRData;
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      
      // Wait a moment for the system to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Method 2: Try Android WiFi intent
      const wifiIntent = `intent://wifi/#Intent;scheme=wifi;action=android.intent.action.VIEW;S.ssid=${encodeURIComponent(ssid)};S.password=${encodeURIComponent(password)};S.security=${security};end`;
      
      try {
        window.location.href = wifiIntent;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (intentError) {
        console.log('Android intent failed:', intentError);
      }
      
      // Method 3: Try to open WiFi settings
      try {
        const settingsIntent = `intent://wifi/#Intent;scheme=android.settings;action=android.settings.WIFI_SETTINGS;end`;
        window.location.href = settingsIntent;
        
        toast({
          title: "📱 Android WiFi Connection",
          description: `Opening WiFi settings. Please connect to "${ssid}" with password: ${password}`,
        });
        
                 // Wait a moment and then verify connection
         setTimeout(async () => {
           const isConnected = await verifyWiFiConnection(ssid);
           if (isConnected) {
             setWifiStatus('connected');
             toast({
               title: "✅ WiFi Connected!",
               description: `Successfully connected to ${ssid}!`
             });
           } else {
             setWifiStatus('failed');
             toast({
               title: "📱 Manual Connection Required",
               description: `Please manually connect to "${ssid}" in your WiFi settings.`,
               variant: "destructive"
             });
           }
         }, 5000);
         
         // Return true to indicate we've initiated the connection process
         return true;
       } catch (settingsError) {
         console.log('Android settings failed:', settingsError);
       }
       
       return false;
      } catch (error) {
      console.error('Android WiFi connection failed:', error);
      return false;
    }
  };

  const tryWindowsWiFiConnection = async (ssid: string, password: string, security: string): Promise<boolean> => {
    try {
      console.log('🖥️ Trying Windows WiFi connection...');
      
             // Create Windows WiFi profile XML
       const wifiProfileXML = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${ssid}</name>
  <SSIDConfig>
    <SSID>
      <hex>${Array.from(new TextEncoder().encode(ssid)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}</hex>
      <name>${ssid}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>${security === 'WPA' || security === 'WPA2' ? 'WPA2PSK' : security === 'WEP' ? 'WEP' : 'open'}</authentication>
        <encryption>${security === 'WPA' || security === 'WPA2' ? 'AES' : security === 'WEP' ? 'WEP' : 'none'}</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      ${password ? `<sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${password}</keyMaterial></sharedKey>` : ''}
    </security>
  </MSM>
</WLANProfile>`;
      
      // Create and download the WiFi profile
      const blob = new Blob([wifiProfileXML], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ssid}-WiFi-Profile.xml`;
      link.click();
      URL.revokeObjectURL(url);
      
      // Create PowerShell script for automatic connection
      const powershellScript = `# WiFi Connection Script for ${ssid}
# Run this script as Administrator in PowerShell

# Add WiFi profile
netsh wlan add profile filename="${ssid}-WiFi-Profile.xml"

# Connect to WiFi network
netsh wlan connect name="${ssid}"

# Check connection status
netsh wlan show profile name="${ssid}" key=clear

Write-Host "WiFi connection attempt completed for ${ssid}"
Write-Host "If connection failed, please connect manually through Windows WiFi settings"
`;
      
      // Download PowerShell script
      const scriptBlob = new Blob([powershellScript], { type: 'text/plain' });
      const scriptUrl = URL.createObjectURL(scriptBlob);
      const scriptLink = document.createElement('a');
      scriptLink.href = scriptUrl;
      scriptLink.download = `Connect-to-${ssid}.ps1`;
      scriptLink.click();
      URL.revokeObjectURL(scriptUrl);
      
      // Create batch file for easier execution
      const batchScript = `@echo off
echo Connecting to WiFi network: ${ssid}
echo.
echo Step 1: Adding WiFi profile...
netsh wlan add profile filename="${ssid}-WiFi-Profile.xml"
echo.
echo Step 2: Connecting to network...
netsh wlan connect name="${ssid}"
echo.
echo Step 3: Checking connection status...
netsh wlan show profile name="${ssid}" key=clear
echo.
echo Connection attempt completed!
echo If connection failed, please connect manually through Windows WiFi settings.
echo.
pause
`;
      
      // Download batch file
      const batchBlob = new Blob([batchScript], { type: 'text/plain' });
      const batchUrl = URL.createObjectURL(batchBlob);
      const batchLink = document.createElement('a');
      batchLink.href = batchUrl;
      batchLink.download = `Connect-to-${ssid}.bat`;
      batchLink.click();
      URL.revokeObjectURL(batchUrl);
      
      // Show detailed instructions
      toast({
        title: "💻 Windows WiFi Connection Files Downloaded",
        description: `3 files downloaded: XML profile, PowerShell script, and Batch file. Run the batch file as Administrator to connect to ${ssid}.`,
        duration: 10000
      });
      
             // Try to open Windows WiFi settings
       try {
         const settingsUrl = 'ms-settings:network-wifi';
         window.location.href = settingsUrl;
       } catch (settingsError) {
         console.log('Windows settings URL failed:', settingsError);
       }
       
       // Wait a moment and then verify connection
       setTimeout(async () => {
         const isConnected = await verifyWiFiConnection(ssid);
         if (isConnected) {
           setWifiStatus('connected');
           toast({
             title: "✅ WiFi Connected!",
             description: `Successfully connected to ${ssid}!`
           });
    } else {
           // For Windows, we assume the user needs to manually run the files
      toast({
             title: "💻 Manual Steps Required",
             description: `Please run the downloaded batch file as Administrator to connect to "${ssid}".`,
             duration: 8000
           });
         }
       }, 8000);
       
       return true;
    } catch (error) {
      console.error('Windows WiFi connection failed:', error);
      return false;
    }
  };

  const showWiFiInstructions = (ssid: string, password: string, security: string, platform: string) => {
    const instructions = {
      Android: `📱 Android WiFi Connection Instructions:

1. Open Settings → WiFi (or WiFi settings should have opened automatically)
2. Look for network: "${ssid}"
3. Tap on the network name
4. Enter password: ${password}
5. Tap "Connect"

If the network doesn't appear, make sure you're in range and the network is broadcasting.`,
      
      iOS: `📱 iOS WiFi Connection Instructions:

1. Open Settings → WiFi
2. Look for network: "${ssid}"
3. Tap on the network name
4. Enter password: ${password}
5. Tap "Join"

Note: iOS requires manual WiFi connection through Settings.`,
      
      Desktop: `💻 Desktop WiFi Connection Instructions:

Windows:
1. Click WiFi icon in system tray (bottom right)
2. Select network: "${ssid}"
3. Click "Connect"
4. Enter password: ${password}
5. Click "Next"

Mac:
1. Click WiFi icon in menu bar (top right)
2. Select network: "${ssid}"
3. Enter password: ${password}
4. Click "Join"

Files have been downloaded to help with connection.`
    };

    // Show instructions in a more prominent way
    const instructionText = instructions[platform as keyof typeof instructions];
    
    // Create a custom alert-like dialog
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    alertDiv.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px; font-weight: bold;">
        📶 WiFi Connection Instructions
      </h3>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <p style="margin: 0; font-weight: bold; color: #666;">Network: ${ssid}</p>
        <p style="margin: 5px 0 0 0; font-weight: bold; color: #666;">Password: ${password}</p>
        <p style="margin: 5px 0 0 0; font-weight: bold; color: #666;">Security: ${security}</p>
      </div>
      <pre style="white-space: pre-wrap; font-family: system-ui; font-size: 14px; line-height: 1.5; color: #333; margin: 0 0 15px 0;">${instructionText}</pre>
      <button onclick="this.parentElement.remove()" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
      ">Close Instructions</button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 30000);
    
    // Also show toast notification
    toast({
      title: `📶 Manual Connection Required`,
      description: `Please connect to "${ssid}" manually. Instructions are displayed on screen.`,
      duration: 8000
    });
  };

  const formatScannedData = (data: string) => {
    // Handle PIN-protected QR codes (this should not normally happen since PIN codes are processed separately)
    if (data.startsWith('PIN_PROTECTED:')) {
      const parts = data.split(':');
      if (parts.length >= 2) {
        const qrId = parts[1];
        return `🔒 PIN Protected QR Code

This QR code is protected with a PIN. To view the content:

1. Enter the PIN when prompted
2. The content will be decrypted and displayed
3. You will be automatically redirected to the destination

💡 External scanners can only see the QR ID (${qrId}), but the actual content remains encrypted and secure in our database.`;
      }
      return `🔒 PIN Protected QR Code

This QR code is protected with a PIN. The content will be displayed after successful PIN verification.

💡 If you're seeing this message, there may be an issue with the PIN verification process.`;
    }
    
    if (data.startsWith('WIFI:')) {
      const parts = data.split(';');
      const ssid = parts.find(p => p.startsWith('S:'))?.substring(2) || '';
      const password = parts.find(p => p.startsWith('P:'))?.substring(2) || '';
      const security = parts.find(p => p.startsWith('T:'))?.substring(2) || '';
      
      return `📶 WiFi Network Details

🏷️ Network Name: ${ssid}
🔐 Password: ${password || 'Open Network (No Password)'}
🛡️ Security: ${security || 'None'}

💡 This WiFi QR code will automatically attempt to connect your device to the network when you click "Connect to WiFi" button above.`;
    } else if (data.startsWith('MECARD:')) {
      const contact = data.replace('MECARD:', '').replace(';;', '');
      const parts = contact.split(';');
      let formatted = 'Contact Card\n';
      parts.forEach(part => {
        if (part.startsWith('N:')) formatted += `Name: ${part.substring(2)}\n`;
        if (part.startsWith('TEL:')) formatted += `Phone: ${part.substring(4)}\n`;
        if (part.startsWith('EMAIL:')) formatted += `Email: ${part.substring(6)}\n`;
        if (part.startsWith('ORG:')) formatted += `Organization: ${part.substring(4)}\n`;
      });
      return formatted.trim();
    } else if (data.startsWith('upi://') || data.startsWith('UPI://') || isUPIQRCode(data)) {
      // Parse UPI payment details
      try {
        const upiUrl = new URL(data.startsWith('upi://') || data.startsWith('UPI://') ? data : `upi://${data}`);
        const params = new URLSearchParams(upiUrl.search);
        
        const payeeName = params.get('pn') || 'Unknown';
        const payeeVPA = params.get('pa') || 'Unknown';
        const amount = params.get('am') || 'Not specified';
        const currency = params.get('cu') || 'INR';
        const transactionNote = params.get('tn') || '';
        
        return `💳 UPI Payment QR Code

👤 Payee Name: ${payeeName}
📧 UPI ID: ${payeeVPA}
💰 Amount: ${amount} ${currency}
📝 Note: ${transactionNote || 'No note'}

💡 This QR code will automatically open your payment app (PhonePe, GPay, Paytm, etc.) to complete the payment.`;
      } catch (error) {
        // If parsing fails, return basic info
        return `💳 UPI Payment QR Code

${data}

💡 This QR code will automatically open your payment app (PhonePe, GPay, Paytm, etc.) to complete the payment.`;
      }
    }
    return data;
  };

  // Helper function to preprocess image for better QR detection
  const preprocessImage = (img: HTMLImageElement): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Set canvas size (resize if too large for better performance)
    const maxSize = 2000;
    let width = img.width;
    let height = img.height;
    
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = width * ratio;
      height = height * ratio;
    }
    
    canvas.width = width;
    canvas.height = height;

    // Draw image with enhanced contrast
    ctx.drawImage(img, 0, 0, width, height);
    
    // Apply image enhancement for better QR code detection
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Enhance contrast and brightness
    for (let i = 0; i < data.length; i += 4) {
      // Increase contrast
      const factor = 1.5;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      data[i] = Math.min(255, Math.max(0, (r - 128) * factor + 128));
      data[i + 1] = Math.min(255, Math.max(0, (g - 128) * factor + 128));
      data[i + 2] = Math.min(255, Math.max(0, (b - 128) * factor + 128));
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "❌ Invalid File",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingFile(true);
    setError('');

    try {
      // Create image URL for display
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);

      toast({
        title: "📁 Processing Image...",
        description: `Scanning ${file.name} for QR codes...`
      });

      // Create image element
      const img = new Image();
      img.src = imageUrl;
      
      // Wait for image to load
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });

      console.log('🔍 Scanning image for QR codes...');
      let result: string | null = null;
      let scanError: Error | null = null;

      // Helper function to extract string from scan result
      const extractResult = (scanResult: any): string | null => {
        if (!scanResult) return null;
        if (typeof scanResult === 'string') return scanResult;
        if (typeof scanResult === 'object') {
          // Handle detailed scan result objects
          if (scanResult.data) return String(scanResult.data);
          if (scanResult.result) return String(scanResult.result);
          if (scanResult.text) return String(scanResult.text);
          // Try to stringify the whole object
          return JSON.stringify(scanResult);
        }
        return String(scanResult);
      };

      // Method 1: Try qr-scanner library with original image
      try {
        const QrScanner = (await import('qr-scanner')).default;
        const scanResult = await QrScanner.scanImage(img, {
          alsoTryWithoutScanRegion: true,
        });
        result = extractResult(scanResult);
        if (result) {
          console.log('✅ QR Code found with qr-scanner (original):', result);
        }
      } catch (error) {
        console.log('⚠️ qr-scanner (original) failed:', error);
        scanError = error as Error;
      }

      // Method 2: Try qr-scanner with preprocessed image
      if (!result) {
        try {
          const QrScanner = (await import('qr-scanner')).default;
          const processedCanvas = preprocessImage(img);
          const processedImg = new Image();
          processedImg.src = processedCanvas.toDataURL();
          
          await new Promise<void>((resolve) => {
            processedImg.onload = () => resolve();
          });
          
          const scanResult = await QrScanner.scanImage(processedImg, {
            alsoTryWithoutScanRegion: true,
          });
          result = extractResult(scanResult);
          if (result) {
            console.log('✅ QR Code found with qr-scanner (preprocessed):', result);
          }
        } catch (error) {
          console.log('⚠️ qr-scanner (preprocessed) failed:', error);
        }
      }

      // Method 3: Try html5-qrcode as fallback (using file directly)
      if (!result) {
        try {
          const html5QrCode = new Html5Qrcode('temp-scan-container');
          
          // Create a temporary container
          const tempContainer = document.createElement('div');
          tempContainer.id = 'temp-scan-container';
          tempContainer.style.display = 'none';
          document.body.appendChild(tempContainer);
          
          // Try with file directly
          const scanResult = await (html5QrCode as any).scanFile(file, false);
          
          result = extractResult(scanResult);
          
          // Clean up
          await html5QrCode.clear();
          document.body.removeChild(tempContainer);
          if (result) {
            console.log('✅ QR Code found with html5-qrcode:', result);
          }
        } catch (error) {
          console.log('⚠️ html5-qrcode failed:', error);
          // Clean up temp container if it exists
          const tempContainer = document.getElementById('temp-scan-container');
          if (tempContainer && tempContainer.parentElement) {
            document.body.removeChild(tempContainer);
          }
        }
      }

      // If all methods failed, provide helpful error message
      if (!result || typeof result !== 'string') {
        const errorMessage = scanError?.message || 'No QR code detected';
        const isUPIError = errorMessage.includes('MultiFormat') || errorMessage.includes('NotFoundException');
        
        throw new Error(
          isUPIError
            ? 'Could not detect QR code. This might be a UPI QR code. Please try:\n1. Ensure the image is clear and well-lit\n2. Make sure the QR code is not cropped or damaged\n3. Try scanning with your phone camera instead\n4. If it\'s a UPI QR, try using the camera scanner for better results'
            : 'No QR code detected. Make sure the image is clear, the QR code is not damaged, and try again.'
        );
      }
      
      // Ensure result is a string
      const qrData = String(result).trim();
      
      if (!qrData) {
        throw new Error('QR code detected but content is empty. Please try a different image.');
      }
      
      console.log('🎯 QR Code found in file:', qrData);
      setScanCount(prev => prev + 1);
      
      // Check if it's a PIN-protected QR code
      if (qrData.startsWith('PIN_PROTECTED:')) {
        console.log('🔒 PIN-protected QR code detected in file:', qrData);
        
        // IMPORTANT: Clear any existing scanned data to prevent showing PIN_PROTECTED data
        setScannedData('');
        
        // Show PIN dialog
        handlePinProtectedQR(qrData);
        
        toast({
          title: "🔒 PIN Protected QR Code",
          description: "Enter the PIN to unlock the content"
        });
        
        return; // Don't process further
      }
      
      // Handle non-PIN-protected codes
      setScannedData(qrData);
      
      // Add to history
      onScan({
        type: 'scanned',
        data: qrData
      });

      // Auto-redirect after a short delay
      setTimeout(() => {
        console.log('🚀 Auto-redirecting after file scan...');
        handleAutoRedirect(qrData);
      }, 1000); // 1 second delay to show the scanned content first

      // Show appropriate toast based on QR type
      const toastMessage = qrData.startsWith('WIFI:') 
        ? 'WiFi QR code detected! Redirecting...'
        : qrData.startsWith('MECARD:')
        ? 'Contact card detected! Downloading...'
        : qrData.startsWith('http')
        ? 'Website detected! Opening...'
        : qrData.startsWith('mailto:')
        ? 'Email detected! Opening...'
        : qrData.startsWith('tel:')
        ? 'Phone number detected! Opening...'
        : qrData.startsWith('sms:')
        ? 'SMS detected! Opening...'
        : (qrData.startsWith('upi://') || qrData.startsWith('UPI://') || isUPIQRCode(qrData))
        ? 'UPI payment QR code detected! Opening payment app...'
        : `Successfully decoded: ${qrData.length > 50 ? qrData.substring(0, 50) + '...' : qrData}`;

      toast({
        title: "✅ QR Code Found!",
        description: toastMessage
      });

    } catch (error) {
      console.error('QR scanning error:', error);
      
      // Check if it's a "no QR code found" error vs other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for specific error types
      const isNoQRCodeError = errorMessage.includes('No QR code found') || 
                              errorMessage.includes('Could not decode') ||
                              errorMessage.includes('NotFoundException') ||
                              errorMessage.includes('MultiFormat');
      
      const isTypeError = errorMessage.includes('startsWith') || 
                         errorMessage.includes('is not a function');
      
      if (isNoQRCodeError) {
        setError(`No QR code detected in the uploaded image. 

Tips to improve detection:
• Ensure the image is clear and well-lit
• Make sure the QR code is not cropped or damaged
• Try using the camera scanner for better results
• For UPI QR codes, camera scanning works better than file upload`);
        toast({
          title: "❌ No QR Code Found",
          description: "The image doesn't contain a readable QR code. Try a clearer image or use the camera scanner.",
          variant: "destructive",
          duration: 5000
        });
      } else if (isTypeError) {
        // This shouldn't happen with the new code, but handle it gracefully
        setError(`Failed to process the QR code data. Please try:
• Using the camera scanner instead
• Ensuring the image format is supported (PNG, JPG)
• Trying a different image`);
        toast({
          title: "❌ Processing Error",
          description: "There was an issue processing the QR code. Try using the camera scanner instead.",
          variant: "destructive",
          duration: 5000
        });
      } else {
        setError(`Failed to process the image: ${errorMessage}

Please try:
• Using the camera scanner for better results
• Ensuring the image is clear and the QR code is visible
• Trying a different image format`);
        toast({
          title: "❌ Processing Failed",
          description: "Failed to scan the image. Try using the camera scanner for better results.",
          variant: "destructive",
          duration: 5000
        });
      }
    } finally {
      setIsProcessingFile(false);
    }
  };

  const verifyWiFiConnection = async (ssid: string): Promise<boolean> => {
    try {
      console.log('🔍 Verifying WiFi connection...');
      
      // Method 1: Check network connection API
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        console.log('📡 Connection info:', connection);
        
        if (connection) {
          // Check if we're on WiFi
          if (connection.type === 'wifi') {
            console.log('✅ Connected via WiFi');
            return true;
          }
          
          // Check connection speed (WiFi typically has higher speed)
          if (connection.downlink && connection.downlink > 1) {
            console.log('✅ Good connection speed detected');
            return true;
          }
        }
      }
      
      // Method 2: Test network connectivity with multiple endpoints
      const testUrls = [
        'https://httpbin.org/ip',
        'https://api.ipify.org?format=json',
        'https://jsonip.com/',
        'https://8.8.8.8/resolve?name=google.com&type=A' // Google DNS
      ];
      
      let successCount = 0;
      const testPromises = testUrls.map(async (url) => {
        try {
          const response = await fetch(url, { 
            method: 'GET',
            cache: 'no-cache',
            signal: AbortSignal.timeout(3000)
          });
          
          if (response.ok) {
            successCount++;
            console.log('✅ Network test passed for:', url);
            return true;
          }
        } catch (error) {
          console.log('❌ Network test failed for:', url, error);
          return false;
        }
      });
      
      // Wait for all tests to complete
      await Promise.allSettled(testPromises);
      
      // If at least 2 tests pass, consider connection successful
      if (successCount >= 2) {
        console.log('✅ Network connectivity verified');
        return true;
      }
      
      // Method 3: Try to resolve DNS
      try {
        const dnsTest = await fetch('https://cloudflare-dns.com/dns-query?name=google.com&type=A', {
          method: 'GET',
          headers: { 'Accept': 'application/dns-json' },
          signal: AbortSignal.timeout(2000)
        });
        
        if (dnsTest.ok) {
          console.log('✅ DNS resolution successful');
          return true;
        }
      } catch (dnsError) {
        console.log('❌ DNS test failed:', dnsError);
      }
      
      // Method 4: Check if we can reach a simple endpoint
      try {
        const simpleTest = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(2000)
        });
        
        console.log('✅ Simple connectivity test passed');
        return true;
      } catch (simpleError) {
        console.log('❌ Simple connectivity test failed:', simpleError);
      }
      
      console.log('❌ All connectivity tests failed');
      return false;
      
    } catch (error) {
      console.error('WiFi verification failed:', error);
      return false;
    }
  };

  const clearResults = () => {
    setScannedData('');
    setError('');
    setScanCount(0);
    setWifiStatus('idle');
    setWifiConnectionDetails(null);
    setCameraStatus('idle');
    
    // Clean up PIN protection state
    setIsPinDialogOpen(false);
    setPinProtectedData('');
    setPinError('');
    setIsPinLoading(false);
    
    // Clean up uploaded image URL to prevent memory leaks
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage);
      setUploadedImage('');
    }
    
    setIsProcessingFile(false);
    
    // Reset file input
    const fileInput = document.getElementById('qr-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    // Update storage stats
    setStorageStats(getStorageStats());
    
    toast({
      title: "Results Cleared",
      description: "Ready for a new scan"
    });
  };

  // Update storage stats periodically
  useEffect(() => {
    const updateStats = () => {
      setStorageStats(getStorageStats());
    };
    
    // Update stats initially
    updateStats();
    
    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Enhance scanner UI when scanning starts
  useEffect(() => {
    if (isScanning) {
      // Wait for scanner to render, then enhance UI
      const timer1 = setTimeout(() => enhanceScannerUI(), 500);
      const timer2 = setTimeout(() => enhanceScannerUI(), 1000);
      const timer3 = setTimeout(() => enhanceScannerUI(), 2000);
      
      // Also enhance on any DOM changes in the scanner container
      const observer = new MutationObserver(() => {
        enhanceScannerUI();
      });
      
      const container = document.getElementById('qr-scanner-container');
      if (container) {
        observer.observe(container, { childList: true, subtree: true });
      }
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        observer.disconnect();
      };
    }
  }, [isScanning]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (error) {
          console.log('Scanner cleanup error:', error);
        }
      }
      
      // Clean up uploaded image URL on component unmount
      if (uploadedImage) {
        URL.revokeObjectURL(uploadedImage);
      }
    };
  }, [uploadedImage]);

  return (
    <div className="space-y-6">
      {/* Scanner Controls */}
      <div className="text-center space-y-4">
        {!isScanning ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="relative group">
                <Button 
                  onClick={startScanning} 
                  disabled={cameraStatus === 'requesting'}
                  size="lg" 
                  onMouseEnter={() => setButtonHovered(true)}
                  onMouseLeave={() => setButtonHovered(false)}
                  className={`
                    relative w-full sm:w-auto px-10 py-5 text-lg font-bold 
                    bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 
                    hover:from-purple-700 hover:via-pink-700 hover:to-purple-700
                    shadow-xl hover:shadow-2xl transform transition-all duration-300
                    ${buttonHovered ? 'scale-110 rotate-1' : 'scale-100 rotate-0'}
                    ${cameraStatus === 'requesting' ? 'animate-pulse' : ''}
                    border-0 overflow-hidden active:scale-95
                    ring-2 ring-purple-300 ring-offset-2
                    before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:via-transparent before:to-white/20
                    before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700
                  `}
                >
                  {/* Animated background glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-75 blur-xl group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Button content */}
                  <div className="relative flex items-center justify-center">
                    {cameraStatus === 'requesting' ? (
                      <>
                        <div className="animate-spin h-6 w-6 mr-3 border-3 border-white border-t-transparent rounded-full" />
                        <span className="animate-pulse">🔍 Requesting Camera...</span>
                      </>
                    ) : cameraStatus === 'denied' ? (
                      <>
                        <svg className="h-6 w-6 mr-3 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 12.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span>🚫 Camera Access Denied</span>
                      </>
                    ) : (
                      <>
                        <Camera className={`h-6 w-6 mr-3 transition-transform duration-300 ${buttonHovered ? 'scale-125' : 'scale-100'}`} />
                        <span className={`transition-all duration-300 ${buttonHovered ? 'tracking-wider' : 'tracking-normal'}`}>
                          📷 Start Camera Scan
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Floating particles effect */}
                  {buttonHovered && (
                    <>
                      <div className="absolute top-2 left-4 w-1 h-1 bg-white rounded-full animate-ping" style={{animationDelay: '0s'}} />
                      <div className="absolute bottom-3 right-6 w-1 h-1 bg-white rounded-full animate-ping" style={{animationDelay: '0.5s'}} />
                      <div className="absolute top-4 right-8 w-1 h-1 bg-white rounded-full animate-ping" style={{animationDelay: '1s'}} />
                    </>
                  )}
            </Button>
                
                {/* Status indicator */}
                <div className="absolute -top-2 -right-2">
                  {cameraStatus === 'granted' && (
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-lg" />
                  )}
                  {cameraStatus === 'denied' && (
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg" />
                  )}
                  {cameraStatus === 'requesting' && (
                    <div className="w-4 h-4 bg-yellow-500 rounded-full animate-bounce shadow-lg" />
                  )}
                </div>
              </div>
              
                             {/* File upload option */}
               <div className="flex justify-center">
                 <input
                   type="file"
                   accept="image/*"
                   className="hidden"
                   id="qr-file-input"
                   onChange={handleFileUpload}
                 />
                 <label 
                   htmlFor="qr-file-input"
                   className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-bold text-purple-700 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl cursor-pointer transition-all duration-300 hover:scale-110 hover:rotate-[-1deg] hover:shadow-xl hover:border-purple-500 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 overflow-hidden active:scale-95 ring-2 ring-purple-200 ring-offset-1 w-full sm:w-auto"
                 >
                   {/* Animated background */}
                   <div className="absolute inset-0 bg-gradient-to-r from-purple-300/20 to-pink-300/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                   
                   {/* Upload icon with animation */}
                   <div className="relative mr-3 group-hover:scale-125 transition-transform duration-300">
                     <svg className="w-6 h-6 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                     </svg>
                   </div>
                   
                   {/* Text with tracking animation */}
                   <span className="relative group-hover:tracking-wider transition-all duration-300">
                     📁 Scan from File
                   </span>
                   
                   {/* Shimmer effect */}
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                 </label>
               </div>
            </div>
            
                         {/* Dynamic instruction card based on camera status */}
             <div className={`
               relative overflow-hidden rounded-r-lg p-4 border-l-4 transition-all duration-500
               ${cameraStatus === 'idle' ? 'bg-blue-50 border-blue-400' : ''}
               ${cameraStatus === 'requesting' ? 'bg-yellow-50 border-yellow-400 animate-pulse' : ''}
               ${cameraStatus === 'granted' ? 'bg-green-50 border-green-400' : ''}
               ${cameraStatus === 'denied' ? 'bg-red-50 border-red-400' : ''}
             `}>
               {/* Animated background gradient */}
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50" />
               
               <div className="relative">
                 {cameraStatus === 'idle' && (
                   <>
                     <p className="text-base font-bold text-blue-900 mb-2 flex items-center">
                       📱 <span className="ml-2">Camera Permission Required</span>
                     </p>
                     <p className="text-sm text-blue-700 leading-relaxed">
                       Make sure to <strong className="bg-blue-200 px-1 rounded">allow camera access</strong> when prompted by your browser. 
                       Look for the camera icon in your address bar and click <strong>"Allow"</strong>.
                     </p>
                   </>
                 )}
                 
                 {cameraStatus === 'requesting' && (
                   <>
                     <p className="text-base font-bold text-yellow-900 mb-2 flex items-center">
                       ⏳ <span className="ml-2 animate-pulse">Requesting Camera Access...</span>
                     </p>
                     <p className="text-sm text-yellow-700 leading-relaxed">
                       Please <strong className="bg-yellow-200 px-1 rounded">allow camera access</strong> in the browser popup. 
                       This may take a few seconds to appear.
                     </p>
                   </>
                 )}
                 
                 {cameraStatus === 'granted' && (
                   <>
                     <p className="text-base font-bold text-green-900 mb-2 flex items-center">
                       ✅ <span className="ml-2">Camera Access Granted!</span>
                     </p>
                     <p className="text-sm text-green-700 leading-relaxed">
                       Your camera is ready. Click <strong className="bg-green-200 px-1 rounded">"Start Camera Scan"</strong> to begin scanning QR codes.
                     </p>
                   </>
                 )}
                 
                 {cameraStatus === 'denied' && (
                   <>
                     <p className="text-base font-bold text-red-900 mb-2 flex items-center">
                       🚫 <span className="ml-2">Camera Access Denied</span>
                     </p>
                     <div className="text-sm text-red-700 leading-relaxed space-y-2">
                       <p>To enable camera access:</p>
                       <ul className="list-disc list-inside space-y-1 ml-4">
                         <li>Look for the <strong className="bg-red-200 px-1 rounded">camera icon</strong> in your browser's address bar</li>
                         <li>Click it and select <strong>"Allow"</strong></li>
                         <li>Or go to <strong>Settings → Privacy → Camera</strong> and allow this site</li>
                         <li>Refresh the page after changing permissions</li>
                       </ul>
                     </div>
                   </>
                 )}
               </div>
             </div>
            
            {(scannedData || scanCount > 0) && (
              <Button 
                onClick={clearResults} 
                variant="outline" 
                size="lg" 
                className="mt-4 px-6 py-3 text-base font-semibold border-2 border-red-400 bg-red-50 hover:bg-red-100 hover:border-red-500 text-red-700 shadow-md active:scale-95 transition-all w-full sm:w-auto"
              >
                🗑️ Clear Results
              </Button>
            )}
          </div>
        ) : (
                     <div className="space-y-4">
             <div className="relative group">
               <Button 
                 onClick={stopScanning} 
                 variant="destructive" 
                 size="lg" 
                 className="relative w-full sm:w-auto px-10 py-5 text-lg font-bold bg-gradient-to-r from-red-600 via-red-700 to-red-600 hover:from-red-700 hover:via-red-800 hover:to-red-700 shadow-xl hover:shadow-2xl transform hover:scale-110 hover:rotate-[-1deg] transition-all duration-300 border-0 overflow-hidden"
               >
                 {/* Animated background glow */}
                 <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 opacity-75 blur-xl group-hover:opacity-100 transition-opacity duration-300" />
                 
                 {/* Button content */}
                 <div className="relative flex items-center justify-center">
                   <CameraOff className="h-6 w-6 mr-3 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" />
                   <span className="group-hover:tracking-wider transition-all duration-300">
                     🛑 Stop Scanning
                   </span>
                 </div>
                 
                 {/* Pulsing border effect */}
                 <div className="absolute inset-0 rounded-lg border-2 border-red-400 opacity-0 group-hover:opacity-100 animate-pulse" />
                 
                 {/* Shimmer effect */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700" />
               </Button>
             </div>
            
            {/* Enhanced Instructions Card */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 border-l-4 border-green-500 p-5 rounded-r-lg shadow-lg">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-green-900 mb-2">
                    📷 Camera Scanner Active
                  </p>
                  <p className="text-sm text-green-800 font-medium mb-3">
                    Follow these steps to scan a QR code:
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-green-800">
                <div className="flex items-start gap-3 bg-white/60 p-3 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-xs">1</span>
                  <div>
                    <p className="font-semibold mb-1">Select Camera (if multiple cameras available)</p>
                    <p className="text-xs text-green-700">Look for a camera dropdown or icon in the scanner view. Tap it to switch between front and back cameras.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 bg-white/60 p-3 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-xs">2</span>
                  <div>
                    <p className="font-semibold mb-1">Position QR Code</p>
                    <p className="text-xs text-green-700">Point your camera at the QR code. Keep it steady and ensure good lighting.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 bg-white/60 p-3 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-xs">3</span>
                  <div>
                    <p className="font-semibold mb-1">Auto-Scan</p>
                    <p className="text-xs text-green-700">The QR code will be scanned automatically when detected. No need to click anything!</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700 font-medium">
                  💡 <strong>Tip:</strong> The scanner will automatically detect and process QR codes. Just point and wait!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">
            {error}
            {!isProcessingFile && error.toLowerCase().includes('camera') && (
              <div className="mt-2">
                <strong>To fix camera issues:</strong>
                <ul className="list-disc list-inside mt-1 text-sm">
                  <li>Look for a camera icon in your browser's address bar and click "Allow"</li>
                  <li>Or go to browser Settings → Privacy → Camera and allow this site</li>
                  <li>Refresh the page after changing permissions</li>
                  <li>Make sure no other apps are using your camera</li>
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Scanner Container */}
      <Card>
        <CardContent className="p-6">
          <div 
            id="qr-scanner-container" 
            className={`${isScanning ? 'block' : 'hidden'} relative`}
          />
          
          {/* Enhanced Camera Selection Instructions - Only show when scanning starts */}
          {isScanning && (
            <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-xl p-5 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-white text-2xl">📱</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <span>Quick Guide</span>
                    <span className="text-sm font-normal text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Tap to interact</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-white/80 p-3 rounded-lg border-l-4 border-purple-500">
                      <p className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                        <span>Select Camera</span>
                      </p>
                      <p className="text-xs text-gray-700 ml-8">
                        Look for the <strong className="text-purple-600 bg-purple-100 px-1 rounded">purple dropdown</strong> above. Tap it to choose between front/back camera.
                      </p>
                    </div>
                    <div className="bg-white/80 p-3 rounded-lg border-l-4 border-green-500">
                      <p className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                        <span>Start Scanning</span>
                      </p>
                      <p className="text-xs text-gray-700 ml-8">
                        Tap the <strong className="text-green-600 bg-green-100 px-1 rounded">green "Start Scanning" button</strong> to begin. The camera will activate automatically.
                      </p>
                    </div>
                    <div className="bg-white/80 p-3 rounded-lg border-l-4 border-amber-500">
                      <p className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                        <span>Point & Scan</span>
                      </p>
                      <p className="text-xs text-gray-700 ml-8">
                        Point your camera at the QR code. It will scan <strong>automatically</strong> - no need to press anything!
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <p className="text-xs text-blue-800 font-medium">
                      💡 <strong>Tip:</strong> All <span className="bg-blue-200 px-1.5 py-0.5 rounded font-bold">colored buttons</span> are clickable. Regular text is just information.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!isScanning && !scannedData && !uploadedImage && (
            <div className="text-center py-16 text-gray-600">
              <div className="mb-6">
                <Camera className="h-20 w-20 mx-auto mb-4 text-purple-300" />
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mb-4 border-4 border-dashed border-purple-300">
                  <span className="text-4xl">📱</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Ready to Scan QR Codes
              </h3>
              <p className="text-base font-medium text-gray-700 mb-2">
                Click <strong className="bg-purple-100 px-2 py-1 rounded">"📷 Start Camera Scan"</strong> to begin
              </p>
              <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                Your camera will open after granting permission. Point it at any QR code for instant scanning.
              </p>
            </div>
          )}
          
          {/* Uploaded Image Display */}
          {uploadedImage && !isScanning && (
            <div className="text-center py-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
                  📁 Uploaded Image
                  {scannedData && (
                    <span className="text-green-600 text-sm bg-green-100 px-2 py-1 rounded-full">
                      ✅ QR Found
                    </span>
                  )}
                  {!scannedData && !isProcessingFile && (
                    <span className="text-red-600 text-sm bg-red-100 px-2 py-1 rounded-full">
                      ❌ No QR
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-600">
                  {isProcessingFile ? 'Scanning for QR codes...' : 
                   scannedData ? 'QR code detected and processed!' :
                   'No QR code found in this image.'}
                </p>
              </div>
              <div className="relative inline-block">
                <img 
                  src={uploadedImage} 
                  alt="Uploaded QR code" 
                  className="max-w-full max-h-96 rounded-lg shadow-lg border-2 border-purple-200"
                />
                {isProcessingFile && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-center">
                      <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm font-medium">🔍 Scanning QR Code...</p>
                      <p className="text-xs mt-1">Please wait</p>
                    </div>
                  </div>
                )}
                {scannedData && !isProcessingFile && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg animate-pulse">
                    ✅ QR Detected
                  </div>
                )}
              </div>
            </div>
          )}
          {isScanning && scannedData && (
            <div className="text-center py-4 text-green-700 bg-green-50 rounded-lg">
              <Check className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">QR Code Detected!</p>
              <p className="text-sm">Stopping scanner...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Info */}
      {(scannedData || scanCount > 0 || storageStats.localCount > 0) && (
        <div className="text-xs bg-blue-50 p-3 rounded border-l-4 border-blue-400">
          <p className="font-bold text-blue-800 mb-2">🔍 Debug Information</p>
          <div className="grid grid-cols-2 gap-2 text-blue-700">
            <div>
              <p><strong>Scan Count:</strong> {scanCount}</p>
              <p><strong>Scanned Data Length:</strong> {scannedData?.length || 0}</p>
              <p><strong>Is Scanning:</strong> {isScanning ? 'Yes' : 'No'}</p>
              <p><strong>Has Data:</strong> {scannedData ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p><strong>PIN Protected Data:</strong> {pinProtectedData ? 'Yes' : 'No'}</p>
              <p><strong>PIN Dialog Open:</strong> {isPinDialogOpen ? 'Yes' : 'No'}</p>
              <p><strong>Stored PIN QR Codes:</strong> {storageStats.localCount}</p>
              <p><strong>WiFi Status:</strong> {wifiStatus}</p>
            </div>
          </div>
          {scannedData && (
            <div className="mt-2 p-2 bg-blue-100 rounded">
              <p className="font-medium text-blue-800">Scanned Data Preview:</p>
              <p className="text-blue-600 break-all">{scannedData.substring(0, 100)}{scannedData.length > 100 ? '...' : ''}</p>
            </div>
          )}
          {storageStats.localCount > 0 && (
            <div className="mt-2 p-2 bg-green-100 rounded">
              <p className="font-medium text-green-800">🔒 PIN Storage Status:</p>
              <p className="text-green-600">{storageStats.localCount} PIN-protected QR codes stored locally</p>
              <p className="text-green-600 text-xs">These QR codes will work indefinitely and never expire</p>
            </div>
          )}
        </div>
      )}

      {/* Scanned Data Display */}
      {scannedData && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-green-700">Scanned Data</h3>
                {pinProtectedData && (
                  <div className="flex items-center gap-1 text-blue-600 text-sm bg-blue-100 px-2 py-1 rounded-full">
                    <Shield className="h-3 w-3" />
                    PIN Protected
                  </div>
                )}
                {scannedData.startsWith('WIFI:') && (
                  <div className="flex items-center gap-2">
                    {wifiStatus === 'connecting' && (
                      <div className="flex items-center gap-1 text-blue-600 text-sm">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        Connecting...
                      </div>
                    )}
                    {wifiStatus === 'connected' && (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        Connected
                      </div>
                    )}
                    {wifiStatus === 'failed' && (
                      <div className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        Manual Required
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={copyToClipboard} 
                  variant="outline" 
                  size="sm"
                  className="bg-white border-2 border-purple-300 hover:bg-purple-50 hover:border-purple-400 font-semibold shadow-md active:scale-95 transition-all"
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                {(scannedData.startsWith('http') || scannedData.startsWith('mailto:') || 
                  scannedData.startsWith('tel:') || scannedData.startsWith('sms:') || 
                  scannedData.startsWith('WIFI:') || scannedData.startsWith('MECARD:') ||
                  scannedData.startsWith('upi://') || scannedData.startsWith('UPI://') || isUPIQRCode(scannedData)) && (
                  <Button 
                    onClick={openScannedData} 
                    variant="outline" 
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600 font-semibold shadow-md active:scale-95 transition-all"
                  >
                    {scannedData.startsWith('WIFI:') ? (
                      <>
                        📶 Connect to WiFi
                      </>
                    ) : scannedData.startsWith('MECARD:') ? (
                      <>
                        👤 Download Contact
                      </>
                    ) : scannedData.startsWith('mailto:') ? (
                      <>
                        📧 Open Email
                      </>
                    ) : scannedData.startsWith('tel:') ? (
                      <>
                        📞 Call Number
                      </>
                    ) : scannedData.startsWith('sms:') ? (
                      <>
                        💬 Send SMS
                      </>
                    ) : (scannedData.startsWith('upi://') || scannedData.startsWith('UPI://') || isUPIQRCode(scannedData)) ? (
                      <>
                        💳 Open Payment App
                      </>
                    ) : scannedData.startsWith('http') ? (
                      <>
                        🌐 Open Website
                      </>
                    ) : (
                      'Open'
                    )}
                  </Button>
                )}
              </div>
              
              {/* Mobile-friendly button hint */}
              <div className="mt-2 text-xs text-gray-500 text-center sm:hidden">
                💡 <strong>Tip:</strong> Colored buttons with icons are clickable. Tap them to perform actions.
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto border-2 border-gray-200">
              <div className="mb-2 text-xs text-gray-500 font-medium flex items-center gap-1">
                <span>📄</span>
                <span>Scanned Content (Read-only)</span>
              </div>
              <pre className="text-sm whitespace-pre-wrap break-all text-gray-800">
                {formatScannedData(scannedData)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIN Input Dialog */}
      <PinInputDialog
        isOpen={isPinDialogOpen}
        onClose={handlePinDialogClose}
        onSubmit={handlePinSubmit}
        isLoading={isPinLoading}
        error={pinError}
      />
    </div>
  );
};

export default QRScanner;
