import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Download, Copy, Check, Upload, Palette, Image as ImageIcon, Shield, Lock, Minimize2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { encryptData, isValidPin } from '@/utils/encryption';
import { storePinProtectedQRCode } from '@/utils/qrCodeService';
import { useAuth } from '@/contexts/AuthContext';
import type { QRHistoryItem } from '@/pages/Index';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QR_TEMPLATES, getTemplatesByCategory, type QRTemplate } from '@/utils/qrTemplates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Remove Firestore imports
// import { collection, query, where, getDocs } from "firebase/firestore";
// import { db } from "@/firebase";

interface QRGeneratorProps {
  onGenerate: (item: Omit<QRHistoryItem, 'id' | 'timestamp' | 'userId'>) => void;
  history: QRHistoryItem[];
}

type QRDataType = 'text' | 'url' | 'wifi' | 'contact' | 'email' | 'sms';

const QRGenerator: React.FC<QRGeneratorProps> = ({ onGenerate, history }) => {
  const [dataType, setDataType] = useState<QRDataType>('text');
  const [qrData, setQrData] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // QR Customization options
  const [qrColor, setQrColor] = useState('#1f2937');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [qrSize, setQrSize] = useState(300);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Form fields for different data types
  const [textData, setTextData] = useState('');
  const [urlData, setUrlData] = useState('');
  const [wifiData, setWifiData] = useState({
    ssid: '',
    password: '',
    security: 'WPA'
  });
  const [contactData, setContactData] = useState({
    name: '',
    phone: '',
    email: '',
    organization: ''
  });
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [smsData, setSmsData] = useState({
    number: '',
    message: ''
  });

  // PIN Protection state
  const [isPinProtected, setIsPinProtected] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Save to History Popup state
  const [showSaveToHistoryPopup, setShowSaveToHistoryPopup] = useState(false);
  const [pendingPinQrId, setPendingPinQrId] = useState<string | null>(null);
  const [pendingPinQrData, setPendingPinQrData] = useState<string | null>(null);

  // Template state
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'business' | 'personal' | 'social' | 'utility'>('all');

  // PIP Mode and Animation state
  const [isPipMode, setIsPipMode] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [qrDisplayRef, setQrDisplayRef] = useState<HTMLDivElement | null>(null);
  const [pinSectionRef, setPinSectionRef] = useState<HTMLDivElement | null>(null);
  const [isQrVisible, setIsQrVisible] = useState(true);
  const [pipScale, setPipScale] = useState(1);
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll detection and PIP mode logic
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    setScrollPosition(scrollY);

    if (qrDisplayRef && pinSectionRef && qrCodeUrl) {
      const qrRect = qrDisplayRef.getBoundingClientRect();
      const pinRect = pinSectionRef.getBoundingClientRect();
      
      // Check if QR display is out of view and PIN section is visible
      const qrOutOfView = qrRect.bottom < 0 || qrRect.top > window.innerHeight;
      const pinInView = pinRect.top < window.innerHeight && pinRect.bottom > 0;
      
      // Enable PIP mode when QR is out of view and PIN section is visible
      if (qrOutOfView && pinInView && isPinProtected && qrCodeUrl) {
        setIsPipMode(true);
        setIsQrVisible(false);
        
        // Calculate scale based on scroll distance with smooth transitions
        const scrollDistance = Math.abs(qrRect.top);
        const maxScrollDistance = 400;
        const baseScale = 0.4;
        const scale = Math.max(baseScale, 1 - (scrollDistance / maxScrollDistance) * (1 - baseScale));
        setPipScale(scale);
        
        // Dynamic positioning based on scroll
        const dynamicY = Math.max(20, window.innerHeight - 200 - (scrollDistance * 0.1));
        setPipPosition({
          x: window.innerWidth - 200,
          y: dynamicY
        });
      } else if (qrCodeUrl && !qrOutOfView) {
        // Smooth transition back to normal when QR comes back into view
        setIsPipMode(false);
        setIsQrVisible(true);
        setPipScale(1);
      } else if (!isPinProtected || !qrCodeUrl) {
        // Disable PIP mode when PIN protection is off or no QR code
        setIsPipMode(false);
        setIsQrVisible(true);
        setPipScale(1);
      }
    }
  }, [qrDisplayRef, pinSectionRef, qrCodeUrl, isPinProtected]);

  // Intersection Observer for better performance
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === qrDisplayRef) {
            setIsQrVisible(entry.isIntersecting);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (qrDisplayRef) {
      observer.observe(qrDisplayRef);
    }

    return () => observer.disconnect();
  }, [qrDisplayRef]);

  // Add scroll listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const generateBaseData = (): string => {
    let baseData = '';
    
    switch (dataType) {
      case 'text':
        baseData = textData;
        break;
      case 'url':
        baseData = urlData.startsWith('http') ? urlData : `https://${urlData}`;
        break;
      case 'wifi':
        baseData = `WIFI:T:${wifiData.security};S:${wifiData.ssid};P:${wifiData.password};;`;
        break;
      case 'contact':
        baseData = `MECARD:N:${contactData.name};TEL:${contactData.phone};EMAIL:${contactData.email};ORG:${contactData.organization};;`;
        break;
      case 'email':
        baseData = `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
        break;
      case 'sms':
        baseData = `sms:${smsData.number}?body=${encodeURIComponent(smsData.message)}`;
        break;
      default:
        baseData = '';
    }

    return baseData;
  };

  const generateQRDataForPreview = (): string => {
    const baseData = generateBaseData();
    
    // For live preview, show a simple placeholder for PIN-protected QR codes
    if (isPinProtected && pinCode.trim()) {
      // Return a simple, valid QR code data that can be scanned
      return `🔒 PIN PROTECTED PREVIEW - Original: ${baseData.substring(0, 30)}${baseData.length > 30 ? '...' : ''}`;
    }
    
    return baseData;
  };

  const generateQRDataForSaving = async (): Promise<string> => {
    const baseData = generateBaseData();
    
    // If PIN protection is enabled, store in Firebase and return QR ID
    if (isPinProtected && pinCode.trim()) {
      try {
        // Validate PIN format
        if (!isValidPin(pinCode)) {
          throw new Error('PIN must be 4-6 digits');
        }
        
        // Store the PIN-protected data in Firebase
        const qrId = await storePinProtectedQRCode(
          baseData, 
          pinCode, 
          currentUser?.uid
        );
        
        // Return only the QR ID - external scanners will only see this
        return `PIN_PROTECTED:${qrId}`;
      } catch (error) {
        console.error('Firebase storage error:', error);
        throw new Error('Failed to store PIN-protected QR code');
      }
    }
    
    return baseData;
  };

  // Helper to check if a PIN-protected QR ID is already in history
  const isPinQrInHistory = (qrId: string) => {
    // For PIN-protected QRs, the history stores the original data (generateBaseData())
    // not the PIN_PROTECTED:qrId string. So we check if there's a history item
    // with the same original data that was just saved.
    const currentBaseData = generateBaseData();
    
    // Check if there's a recent history item with matching base data
    // We look for items saved in the last few seconds to match the current QR
    const now = Date.now();
    const recentThreshold = 10000; // 10 seconds
    
    return history.some(item => {
      if (item.type !== 'generated' || !item.data || typeof item.data !== 'string') {
        return false;
      }
      
      // Check if the data matches the current base data
      const dataMatches = item.data === currentBaseData;
      
      // Check if it's a recent save (within last 10 seconds)
      const itemTime = item.timestamp instanceof Date ? item.timestamp.getTime() : new Date(item.timestamp).getTime();
      const isRecent = (now - itemTime) < recentThreshold;
      
      // Also check if PIN protection is currently enabled (indicates this is a PIN QR)
      const isPinQR = isPinProtected && pinCode.trim().length > 0;
      
      return dataMatches && isRecent && isPinQR;
    });
  };

  // Patch generateQRCodeInternal to trigger popup for PIN-protected QRs
  const generateQRCodeInternal = async (data?: string, showToast: boolean = true, isForSaving: boolean = false) => {
    try {
      let qrText = data;
      if (!qrText) {
        if (isForSaving) {
          qrText = await generateQRDataForSaving();
        } else {
          qrText = generateQRDataForPreview();
        }
      }
      if (!qrText.trim()) {
        setQrCodeUrl('');
        setQrData('');
      return;
    }
      // Dynamic import to avoid build issues
      const QRCode = await import('qrcode');
      const canvas = canvasRef.current;
      if (canvas) {
        // Clear canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        await QRCode.toCanvas(canvas, qrText, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: errorCorrectionLevel,
          color: {
            dark: qrColor,
            light: bgColor
          }
        });
        
        // Add logo if present
        if (logoFile && logoPreview) {
          await addLogoToQR(canvas, logoPreview);
        }
        
        const dataUrl = canvas.toDataURL();
        setQrCodeUrl(dataUrl);
        setQrData(qrText);
        
        // Also draw on PIP canvas for live preview
        if (pipCanvasRef.current) {
          const pipCanvas = pipCanvasRef.current;
          const pipCtx = pipCanvas.getContext('2d');
          if (pipCtx) {
            pipCanvas.width = 120;
            pipCanvas.height = 120;
            pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
            
            // Draw the main canvas content to PIP canvas
            pipCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 120, 120);
          }
        }
        
        // Only add to history when manually generated (not real-time)
        if (showToast) {
          let historyData = qrText;
          if (isPinProtected && pinCode.trim() && qrText.startsWith('PIN_PROTECTED:')) {
            historyData = generateBaseData();
          }
          
          console.log('📝 Adding to history:', { historyData, qrText, isPinProtected });
          
        onGenerate({
          type: 'generated',
            data: historyData,
          dataType
        });
        // --- PIN-protected QR popup logic ---
        // Remove this block so the popup is not shown after saving to history
        // if (isPinProtected && pinCode.trim() && qrText.startsWith('PIN_PROTECTED:')) {
        //   const qrId = qrText.split(':')[1];
        //   if (qrId && !isPinQrInHistory(qrId)) {
        //     setPendingPinQrId(qrId);
        //     setPendingPinQrData(historyData);
        //     setShowSaveToHistoryPopup(true);
        //   }
        // }
        // --- end popup logic ---
          const description = isPinProtected && pinCode.trim() 
            ? "PIN-protected QR code generated and stored in Firebase!"
            : "QR code generated successfully!";

        toast({
          title: "Success",
            description
        });
        }
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      if (showToast) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR code';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  };

  const addLogoToQR = (canvas: HTMLCanvasElement, logoSrc: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const logo = new Image();
      logo.onload = () => {
        try {
          // Calculate logo size (10% of QR code size)
          const logoSize = Math.min(canvas.width, canvas.height) * 0.15;
          const x = (canvas.width - logoSize) / 2;
          const y = (canvas.height - logoSize) / 2;

          // Create white background circle for logo
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, logoSize / 2 + 5, 0, 2 * Math.PI);
          ctx.fill();

          // Draw logo
          ctx.drawImage(logo, x, y, logoSize, logoSize);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      logo.onerror = () => reject(new Error('Failed to load logo'));
      logo.src = logoSrc;
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setLogoPreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      toast({
        title: "Logo Uploaded",
        description: "Logo will appear in the center of your QR code"
      });
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
    toast({
      title: "Logo Removed",
      description: "QR code will generate without logo"
    });
  };

  const togglePinVisibility = () => {
    setShowPin(!showPin);
  };

  // Apply template to form
  const applyTemplate = (template: QRTemplate) => {
    setDataType(template.dataType);
    
    // Apply preset data
    if (template.preset.text) {
      setTextData(template.preset.text);
    }
    if (template.preset.url) {
      setUrlData(template.preset.url);
    }
    if (template.preset.wifi) {
      setWifiData(template.preset.wifi);
    }
    if (template.preset.contact) {
      setContactData(template.preset.contact);
    }
    if (template.preset.email) {
      setEmailData(template.preset.email);
    }
    if (template.preset.sms) {
      setSmsData(template.preset.sms);
    }
    
    // Apply styling if available
    if (template.styling) {
      if (template.styling.qrColor) setQrColor(template.styling.qrColor);
      if (template.styling.bgColor) setBgColor(template.styling.bgColor);
      if (template.styling.errorCorrectionLevel) setErrorCorrectionLevel(template.styling.errorCorrectionLevel);
      if (template.styling.size) setQrSize(template.styling.size);
    }
    
    setShowTemplates(false);
    toast({
      title: "Template Applied",
      description: `${template.name} template has been applied. Customize as needed!`
    });
  };

  const filteredTemplates = selectedCategory === 'all' 
    ? QR_TEMPLATES 
    : getTemplatesByCategory(selectedCategory);

  // PIP QR Component with enhanced animations
  const PipQRPreview = () => {
    if (!isPipMode || !qrCodeUrl) return null;

    return (
      <div
        className="fixed z-50 transition-all duration-700 ease-out"
        style={{
          right: '20px',
          bottom: '20px',
          transform: `scale(${pipScale}) rotate(${isPipMode ? '0deg' : '180deg'})`,
          opacity: isPipMode ? 1 : 0,
          filter: isPipMode ? 'blur(0px)' : 'blur(10px)',
        }}
      >
        <Card className="bg-white shadow-2xl border-2 border-purple-200 rounded-xl overflow-hidden hover:shadow-3xl transition-all duration-300 hover:scale-105">
          {/* Animated gradient border */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 rounded-xl opacity-75 animate-pulse"></div>
          <div className="relative bg-white m-0.5 rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-pulse shadow-sm"></div>
                  <span className="text-xs font-medium text-gray-700 animate-pulse">Live Preview</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    qrDisplayRef?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="h-6 w-6 p-0 hover:bg-purple-100 hover:scale-110 transition-all duration-200"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="relative group">
                {/* Animated QR container */}
                                  <div className="relative overflow-hidden rounded-lg">
                    <canvas
                      ref={pipCanvasRef}
                      className="border border-gray-200 rounded-lg shadow-sm transition-all duration-300 group-hover:shadow-md"
                      style={{ 
                        width: '120px', 
                        height: '120px',
                        display: 'block'
                      }}
                    />
                  
                  {/* Animated scan lines */}
                  <div className="absolute inset-0 h-2 animate-pulse opacity-50">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-blue-400/30 to-transparent animate-bounce"></div>
                  </div>
                </div>
                
                {isPinProtected && (
                  <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs px-1 py-0.5 rounded-full font-medium shadow-lg animate-bounce">
                    <Shield className="h-3 w-3" />
                  </div>
                )}
                
                {/* Floating particles */}
                <div className="absolute -top-2 -left-2 w-1 h-1 bg-purple-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute -bottom-2 -right-2 w-1 h-1 bg-pink-400 rounded-full animate-ping opacity-75" style={{animationDelay: '0.5s'}}></div>
              </div>
              
              <div className="mt-2 text-center">
                <p className="text-xs text-gray-600 font-medium">
                  {isPinProtected ? (
                    <span className="flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      PIN Protected
                    </span>
                  ) : (
                    'Ready to scan'
                  )}
                </p>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    );
  };

  const handleGenerateClick = async () => {
    try {
      const data = await generateQRDataForSaving();
      console.log('🔧 Generated data for saving:', data);
      
    if (!data.trim()) {
      toast({
        title: "Error",
        description: "Please enter data to generate QR code",
        variant: "destructive"
      });
      return;
    }
      
      // Generate the actual QR code with the Firebase ID
      await generateQRCodeInternal(data, true, true);
      
      console.log('✅ QR code generated successfully for saving');
    } catch (error) {
      console.error('❌ Error in handleGenerateClick:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate QR code",
        variant: "destructive"
      });
    }
  };

  const [showDownloadPinPopup, setShowDownloadPinPopup] = useState(false);

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    // If PIN protected and not saved to history, show popup
    if (isPinProtected && pinCode && qrData.startsWith('PIN_PROTECTED:')) {
      const qrId = qrData.split(':')[1];
      if (qrId) {
        // Check if this PIN-protected QR is in history
        // History stores the original data (generateBaseData()), not the PIN_PROTECTED:qrId
        const currentBaseData = generateBaseData();
        const isInHistory = history.some(item => 
          item.type === 'generated' &&
          item.data &&
          typeof item.data === 'string' &&
          item.data === currentBaseData &&
          // Check if it was saved recently (within last 30 seconds) to avoid false positives
          item.timestamp &&
          (Date.now() - (item.timestamp instanceof Date ? item.timestamp.getTime() : new Date(item.timestamp).getTime())) < 30000
        );
        
        if (!isInHistory) {
          setShowDownloadPinPopup(true);
          return;
        }
      }
    }
    
    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrCodeUrl;
    link.click();

    toast({
      title: "Downloaded",
      description: "QR code image downloaded successfully!"
    });
  };

  const copyToClipboard = async () => {
    if (!qrData) return;
    
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied",
        description: "QR code data copied to clipboard!"
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Real-time QR code generation as user types
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const data = generateQRDataForPreview();
      if (data.trim()) {
        generateQRCodeInternal(data, false, false);
      } else {
        setQrCodeUrl('');
        setQrData('');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [textData, urlData, wifiData, contactData, emailData, smsData, dataType, qrColor, bgColor, errorCorrectionLevel, qrSize, logoPreview, isPinProtected, pinCode]);

  const renderDataTypeForm = () => {
    switch (dataType) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="text">Text Content</Label>
              <Textarea
                id="text"
                placeholder="Enter your text here..."
                value={textData}
                onChange={(e) => setTextData(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        );

      case 'url':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="example.com or https://example.com"
                value={urlData}
                onChange={(e) => setUrlData(e.target.value)}
              />
            </div>
          </div>
        );

      case 'wifi':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ssid">WiFi Network Name (SSID)</Label>
              <Input
                id="ssid"
                placeholder="Network name"
                value={wifiData.ssid}
                onChange={(e) => setWifiData({...wifiData, ssid: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="wifi-password">Password</Label>
              <Input
                id="wifi-password"
                type="password"
                placeholder="WiFi password"
                value={wifiData.password}
                onChange={(e) => setWifiData({...wifiData, password: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="security">Security Type</Label>
              <Select value={wifiData.security} onValueChange={(value) => setWifiData({...wifiData, security: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WPA">WPA/WPA2</SelectItem>
                  <SelectItem value="WEP">WEP</SelectItem>
                  <SelectItem value="nopass">Open (No Password)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={contactData.name}
                onChange={(e) => setContactData({...contactData, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={contactData.phone}
                onChange={(e) => setContactData({...contactData, phone: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="john@example.com"
                value={contactData.email}
                onChange={(e) => setContactData({...contactData, email: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                placeholder="Company Name"
                value={contactData.organization}
                onChange={(e) => setContactData({...contactData, organization: e.target.value})}
              />
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="recipient@example.com"
                value={emailData.to}
                onChange={(e) => setEmailData({...emailData, to: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Email subject"
                value={emailData.subject}
                onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                placeholder="Email body..."
                value={emailData.body}
                onChange={(e) => setEmailData({...emailData, body: e.target.value})}
                rows={3}
              />
            </div>
          </div>
        );

      case 'sms':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-number">Phone Number</Label>
              <Input
                id="sms-number"
                placeholder="+1234567890"
                value={smsData.number}
                onChange={(e) => setSmsData({...smsData, number: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="sms-message">Message</Label>
              <Textarea
                id="sms-message"
                placeholder="SMS message..."
                value={smsData.message}
                onChange={(e) => setSmsData({...smsData, message: e.target.value})}
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" ref={containerRef}>
        <PipQRPreview />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input Form */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Label htmlFor="data-type" className="flex-1">Data Type</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Templates
            </Button>
          </div>
          <Select value={dataType} onValueChange={(value: QRDataType) => setDataType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Plain Text</SelectItem>
              <SelectItem value="url">Website URL</SelectItem>
              <SelectItem value="wifi">WiFi Network</SelectItem>
              <SelectItem value="contact">Contact Card</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>

          {renderDataTypeForm()}

          <Separator className="my-6" />

          {/* QR Customization Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold gradient-text">QR Customization</h3>
            </div>

            {/* Color Customization */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qr-color">QR Code Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="qr-color"
                    type="color"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    className="w-12 h-10 p-1 border rounded"
                  />
                  <Input
                    type="text"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    placeholder="#1f2937"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="bg-color">Background Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bg-color"
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-12 h-10 p-1 border rounded"
                  />
                  <Input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Size and Error Correction */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qr-size">QR Code Size</Label>
                <Select value={qrSize.toString()} onValueChange={(value) => setQrSize(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="200">Small (200px)</SelectItem>
                    <SelectItem value="300">Medium (300px)</SelectItem>
                    <SelectItem value="400">Large (400px)</SelectItem>
                    <SelectItem value="500">Extra Large (500px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="error-correction">Error Correction</Label>
                <Select value={errorCorrectionLevel} onValueChange={(value: 'L' | 'M' | 'Q' | 'H') => setErrorCorrectionLevel(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Low (~7%)</SelectItem>
                    <SelectItem value="M">Medium (~15%)</SelectItem>
                    <SelectItem value="Q">Quartile (~25%)</SelectItem>
                    <SelectItem value="H">High (~30%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4" />
                Center Logo
              </Label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {logoFile ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearLogo}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                
                {logoPreview && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-12 h-12 object-cover rounded border"
                    />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-gray-900">{logoFile?.name}</p>
                      <p className="text-gray-500">
                        {logoFile && (logoFile.size / 1024).toFixed(1)}KB • Will appear at center of QR code
                      </p>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500">
                  💡 Tip: Use high contrast logos for better scanning. Supports PNG, JPG, WebP (max 5MB)
                </p>
              </div>
            </div>
          </div>

          {/* Main Save to History button (in the main UI, not the popup) */}
          <Button onClick={handleGenerateClick} className="w-full" size="lg">
            Save to History
          </Button>
        </div>

        {/* Right Column: QR Code Display + PIN Protection */}
        <div className="space-y-4">
          {/* QR Code Display - Always visible on right side */}
          <div 
            className="flex flex-col items-center space-y-4"
            ref={(el) => setQrDisplayRef(el)}
          >
          <Card className={`p-6 relative transition-all duration-500 ${isPipMode ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
            {isPinProtected && pinCode && (
              <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg animate-pulse">
                🔒 PIN Protected
              </div>
            )}
            {isPipMode && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-100/50 to-pink-100/50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Minimize2 className="h-8 w-8 mx-auto mb-2 text-purple-600 animate-pulse" />
                  <p className="text-sm font-medium text-purple-800">Preview in PIP Mode</p>
                  <p className="text-xs text-purple-600">Scroll up to return</p>
                </div>
              </div>
            )}
            <CardContent className="flex flex-col items-center space-y-4 p-0">
              <div style={{ width: qrSize, height: qrSize }} className="flex items-center justify-center relative">
              <canvas
                ref={canvasRef}
                  className="border border-gray-200 rounded-lg shadow-lg"
                style={{ display: qrCodeUrl ? 'block' : 'none' }}
              />
              {isPinProtected && pinCode && qrCodeUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
                  <div className="bg-white bg-opacity-90 px-3 py-1 rounded-full text-xs font-medium text-gray-800 shadow-lg">
                    🔒 Preview Mode
                  </div>
                </div>
              )}
              {!qrCodeUrl && (
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 space-y-2"
                    style={{ width: qrSize, height: qrSize }}
                  >
                    <div className="text-6xl">🎨</div>
                    <div className="text-center px-4">
                      <p className="font-medium">Custom QR Preview</p>
                      <p className="text-sm">Start typing to see your styled QR code</p>
                    </div>
                </div>
              )}
              </div>
            </CardContent>
          </Card>

          {qrCodeUrl && (
            <div className="space-y-3">
              {isPinProtected && pinCode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">PIN Protection Active</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    This is a preview. Click "Save to History" to generate the actual PIN-protected QR code.
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    The saved QR code will only contain a secure ID that external scanners cannot decrypt.
                  </p>
                </div>
              )}
            <div className="flex gap-2">
              <Button onClick={downloadQRCode} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy Data'}
              </Button>
              </div>
            </div>
          )}
          </div>

          {/* PIN Protection Section - Below QR Code on right side */}
          {qrCodeUrl && (
            <div 
              className="space-y-4" 
              ref={(el) => setPinSectionRef(el)}
            >
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold gradient-text">PIN Protection</h3>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-blue-600" />
                    <div>
                      <Label className="text-sm font-medium text-blue-900">
                        Enable PIN Protection
                      </Label>
                      <p className="text-xs text-blue-700">
                        Require a PIN to view QR code content when scanned
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isPinProtected}
                    onCheckedChange={setIsPinProtected}
                  />
                </div>
                
                {isPinProtected && (
                  <div className="space-y-2">
                    <Label htmlFor="pin-code" className="text-sm font-medium text-blue-900">
                      Enter PIN Code
                    </Label>
                    <div className="relative">
                    <Input
                      id="pin-code"
                        type={showPin ? "text" : "password"}
                      placeholder="Enter 4-8 digit PIN"
                      value={pinCode}
                      onChange={(e) => {
                        setPinCode(e.target.value);
                        // Trigger PIP mode update when PIN changes
                        setTimeout(() => handleScroll(), 100);
                      }}
                      maxLength={8}
                        className="bg-white border-blue-300 focus:border-blue-500 transition-all duration-300 focus:ring-2 focus:ring-blue-200 pr-10"
                    />
                      <button
                        type="button"
                        onClick={togglePinVisibility}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-700"
                        tabIndex={-1}
                      >
                        {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-blue-600">
                      💡 Users will need to enter this PIN to view the QR code content
                    </p>
                  </div>
                )}
                
                {isPinProtected && pinCode && (
                  <div className="bg-green-100 border border-green-300 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        PIN Protection Active
                      </span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      This QR code is now protected with PIN: {pinCode.replace(/./g, '•')}
                    </p>
                  </div>
                )}

                {/* Live Preview Badge - Under PIN Protection */}
                {qrCodeUrl && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg animate-pulse flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>Live Preview</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog open={showSaveToHistoryPopup} onOpenChange={setShowSaveToHistoryPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to history for QR decryption later</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700">
            Saving this QR to your history allows you to decrypt it later with your PIN.
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (pendingPinQrData) {
                  onGenerate({ type: 'generated', data: pendingPinQrData, dataType });
                }
                setShowSaveToHistoryPopup(false);
              }}
            >
              Save to History
            </Button>
            <Button variant="outline" onClick={() => setShowSaveToHistoryPopup(false)}>
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDownloadPinPopup} onOpenChange={setShowDownloadPinPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN-Protected QR Not Saved</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-base text-center text-gray-800">
            <p>This QR code is PIN-protected but has not been saved to your history.</p>
            <p className="mt-2">If you download it now, you may not be able to decrypt it later.</p>
            <p className="mt-2 font-semibold">Please save to history for secure decryption later.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDownloadPinPopup(false)} className="w-full">Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              QR Code Templates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Category Filter */}
            <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="social">Social</TabsTrigger>
                <TabsTrigger value="utility">Utility</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 hover:border-purple-500"
                  onClick={() => applyTemplate(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{template.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                            {template.dataType}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {template.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplates(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRGenerator;
