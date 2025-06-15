import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Copy, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as QRCode from 'qrcode';
import type { QRHistoryItem } from '@/pages/Index';

interface QRGeneratorProps {
  onGenerate: (item: Omit<QRHistoryItem, 'id' | 'timestamp'>) => void;
}

type QRDataType = 'text' | 'url' | 'wifi' | 'contact' | 'email' | 'sms';

const QRGenerator: React.FC<QRGeneratorProps> = ({ onGenerate }) => {
  const [dataType, setDataType] = useState<QRDataType>('text');
  const [qrData, setQrData] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

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

  const generateQRCode = async () => {
    const data = generateQRData();
    if (!data.trim()) {
      toast({
        title: "Error",
        description: "Please enter data to generate QR code",
        variant: "destructive"
      });
      return;
    }

    try {
      const canvas = canvasRef.current;
      if (canvas) {
        await QRCode.toCanvas(canvas, data, {
          width: 300,
          margin: 2,
          color: {
            dark: '#1f2937',
            light: '#ffffff'
          }
        });
        
        const dataUrl = canvas.toDataURL();
        setQrCodeUrl(dataUrl);
        setQrData(data);
        
        onGenerate({
          type: 'generated',
          data,
          dataType
        });

        toast({
          title: "Success",
          description: "QR code generated successfully!"
        });
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive"
      });
    }
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

          <Button onClick={generateQRCode} className="w-full" size="lg">
            Generate QR Code
          </Button>
        </div>

        {/* QR Code Display */}
        <div className="flex flex-col items-center space-y-4">
          <Card className="p-6">
            <CardContent className="flex flex-col items-center space-y-4 p-0">
              <canvas
                ref={canvasRef}
                className="border border-gray-200 rounded-lg"
                style={{ display: qrCodeUrl ? 'block' : 'none' }}
              />
              {!qrCodeUrl && (
                <div className="w-[300px] h-[300px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500">
                  QR code will appear here
                </div>
              )}
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
