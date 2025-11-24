import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Download, FileText, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { QRHistoryItem } from '@/pages/Index';

interface BulkQRGeneratorProps {
  onGenerate: (item: Omit<QRHistoryItem, 'id' | 'timestamp' | 'userId'>) => void;
}

interface BulkQRItem {
  id: string;
  label: string;
  data: string;
  qrCodeUrl: string;
  error?: string;
}

const BulkQRGenerator: React.FC<BulkQRGeneratorProps> = ({ onGenerate }) => {
  const [inputText, setInputText] = useState('');
  const [generatedQRCodes, setGeneratedQRCodes] = useState<BulkQRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Parse input text (supports CSV format: label,data or just data per line)
  const parseInput = (text: string): Array<{ label: string; data: string }> => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    return lines.map((line, index) => {
      const trimmed = line.trim();
      // Check if it's CSV format (contains comma)
      if (trimmed.includes(',')) {
        const [label, ...dataParts] = trimmed.split(',').map(s => s.trim());
        return {
          label: label || `QR ${index + 1}`,
          data: dataParts.join(',') || trimmed
        };
      }
      // Otherwise, use the line as data
      return {
        label: `QR ${index + 1}`,
        data: trimmed
      };
    });
  };

  const generateBulkQRCodes = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Error",
        description: "Please enter some data to generate QR codes",
        variant: "destructive"
      });
      return;
    }

    const items = parseInput(inputText);
    
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "No valid data found. Please enter at least one line of data.",
        variant: "destructive"
      });
      return;
    }

    if (items.length > 50) {
      toast({
        title: "Too Many Items",
        description: "Please limit to 50 QR codes at a time for better performance.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedQRCodes([]);

    try {
      const QRCode = await import('qrcode');
      const generated: BulkQRItem[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          // Create a canvas for this QR code
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 300;
          
          await QRCode.toCanvas(canvas, item.data, {
            width: 300,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#1f2937',
              light: '#ffffff'
            }
          });

          const dataUrl = canvas.toDataURL();
          
          generated.push({
            id: `bulk_${Date.now()}_${i}`,
            label: item.label,
            data: item.data,
            qrCodeUrl: dataUrl
          });

          // Store canvas reference
          canvasRefs.current.set(`bulk_${Date.now()}_${i}`, canvas);

          // Add to history
          onGenerate({
            type: 'generated',
            data: item.data,
            dataType: 'text'
          });
        } catch (error) {
          console.error(`Error generating QR for item ${i + 1}:`, error);
          generated.push({
            id: `bulk_${Date.now()}_${i}`,
            label: item.label,
            data: item.data,
            qrCodeUrl: '',
            error: error instanceof Error ? error.message : 'Failed to generate QR code'
          });
        }
      }

      setGeneratedQRCodes(generated);
      setShowPreview(true);
      
      toast({
        title: "Success",
        description: `Generated ${generated.filter(g => !g.error).length} QR codes successfully!`
      });
    } catch (error) {
      console.error('Error in bulk generation:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR codes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAllQRCodes = async () => {
    const validQRCodes = generatedQRCodes.filter(qr => qr.qrCodeUrl && !qr.error);
    
    if (validQRCodes.length === 0) {
      toast({
        title: "No QR Codes",
        description: "No valid QR codes to download",
        variant: "destructive"
      });
      return;
    }

    // Create a zip-like download (download all as individual files)
    for (const qr of validQRCodes) {
      const link = document.createElement('a');
      link.download = `${qr.label.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`;
      link.href = qr.qrCodeUrl;
      link.click();
      
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    toast({
      title: "Download Started",
      description: `Downloading ${validQRCodes.length} QR codes...`
    });
  };

  const downloadSingleQR = (qr: BulkQRItem) => {
    if (!qr.qrCodeUrl || qr.error) return;
    
    const link = document.createElement('a');
    link.download = `${qr.label.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`;
    link.href = qr.qrCodeUrl;
    link.click();
    
    toast({
      title: "Downloaded",
      description: `Downloaded ${qr.label}`
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Bulk QR Code Generator
          </CardTitle>
          <CardDescription>
            Generate multiple QR codes at once. Enter one item per line, or use CSV format: Label,Data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bulk-input">Enter Data (one per line or CSV format)</Label>
            <Textarea
              id="bulk-input"
              placeholder="Example:&#10;https://example.com&#10;Business Card,John Doe,123-456-7890&#10;WiFi Network,MyNetwork,Password123&#10;Custom Text,Hello World"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Use CSV format (Label,Data) for better organization, or just enter data (one per line)
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generateBulkQRCodes}
              disabled={isGenerating || !inputText.trim()}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate QR Codes
                </>
              )}
            </Button>
            {generatedQRCodes.length > 0 && (
              <Button
                onClick={downloadAllQRCodes}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download All ({generatedQRCodes.filter(qr => !qr.error).length})
              </Button>
            )}
          </div>

          {generatedQRCodes.length > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">
                  Generated {generatedQRCodes.filter(qr => !qr.error).length} of {generatedQRCodes.length} QR codes
                </span>
              </div>
              {generatedQRCodes.some(qr => qr.error) && (
                <p className="text-sm text-green-700 mt-1">
                  {generatedQRCodes.filter(qr => qr.error).length} QR code(s) failed to generate
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated QR Codes Preview</DialogTitle>
            <DialogDescription>
              Review and download your generated QR codes
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {generatedQRCodes.map((qr) => (
              <Card key={qr.id} className="relative">
                <CardContent className="p-4">
                  {qr.error ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                      <p className="text-xs text-red-600 font-medium">{qr.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{qr.error}</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2">
                        <img
                          src={qr.qrCodeUrl}
                          alt={qr.label}
                          className="w-full h-auto border border-gray-200 rounded"
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-700 mb-1 truncate" title={qr.label}>
                        {qr.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate mb-2" title={qr.data}>
                        {qr.data}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => downloadSingleQR(qr)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            {generatedQRCodes.filter(qr => !qr.error).length > 0 && (
              <Button onClick={downloadAllQRCodes}>
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkQRGenerator;

