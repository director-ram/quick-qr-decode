import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart3, TrendingUp, Users, Clock, MapPin, Eye, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getQRAnalytics, getUserQRAnalytics, type QRAnalytics } from '@/utils/qrAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from "@/components/ui/skeleton";

interface QRAnalyticsProps {
  qrId?: string; // If provided, show analytics for specific QR code
}

const QRAnalytics: React.FC<QRAnalyticsProps> = ({ qrId }) => {
  const [analytics, setAnalytics] = useState<QRAnalytics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<QRAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQR, setSelectedQR] = useState<QRAnalytics | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      if (qrId) {
        // Load specific QR analytics
        const data = await getQRAnalytics(qrId);
        setAnalytics(data);
      } else if (currentUser) {
        // Load user's all QR analytics
        const data = await getUserQRAnalytics(currentUser.uid);
        setUserAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [qrId, currentUser]);

  const formatDate = (date?: Date) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatRelativeTime = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Single QR Analytics View
  if (qrId && analytics) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                QR Code Analytics
              </CardTitle>
              <CardDescription>Track scans and engagement for this QR code</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={loadAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Total Scans</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">{analytics.totalScans}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Unique Scans</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{analytics.uniqueScans}</p>
            </div>
            <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">First Scan</span>
              </div>
              <p className="text-sm font-bold text-green-900">{formatRelativeTime(analytics.firstScan)}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Last Scan</span>
              </div>
              <p className="text-sm font-bold text-orange-900">{formatRelativeTime(analytics.lastScan)}</p>
            </div>
          </div>

          {/* Recent Scans */}
          {analytics.scanEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Recent Scans</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analytics.scanEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">{formatDate(event.timestamp)}</p>
                        {event.location && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location.city || event.location.country || 'Unknown location'}
                          </p>
                        )}
                      </div>
                    </div>
                    {event.userAgent && (
                      <Badge variant="outline" className="text-xs">
                        {event.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // User's All QR Analytics View
  if (!qrId) {
    if (loading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>QR Code Analytics</CardTitle>
            <CardDescription>Loading your QR code analytics...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (userAnalytics.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              QR Code Analytics
            </CardTitle>
            <CardDescription>Track scans and engagement for your QR codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Yet</h3>
              <p className="text-gray-500">
                Analytics will appear here once your QR codes are scanned
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                QR Code Analytics
              </CardTitle>
              <CardDescription>Track scans and engagement for all your QR codes</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={loadAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userAnalytics.map((analytics) => (
              <Card
                key={analytics.qrId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={async () => {
                  const fullAnalytics = await getQRAnalytics(analytics.qrId);
                  if (fullAnalytics) {
                    setSelectedQR(fullAnalytics);
                    setShowDetails(true);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {analytics.qrId.substring(0, 12)}...
                        </Badge>
                        <Badge variant="secondary">
                          {analytics.totalScans} scans
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Created: {formatDate(analytics.createdAt)}
                        </span>
                        {analytics.lastScan && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Last: {formatRelativeTime(analytics.lastScan)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 lg:ml-4">
                      <div className="text-center flex-1">
                        <p className="text-2xl font-bold text-purple-600">{analytics.totalScans}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-2xl font-bold text-blue-600">{analytics.uniqueScans}</p>
                        <p className="text-xs text-gray-500">Unique</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>

        {/* Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-auto max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>QR Code Analytics Details</DialogTitle>
              <DialogDescription>
                Detailed analytics for QR ID: {selectedQR?.qrId}
              </DialogDescription>
            </DialogHeader>
            {selectedQR && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600 mb-1">Total Scans</p>
                    <p className="text-2xl font-bold text-purple-900">{selectedQR.totalScans}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 mb-1">Unique Scans</p>
                    <p className="text-2xl font-bold text-blue-900">{selectedQR.uniqueScans}</p>
                  </div>
                </div>
                {selectedQR.scanEvents.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Recent Scan Events</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedQR.scanEvents.map((event, index) => (
                        <div
                          key={index}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <p className="text-sm font-medium">{formatDate(event.timestamp)}</p>
                          {event.location && (
                            <p className="text-xs text-gray-500">
                              Location: {event.location.city || event.location.country || 'Unknown'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  return null;
};

export default QRAnalytics;

