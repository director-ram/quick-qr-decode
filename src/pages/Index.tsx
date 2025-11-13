
import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QRGenerator from '@/components/QRGenerator';
import QRScanner from '@/components/QRScanner';
import QRHistory from '@/components/QRHistory';
import AnimatedBackground from '@/components/AnimatedBackground';
import FloatingParticles from '@/components/FloatingParticles';
import PageHeader from '@/components/PageHeader';
import { QrCode, ScanQrCode, History, Sparkles, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// >>>>> Import Firestore <<<<<
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, doc, getDocs } from 'firebase/firestore';
// ^^^^^ Imports for Firestore ^^^^^

export interface QRHistoryItem {
  id: string;
  type: 'generated' | 'scanned';
  data: string;
  timestamp: Date;
  dataType?: string;
  userId: string;
}

const Index = () => {
  const [history, setHistory] = useState<QRHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState('generate');
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();

  // Test Firestore connection
  useEffect(() => {
    console.log("Testing Firestore connection...");
    console.log("Current user:", currentUser?.uid || "No user");
    console.log("Database instance:", db);
  }, [currentUser]);

  const addToHistory = async (item: Omit<QRHistoryItem, 'id' | 'timestamp' | 'userId'>) => {
    if (!currentUser) {
      console.log("No current user, cannot add to history");
      return;
    }

    console.log("Adding to history:", item, "for user:", currentUser.uid);
    
    try {
      const docRef = await addDoc(collection(db, "qr_history"), {
                ...item,
        userId: currentUser.uid,
        timestamp: serverTimestamp()
      });
      console.log("Successfully added to history with ID:", docRef.id);
      } catch (error) {
      console.error("Error adding to history:", error);
      toast({
        title: "Failed to Save",
        description: "Could not save to history. Check console for details.",
        variant: "destructive"
      });
    }
  };

  const clearHistory = async () => {
    if (!currentUser) {
      console.log("No current user, cannot clear history");
      return;
    }

    console.log("Clearing history for user:", currentUser.uid);
    
    try {
      // Show loading toast
      toast({
        title: "🗑️ Clearing History...",
        description: "Deleting all QR history records..."
      });

      // Query all documents for the current user
      const q = query(
        collection(db, "qr_history"), 
        where("userId", "==", currentUser.uid)
      );

      // Get all documents
      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.docs.length} documents to delete`);

      // Delete each document
      const deletePromises = querySnapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, "qr_history", docSnapshot.id))
      );

      // Wait for all deletions to complete
      await Promise.all(deletePromises);

      console.log("Successfully cleared all history");
      
      toast({
        title: "✅ History Cleared",
        description: `Deleted ${querySnapshot.docs.length} QR history records`
      });

    } catch (error) {
      console.error("Error clearing history:", error);
      toast({
        title: "❌ Clear Failed",
        description: "Could not clear history. Please try again.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (!currentUser) {
      console.log("No current user, cannot load history");
      return;
    }

    console.log("Setting up history listener for user:", currentUser.uid);

    const q = query(
      collection(db, "qr_history"), 
      where("userId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log("History snapshot received, docs count:", snapshot.docs.length);
        const records: QRHistoryItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log("Processing history doc:", doc.id, data);
          records.push({
            id: doc.id,
            type: data.type,
            data: data.data,
            dataType: data.dataType,
            userId: data.userId,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
          });
        });
        console.log("Setting history records:", records);
        setHistory(records);
      },
      (error) => {
        console.error("Error loading history:", error);
        toast({
          title: "History Load Failed",
          description: "Could not load QR history. Check Firestore settings.",
          variant: "destructive"
        });
      }
    );

    return () => unsubscribe();
  }, [currentUser, toast]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out"
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: "There was an error logging out",
        variant: "destructive"
      });
    }
  };

  const getUserDisplayName = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName;
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'User';
  };

  useEffect(() => {
    const updateIndicator = () => {
      if (tabsRef.current) {
        const activeButton = tabsRef.current.querySelector(`[data-state="active"]`) as HTMLElement;
        if (activeButton) {
          const rect = activeButton.getBoundingClientRect();
          const containerRect = tabsRef.current.getBoundingClientRect();
          setIndicatorStyle({
            width: rect.width - 8,
            left: rect.left - containerRect.left + 4,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          });
        }
      }
    };

    updateIndicator();
    const timeoutId = setTimeout(updateIndicator, 100);
    
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <AnimatedBackground />
      <FloatingParticles />

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* User Info and Logout */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
              <User className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">
              Welcome, {getUserDisplayName()}
            </span>
          </div>
          
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Header */}
        <PageHeader />

        {/* Main Content with enhanced cards */}
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="relative mb-8">
              <div ref={tabsRef} className="relative">
                <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-2 hover-lift relative overflow-hidden">
                  {/* Floating indicator bar - positioned behind text */}
                  <div 
                    className="absolute top-2 bottom-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg transition-all duration-300 ease-in-out z-10"
                    style={indicatorStyle}
                  />
                  
                  <TabsTrigger 
                    value="generate" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <QrCode size={18} />
                    <span className="font-medium">Generate</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="scan" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <ScanQrCode size={18} />
                    <span className="font-medium">Scan</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="history" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <History size={18} />
                    <span className="font-medium">History</span>
                  </TabsTrigger>
                </TabsList>
              </div>
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
                  <QRGenerator onGenerate={addToHistory} history={history} />
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
                  <QRHistory history={history} onClearHistory={clearHistory} />
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
