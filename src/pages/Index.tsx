
import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import QRGenerator from '@/components/QRGenerator';
import QRScanner from '@/components/QRScanner';
import QRHistory from '@/components/QRHistory';
import BulkQRGenerator from '@/components/BulkQRGenerator';
import QRAnalytics from '@/components/QRAnalytics';
import WorkflowAutomations from '@/components/WorkflowAutomations';
import AnimatedBackground from '@/components/AnimatedBackground';
import FloatingParticles from '@/components/FloatingParticles';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';
import { QrCode, ScanQrCode, History, Sparkles, LogOut, X, Code, Globe, Users, BarChart3, ExternalLink, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const DEFAULT_AVATAR = '/default-avatar.svg';

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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('generate');
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const [automationPrefill, setAutomationPrefill] = useState<{ qrId: string; qrName: string; qrUrl?: string } | null>(null);
  const clearGeneratorCacheRef = useRef<(() => void) | null>(null);

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
        setHistoryLoading(false);
      },
      (error) => {
        console.error("Error loading history:", error);
        setHistoryLoading(false);
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
      // Clear generator cache on logout
      if (clearGeneratorCacheRef.current) {
        clearGeneratorCacheRef.current();
      }
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

  const getUserAvatar = () => {
    if (!currentUser) return DEFAULT_AVATAR;

    const googleProfile = currentUser.providerData?.find(
      (provider) => provider.providerId === 'google.com' && provider.photoURL
    );

    return googleProfile?.photoURL || currentUser.photoURL || DEFAULT_AVATAR;
  };

  const handleAvatarError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    event.currentTarget.src = DEFAULT_AVATAR;
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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+g': () => setActiveTab('generate'),
    'ctrl+s': () => setActiveTab('scan'),
    'ctrl+h': () => setActiveTab('history'),
    'ctrl+m': () => setActiveTab('automations'),
    'ctrl+a': () => setActiveTab('analytics'),
    'ctrl+/': () => {
      toast({
        title: "Keyboard Shortcuts",
        description: "Ctrl+G: Generate | Ctrl+S: Scan | Ctrl+H: History | Ctrl+M: Automations | Ctrl+A: Analytics"
      });
    }
  });

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <AnimatedBackground />
      <FloatingParticles />

      <div className="container mx-auto px-4 pt-20 sm:pt-8 pb-8 relative z-10">
        {/* Logo in top left corner - Clickable to open sidebar */}
        <div className="absolute top-4 left-4 z-20">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <img 
              src="/HAG.jpg" 
              alt="HAG's QR Scanner Logo" 
              className="h-10 w-10 rounded-lg object-cover shadow-lg border-2 border-white/30 group-hover:border-white/50 transition-all duration-300 group-hover:scale-110"
            />
            <span className="text-white font-bold text-lg hidden sm:block group-hover:text-purple-300 transition-colors">
              HAG's QR Scanner
            </span>
          </button>
        </div>

        {/* User Info and Logout */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 mt-16">
          <div className="flex items-center gap-3 text-white">
            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white/30 shadow-lg bg-white/10 backdrop-blur-sm flex-shrink-0">
              <img 
                src={getUserAvatar()} 
                alt={`${getUserDisplayName()}'s avatar`} 
                className="h-full w-full object-cover"
                onError={handleAvatarError}
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs uppercase tracking-wide text-white/70">Welcome</span>
              <span className="text-lg font-semibold">{getUserDisplayName()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <ThemeToggle />
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300 flex-1 sm:flex-none"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Header */}
        <PageHeader />

        {/* Main Content with enhanced cards */}
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="relative mb-8">
              <div ref={tabsRef} className="relative">
                <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-2 hover-lift relative overflow-hidden">
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
                    <span className="font-medium hidden sm:inline">Generate</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="scan" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <ScanQrCode size={18} />
                    <span className="font-medium hidden sm:inline">Scan</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="history" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <History size={18} />
                    <span className="font-medium hidden sm:inline">History</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="automations" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <Zap size={18} />
                    <span className="font-medium hidden sm:inline">Automations</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="analytics" 
                    className="flex items-center gap-2 rounded-xl transition-all duration-300 relative z-20 data-[state=active]:text-white data-[state=inactive]:text-gray-700 hover:text-gray-900 bg-transparent border-0 shadow-none"
                  >
                    <BarChart3 size={18} />
                    <span className="font-medium hidden sm:inline">Analytics</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="analytics" className="slide-in-left">
              <Card className="modern-card hover-lift">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl gradient-text">QR Code Analytics</CardTitle>
                  <CardDescription className="text-lg">
                    Track scans, engagement, and performance of your QR codes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <QRAnalytics />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="generate" className="slide-in-left">
              <div className="space-y-6">
                <Card className="modern-card hover-lift">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl gradient-text">Generate QR Code</CardTitle>
                    <CardDescription className="text-lg">
                      Create beautiful QR codes from text, URLs, contact info, and more
                    </CardDescription>
                  </CardHeader>
                <CardContent className="p-8">
                  <QRGenerator 
                    onGenerate={addToHistory} 
                    history={history}
                    onAutomationPrompt={(qrId, qrName, qrUrl) => {
                      setAutomationPrefill({ qrId, qrName, qrUrl });
                      setActiveTab('automations');
                      toast({
                        title: "Redirecting to Automations",
                        description: "Let's set up your automation!"
                      });
                    }}
                    onClearCache={(clearFn) => {
                      clearGeneratorCacheRef.current = clearFn;
                    }}
                  />
                </CardContent>
                </Card>
                
                <Card className="modern-card hover-lift">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl gradient-text">Bulk QR Generator</CardTitle>
                    <CardDescription className="text-lg">
                      Generate multiple QR codes at once from a list
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <BulkQRGenerator onGenerate={addToHistory} />
                  </CardContent>
                </Card>
              </div>
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
                  <QRHistory history={history} onClearHistory={clearHistory} loading={historyLoading} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="automations" className="slide-in-right">
              <WorkflowAutomations 
                prefillData={automationPrefill} 
                onPrefillUsed={() => setAutomationPrefill(null)}
                onClearGeneratorCache={() => {
                  if (clearGeneratorCacheRef.current) {
                    clearGeneratorCacheRef.current();
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <Footer />
      </div>

      {/* About Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent 
          side="left" 
          className="w-[90vw] sm:w-[400px] bg-black/80 backdrop-blur-lg border-r border-white/20 shadow-2xl flex flex-col h-full p-0"
        >
          {/* Fixed Header */}
          <SheetHeader className="mb-0 p-6 pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <img 
                src="/HAG.jpg" 
                alt="HAG's QR Scanner Logo" 
                className="h-12 w-12 rounded-lg object-cover shadow-md"
              />
              <SheetTitle className="text-2xl font-bold text-white">
                About HAG's QR Scanner
              </SheetTitle>
            </div>
            <SheetDescription className="text-left text-gray-300 mt-2">
              Learn more about this project and its creators
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 sidebar-scrollbar">
            <div className="space-y-6">
            {/* Built With Section */}
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-5 border border-purple-400/30 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Code className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Built With</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>React</strong> + <strong>TypeScript</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>Vite</strong> - Build Tool</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>Tailwind CSS</strong> - Styling</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>Firebase</strong> - Backend & Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>shadcn/ui</strong> - UI Components</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>html5-qrcode</strong> - QR Code Scanning</span>
                </div>
              </div>
            </div>

            {/* Deployed On Section */}
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-5 border border-blue-400/30 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Deployed On</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Netlify</strong> - Frontend Hosting</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Firebase</strong> - Backend Services</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Custom Domain</strong> - hagqrscanner.website</span>
                </div>
              </div>
            </div>

            {/* Creators Section */}
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-5 border border-green-400/30 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Creators</h3>
              </div>
              <div className="space-y-3">
                <a
                  href="https://portfolio-sigma-black-77.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border border-green-400/30 backdrop-blur-sm hover:bg-white/15 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    H
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white group-hover:text-green-300 transition-colors">Hemasai</p>
                      <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-green-300 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-300">Developer</p>
                  </div>
                </a>
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border border-blue-400/30 backdrop-blur-sm">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    A
                  </div>
                  <div>
                    <p className="font-semibold text-white">Ahbiram</p>
                    <p className="text-xs text-gray-300">Developer & TL</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border border-purple-400/30 backdrop-blur-sm">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    G
                  </div>
                  <div>
                    <p className="font-semibold text-white">Gopi</p>
                    <p className="text-xs text-gray-300">Tester</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Info */}
            <div className="bg-gradient-to-br from-gray-800/40 to-slate-800/40 rounded-xl p-5 border border-gray-600/30 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-2">Project Information</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                HAG's QR Scanner is a modern, feature-rich QR code generator and scanner application 
                built with cutting-edge web technologies. It supports various QR code formats including 
                URLs, WiFi networks, contact cards, UPI payments, and more.
              </p>
            </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Index;
