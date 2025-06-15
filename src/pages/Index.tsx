
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import QRGenerator from '@/components/QRGenerator';
import QRScanner from '@/components/QRScanner';
import QRHistory from '@/components/QRHistory';
import { QrCode, ScanQrCode, History } from 'lucide-react';

export interface QRHistoryItem {
  id: string;
  type: 'generated' | 'scanned';
  data: string;
  timestamp: Date;
  dataType?: string;
}

const Index = () => {
  const [history, setHistory] = useState<QRHistoryItem[]>([]);

  const addToHistory = (item: Omit<QRHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: QRHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50 items
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">QR Code Studio</h1>
          <p className="text-xl text-gray-600">Generate, scan, and manage QR codes with ease</p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <QrCode size={18} />
                Generate
              </TabsTrigger>
              <TabsTrigger value="scan" className="flex items-center gap-2">
                <ScanQrCode size={18} />
                Scan
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History size={18} />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate">
              <Card>
                <CardHeader>
                  <CardTitle>Generate QR Code</CardTitle>
                  <CardDescription>
                    Create QR codes from text, URLs, contact info, and more
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <QRGenerator onGenerate={addToHistory} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scan">
              <Card>
                <CardHeader>
                  <CardTitle>Scan QR Code</CardTitle>
                  <CardDescription>
                    Use your camera to scan and decode QR codes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <QRScanner onScan={addToHistory} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>History</CardTitle>
                  <CardDescription>
                    View your recently generated and scanned QR codes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <QRHistory history={history} onClearHistory={() => setHistory([])} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
