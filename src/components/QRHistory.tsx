
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Copy, Check, QrCode, ScanQrCode, Calendar, Filter, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import QRDataDialog from './QRDataDialog';
import type { QRHistoryItem } from '@/pages/Index';

interface QRHistoryProps {
  history: QRHistoryItem[];
  onClearHistory: () => void;
}

const QRHistory: React.FC<QRHistoryProps> = ({ history, onClearHistory }) => {
  const [filter, setFilter] = useState<'all' | 'generated' | 'scanned'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<QRHistoryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const filteredHistory = history.filter(item => 
    filter === 'all' || item.type === filter
  );

  const copyToClipboard = async (data: string, id: string) => {
    try {
      await navigator.clipboard.writeText(data);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      
      toast({
        title: "Copied",
        description: "Data copied to clipboard!"
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatData = (data: string, maxLength: number = 100) => {
    if (data.length <= maxLength) return data;
    return data.substring(0, maxLength) + '...';
  };

  const handleViewDetails = (item: QRHistoryItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Calendar className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No History Yet</h3>
        <p className="text-gray-500">
          Generate or scan QR codes to see your history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter and Clear Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={filter} onValueChange={(value: 'all' | 'generated' | 'scanned') => setFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="scanned">Scanned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear History
        </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Clear All History?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all your QR code history ({history.length} items). 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={onClearHistory}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Yes, Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* History Items */}
      <div className="space-y-3">
        {filteredHistory.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {item.type === 'generated' ? (
                      <QrCode className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ScanQrCode className="h-4 w-4 text-green-600" />
                    )}
                    <Badge 
                      variant={item.type === 'generated' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {item.type === 'generated' ? 'Generated' : 'Scanned'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getDataTypeLabel(item)}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                  
                  <div 
                    className="bg-gray-50 p-3 rounded text-sm font-mono break-all cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleViewDetails(item)}
                  >
                    {formatData(item.data)}
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <Button
                    onClick={() => handleViewDetails(item)}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    title="View full details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                <Button
                  onClick={() => copyToClipboard(item.data, item.id)}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                    title="Copy to clipboard"
                >
                  {copiedId === item.id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredHistory.length === 0 && filter !== 'all' && (
        <Alert>
          <AlertDescription>
            No {filter} items found in your history.
          </AlertDescription>
        </Alert>
      )}

      {/* QR Data Dialog */}
      <QRDataDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        item={selectedItem}
      />
    </div>
  );
};

export default QRHistory;
