
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import QRGenerator from '@/components/QRGenerator';
import QRScanner from '@/components/QRScanner';
import QRHistory from '@/components/QRHistory';
import { QrCode, ScanQrCode, History, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 float-animation"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 float-animation" style={{animationDelay: '2s'}}></div>
        <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 float-animation" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header with enhanced styling */}
        <div className="text-center mb-12 slide-in-top">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl glow-effect">
              <QrCode className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold gradient-text">HAG's QR Scanner</h1>
            <Sparkles className="h-6 w-6 text-yellow-500 float-animation" />
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Generate, scan, and manage QR codes with ease using our modern, interactive platform
          </p>
        </div>

        {/* Main Content with enhanced cards */}
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="generate" className="w-full">
            <div className="relative mb-8">
              <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-2 hover-lift">
                <TabsTrigger 
                  value="generate" 
                  className="flex items-center gap-2 rounded-xl transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
                >
                  <QrCode size={18} />
                  Generate
                </TabsTrigger>
                <TabsTrigger 
                  value="scan" 
                  className="flex items-center gap-2 rounded-xl transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
                >
                  <ScanQrCode size={18} />
                  Scan
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="flex items-center gap-2 rounded-xl transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
                >
                  <History size={18} />
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="generate" className="slide-in-left">
              <Card className="modern-card hover-lift">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl gradient-text">Generate QR Code</CardTitle>
                  <CardDescription className="text-lg">
                    Create beautiful QR codes from text, URLs, contact info, and more
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <QRGenerator onGenerate={addToHistory} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scan" className="slide-in-right">
              <Card className="modern-card hover-lift">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl gradient-text">Scan QR Code</CardTitle>
                  <CardDescription className="text-lg">
                    Use your camera to scan and decode QR codes instantly
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <QRScanner onScan={addToHistory} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="slide-in-left">
              <Card className="modern-card hover-lift">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl gradient-text">History</CardTitle>
                  <CardDescription className="text-lg">
                    View and manage your recently generated and scanned QR codes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <QRHistory history={history} onClearHistory={() => setHistory([])} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-30 float-animation"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Index;
