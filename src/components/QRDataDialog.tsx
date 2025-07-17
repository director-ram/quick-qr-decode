import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, QrCode, ScanQrCode, ExternalLink, Calendar, Shield } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { QRHistoryItem } from '@/pages/Index';

interface QRDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: QRHistoryItem | null;
}

const QRDataDialog: React.FC<QRDataDialogProps> = ({
  isOpen,
  onClose,
  item
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!item) return null;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(item.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied",
        description: "Data copied to clipboard!"
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getDataTypeLabel = (item: QRHistoryItem) => {
    if (item.dataType) {
      return item.dataType.charAt(0).toUpperCase() + item.dataType.slice(1);
    }
    
    // Try to detect data type from content
    if (item.data.startsWith('http')) return 'URL';
    if (item.data.startsWith('WIFI:')) return 'WiFi';
    if (item.data.startsWith('MECARD:')) return 'Contact';
    if (item.data.startsWith('mailto:')) return 'Email';
    if (item.data.startsWith('sms:')) return 'SMS';
    return 'Text';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const openData = () => {
    if (item.data.startsWith('http://') || item.data.startsWith('https://')) {
      window.open(item.data, '_blank');
    } else if (item.data.startsWith('mailto:')) {
      window.location.href = item.data;
    } else if (item.data.startsWith('tel:')) {
      window.location.href = item.data;
    } else if (item.data.startsWith('sms:')) {
      window.location.href = item.data;
    }
  };

  const canOpenData = item.data.startsWith('http') || 
                     item.data.startsWith('mailto:') || 
                     item.data.startsWith('tel:') || 
                     item.data.startsWith('sms:');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.type === 'generated' ? (
              <QrCode className="h-5 w-5 text-blue-600" />
            ) : (
              <ScanQrCode className="h-5 w-5 text-green-600" />
            )}
            QR Code Details
          </DialogTitle>
          <DialogDescription>
            Full details and content of your QR code
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge 
              variant={item.type === 'generated' ? 'default' : 'secondary'}
              className="text-sm"
            >
              {item.type === 'generated' ? 'Generated' : 'Scanned'}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {getDataTypeLabel(item)}
            </Badge>
            {item.data.startsWith('🔒') && (
              <Badge variant="outline" className="text-sm text-blue-600 border-blue-200">
                <Shield className="h-3 w-3 mr-1" />
                PIN Protected
              </Badge>
            )}
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              {formatDate(item.timestamp)}
            </div>
          </div>

          {/* Data Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Content</h4>
              <div className="flex gap-2">
                <Button onClick={copyToClipboard} variant="outline" size="sm">
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                {canOpenData && (
                  <Button onClick={openData} variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap break-all font-mono">
                {item.data}
              </pre>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-medium text-blue-900">Data Length</div>
              <div className="text-blue-700">{item.data.length} characters</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="font-medium text-green-900">Created</div>
              <div className="text-green-700">
                {new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
                  Math.round((item.timestamp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                  'day'
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRDataDialog; 