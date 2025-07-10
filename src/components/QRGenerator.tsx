import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Check, Upload, Palette, Image as ImageIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { QRHistoryItem } from '@/pages/Index';

interface QRGeneratorProps {
  onGenerate: (item: Omit<QRHistoryItem, 'id' | 'timestamp' | 'userId'>) => void;
}

type QRDataType = 'text' | 'url' | 'wifi' | 'contact' | 'email' | 'sms';

const QRGenerator: React.FC<QRGeneratorProps> = ({ onGenerate }) => {
  const [dataType, setDataType] = useState<QRDataType>('text');
  const [qrData, setQrData] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const generateQRData = (): string => {
    switch (dataType) {
      case 'text':
        return textData;
      case 'url':
        return urlData.startsWith('http') ? urlData : `https://${urlData}`;
      case 'wifi':
        return `WIFI:T:${wifiData.security};S:${wifiData.ssid};P:${wifiData.password};;`;
      case 'contact':
        return `MECARD:N:${contactData.name};TEL:${contactData.phone};EMAIL:${contactData.email};ORG:${contactData.organization};;`;
      case 'email':
        return `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
      case 'sms':
        return `sms:${smsData.number}?body=${encodeURIComponent(smsData.message)}`;
      default:
        return '';
    }
  };

  const generateQRCodeInternal = async (data?: string, showToast: boolean = true) => {
    const qrText = data || generateQRData();
    if (!qrText.trim()) {
      // Clear QR code if no data
      setQrCodeUrl('');
      setQrData('');
      return;
    }

    try {
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
        
        // Only add to history when manually generated (not real-time)
        if (showToast) {
        onGenerate({
          type: 'generated',
            data: qrText,
          dataType
        });

        toast({
          title: "Success",
          description: "QR code generated successfully!"
        });
        }
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      if (showToast) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
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

  const handleGenerateClick = () => {
    const data = generateQRData();
    if (!data.trim()) {
      toast({
        title: "Error",
        description: "Please enter data to generate QR code",
        variant: "destructive"
      });
      return;
    }
    generateQRCodeInternal(data, true);
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
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
      const data = generateQRData();
      if (data.trim()) {
        generateQRCodeInternal(data, false);
      } else {
        setQrCodeUrl('');
        setQrData('');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [textData, urlData, wifiData, contactData, emailData, smsData, dataType, qrColor, bgColor, errorCorrectionLevel, qrSize, logoPreview]);

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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="data-type">Data Type</Label>
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
          </div>

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

          <Button onClick={handleGenerateClick} className="w-full" size="lg">
            Save to History
          </Button>
        </div>

        {/* QR Code Display */}
        <div className="flex flex-col items-center space-y-4">
          <Card className="p-6 relative">
            {qrCodeUrl && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg animate-pulse">
                ⚡ Live Preview
              </div>
            )}
            <CardContent className="flex flex-col items-center space-y-4 p-0">
              <div style={{ width: qrSize, height: qrSize }} className="flex items-center justify-center">
              <canvas
                ref={canvasRef}
                  className="border border-gray-200 rounded-lg shadow-lg"
                style={{ display: qrCodeUrl ? 'block' : 'none' }}
              />
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
          )}
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;
