import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, Camera, CameraOff, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Html5QrcodeScanner } from 'html5-qrcode';
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
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [buttonHovered, setButtonHovered] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();

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
            width: { ideal: 1280 },
            height: { ideal: 720 }
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
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
          rememberLastUsedCamera: true,
          // Better camera configuration
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          }
        },
        false // verbose logging
      );

      scannerRef.current = scanner;
      setIsScanning(true);
      console.log('🎯 Scanner initialized, starting render...');

      scanner.render(
        (decodedText) => {
          console.log('🎯 QR Code SUCCESSFULLY scanned:', decodedText);
          console.log('📊 Current scannedData state before:', scannedData);
          
          // Increment scan counter for debugging
          setScanCount(prev => prev + 1);
          
          // Set the scanned data immediately
          setScannedData(decodedText);
          console.log('✅ setScannedData called with:', decodedText);
          
          // Add to history
          onScan({
            type: 'scanned',
            data: decodedText
          });

          // Check if it's a WiFi QR code and handle automatically
          if (decodedText.startsWith('WIFI:')) {
            console.log('📶 WiFi QR code detected - attempting auto-connection...');
            setTimeout(() => {
              handleWiFiConnection(decodedText);
            }, 500); // Small delay to ensure UI updates
          }

          // Stop scanning after successful scan
          setTimeout(() => {
            console.log('🛑 Stopping scanner...');
          stopScanning();
          }, 200); // Slightly longer delay to ensure state updates
          
          // Show appropriate toast based on QR type
          const toastMessage = decodedText.startsWith('WIFI:') 
            ? 'WiFi QR code detected! Attempting to connect...'
            : `Found: ${decodedText.length > 50 ? decodedText.substring(0, 50) + '...' : decodedText}`;
          
          toast({
            title: "✅ QR Code Scanned Successfully!",
            description: toastMessage
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
    
    // Handle WiFi QR codes - trigger native WiFi connection
    if (scannedData.startsWith('WIFI:')) {
      handleWiFiConnection(scannedData);
      return;
    }
    
    // Try to detect if it's a URL and open it
    if (scannedData.startsWith('http://') || scannedData.startsWith('https://')) {
      window.open(scannedData, '_blank');
    } else if (scannedData.startsWith('mailto:')) {
      window.location.href = scannedData;
    } else if (scannedData.startsWith('tel:')) {
      window.location.href = scannedData;
    } else if (scannedData.startsWith('sms:')) {
      window.location.href = scannedData;
    }
  };

  const handleWiFiConnection = (wifiData: string) => {
    try {
      setWifiStatus('connecting');
      
      // Parse WiFi QR code data
      const parts = wifiData.split(';');
      const ssid = parts.find(p => p.startsWith('S:'))?.substring(2) || '';
      const password = parts.find(p => p.startsWith('P:'))?.substring(2) || '';
      const security = parts.find(p => p.startsWith('T:'))?.substring(2) || '';
      
      // Check if device supports WiFi connection
      if ('navigator' in window && 'wifi' in navigator) {
        // Future WiFi API (experimental)
        // @ts-ignore - WiFi API is experimental
        navigator.wifi.connect({
          ssid: ssid,
          password: password,
          security: security
        }).then(() => {
          setWifiStatus('connected');
          toast({
            title: "✅ WiFi Connected!",
            description: `Successfully connected to ${ssid}!`
          });
        }).catch((error: any) => {
          console.error('WiFi connection failed:', error);
          setWifiStatus('failed');
          fallbackWiFiConnection(ssid, password, security);
        });
      } else {
        // Use fallback methods
        fallbackWiFiConnection(ssid, password, security);
      }
    } catch (error) {
      console.error('Error parsing WiFi QR code:', error);
      setWifiStatus('failed');
      toast({
        title: "WiFi Connection Error",
        description: "Failed to parse WiFi QR code data",
        variant: "destructive"
      });
    }
  };

  const fallbackWiFiConnection = (ssid: string, password: string, security: string) => {
    // Mobile device detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isAndroid) {
      // Android: Try to open WiFi settings with intent
      const wifiIntent = `intent://wifi/#Intent;scheme=android.settings;action=android.settings.WIFI_SETTINGS;end`;
      
      // Try to trigger WiFi connection on Android
      try {
        window.location.href = wifiIntent;
        
        toast({
          title: "📱 WiFi Connection (Android)",
          description: `Opening WiFi settings. Please connect to "${ssid}" manually.`,
        });
        
        // Also try alternative Android WiFi URL scheme
        setTimeout(() => {
          const androidWifiUrl = `wifi:${ssid};${security};${password};;`;
          window.location.href = androidWifiUrl;
        }, 1000);
        
      } catch (error) {
        showWiFiInstructions(ssid, password, security, 'Android');
      }
    } else if (isIOS) {
      // iOS: Show instructions as iOS doesn't support direct WiFi connection
      toast({
        title: "📱 WiFi Connection (iOS)",
        description: `iOS detected. Please connect manually to "${ssid}".`,
      });
      showWiFiInstructions(ssid, password, security, 'iOS');
    } else {
      // Desktop: Show WiFi settings or instructions
      toast({
        title: "💻 WiFi Connection (Desktop)",
        description: `Desktop detected. Please connect manually to "${ssid}".`,
      });
      showWiFiInstructions(ssid, password, security, 'Desktop');
    }
  };

  const showWiFiInstructions = (ssid: string, password: string, security: string, platform: string) => {
    // Create a detailed instruction modal or alert
    const instructions = {
      Android: "1. Go to Settings > WiFi\n2. Select the network\n3. Enter the password shown below",
      iOS: "1. Go to Settings > WiFi\n2. Select the network\n3. Enter the password shown below",
      Desktop: "1. Click WiFi icon in system tray\n2. Select the network\n3. Enter the password shown below"
    };

    toast({
      title: `📶 Connect to ${ssid}`,
      description: `${instructions[platform as keyof typeof instructions]}\n\nPassword: ${password}`,
    });
  };

  const formatScannedData = (data: string) => {
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
    }
    return data;
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

      // Import QR scanner and scan the image
      const QrScanner = (await import('qr-scanner')).default;
      
      // Create image element
      const img = new Image();
      img.src = imageUrl;
      
      // Wait for image to load
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });

      // Scan for QR code
      console.log('🔍 Scanning image for QR codes...');
      const result = await QrScanner.scanImage(img);
      
      console.log('🎯 QR Code found in file:', result);
      setScannedData(result);
      setScanCount(prev => prev + 1);
      
      // Add to history
      onScan({
        type: 'scanned',
        data: result
      });

      // Handle WiFi QR codes automatically
      if (result.startsWith('WIFI:')) {
        console.log('📶 WiFi QR code detected - attempting auto-connection...');
        setTimeout(() => {
          handleWiFiConnection(result);
        }, 500);
      }

      toast({
        title: "✅ QR Code Found!",
        description: `Successfully decoded: ${result.length > 50 ? result.substring(0, 50) + '...' : result}`
      });

    } catch (error) {
      console.error('QR scanning error:', error);
      
      // Check if it's a "no QR code found" error vs other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('No QR code found') || errorMessage.includes('Could not decode')) {
        setError(`No QR code detected in the uploaded image. Please try a different image with a clear QR code.`);
        toast({
          title: "❌ No QR Code Found",
          description: "The image doesn't contain a readable QR code. Try a clearer image.",
          variant: "destructive"
        });
      } else {
        setError(`Failed to process the image: ${errorMessage}`);
        toast({
          title: "❌ Processing Failed",
          description: "Failed to scan the image. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsProcessingFile(false);
    }
  };

  const clearResults = () => {
    setScannedData('');
    setError('');
    setScanCount(0);
    setWifiStatus('idle');
    setCameraStatus('idle');
    
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
    
    toast({
      title: "Results Cleared",
      description: "Ready for a new scan"
    });
  };

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
                    border-0 overflow-hidden
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
                   className="group relative inline-flex items-center px-8 py-4 text-base font-bold text-purple-700 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl cursor-pointer transition-all duration-300 hover:scale-110 hover:rotate-[-1deg] hover:shadow-xl hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 overflow-hidden"
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
                className="mt-4 px-6 py-3 text-base font-semibold border-2 hover:bg-red-50 hover:border-red-300 text-red-600"
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
            
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
              <p className="text-base font-semibold text-green-800 mb-1">
                🎯 Camera Active
              </p>
              <p className="text-sm text-green-700">
                Point your camera at a QR code to scan it automatically
              </p>
            </div>
            
            {/* Debug button for testing */}
            <div>
              <Button 
                onClick={() => {
                  const testData = "https://example.com";
                  setScannedData(testData);
                  stopScanning();
                  toast({
                    title: "Test QR Code",
                    description: "Test data set for debugging"
                  });
                }} 
                variant="outline" 
                size="sm"
                className="text-sm font-medium"
              >
                🧪 Test Scan (Debug)
          </Button>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <div className="mt-2">
              <strong>To fix camera issues:</strong>
              <ul className="list-disc list-inside mt-1 text-sm">
                <li>Look for a camera icon in your browser's address bar and click "Allow"</li>
                <li>Or go to browser Settings → Privacy → Camera and allow this site</li>
                <li>Refresh the page after changing permissions</li>
                <li>Make sure no other apps are using your camera</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Scanner Container */}
      <Card>
        <CardContent className="p-6">
          <div 
            id="qr-scanner-container" 
            className={`${isScanning ? 'block' : 'hidden'}`}
          />
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
                Click <strong>"📷 Start Camera Scan"</strong> to begin
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
      {(scannedData || scanCount > 0) && (
        <div className="text-xs bg-blue-50 p-2 rounded border-l-4 border-blue-400">
          <p><strong>Debug Info:</strong></p>
          <p>Scan Count: {scanCount}</p>
          <p>Scanned Data Length: {scannedData?.length || 0}</p>
          <p>Is Scanning: {isScanning ? 'Yes' : 'No'}</p>
          <p>Has Data: {scannedData ? 'Yes' : 'No'}</p>
        </div>
      )}

      {/* Scanned Data Display */}
      {scannedData && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-green-700">Scanned Data</h3>
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
              <div className="flex gap-2">
                <Button onClick={copyToClipboard} variant="outline" size="sm">
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                {(scannedData.startsWith('http') || scannedData.startsWith('mailto:') || 
                  scannedData.startsWith('tel:') || scannedData.startsWith('sms:') || 
                  scannedData.startsWith('WIFI:')) && (
                  <Button onClick={openScannedData} variant="outline" size="sm">
                    {scannedData.startsWith('WIFI:') ? (
                      <>
                        📶 Connect to WiFi
                      </>
                    ) : (
                      'Open'
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap break-all">
                {formatScannedData(scannedData)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QRScanner;
