import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, Camera, CameraOff, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { QRHistoryItem } from '@/pages/Index';

interface QRScannerProps {
  onScan: (item: Omit<QRHistoryItem, 'id' | 'timestamp'>) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();

  const startScanning = async () => {
    setError('');
    setScannedData('');
    
    // Clean up any existing scanner
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (e) {
        console.log('Scanner cleanup:', e);
      }
      scannerRef.current = null;
    }

    try {
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
          // Force camera to start
          videoConstraints: {
            facingMode: { ideal: "environment" }
          }
        },
        false
      );

      scannerRef.current = scanner;
      setIsScanning(true);

      scanner.render(
        (decodedText) => {
          console.log('QR Code scanned:', decodedText);
          setScannedData(decodedText);
          
          onScan({
            type: 'scanned',
            data: decodedText
          });

          // Stop scanning after successful scan
          stopScanning();
          
          toast({
            title: "QR Code Scanned",
            description: "Successfully decoded QR code data!"
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

  const formatScannedData = (data: string) => {
    if (data.startsWith('WIFI:')) {
      const parts = data.split(';');
      const ssid = parts.find(p => p.startsWith('S:'))?.substring(2) || '';
      const password = parts.find(p => p.startsWith('P:'))?.substring(2) || '';
      const security = parts.find(p => p.startsWith('T:'))?.substring(2) || '';
      return `WiFi Network\nSSID: ${ssid}\nPassword: ${password}\nSecurity: ${security}`;
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

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (error) {
          console.log('Scanner cleanup error:', error);
        }
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Scanner Controls */}
      <div className="text-center">
        {!isScanning ? (
          <div className="space-y-2">
            <Button onClick={startScanning} size="lg" className="w-full sm:w-auto">
              <Camera className="h-5 w-5 mr-2" />
              Start Camera Scan
            </Button>
            <p className="text-sm text-gray-600">
              Make sure to allow camera access when prompted
            </p>
          </div>
        ) : (
          <Button onClick={stopScanning} variant="destructive" size="lg" className="w-full sm:w-auto">
            <CameraOff className="h-5 w-5 mr-2" />
            Stop Scanning
          </Button>
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
          {!isScanning && !scannedData && (
            <div className="text-center py-12 text-gray-500">
              <Camera className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p>Click "Start Camera Scan" to begin scanning QR codes</p>
              <p className="text-sm mt-2">Your camera will open after granting permission</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned Data Display */}
      {scannedData && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-700">Scanned Data</h3>
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
                  scannedData.startsWith('tel:') || scannedData.startsWith('sms:')) && (
                  <Button onClick={openScannedData} variant="outline" size="sm">
                    Open
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
