import { db } from '@/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, increment, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

const PIN_PROTECTED_QR_COLLECTION = 'pin_protected_qr_codes';

export interface QRScanEvent {
  qrId: string;
  timestamp: Date;
  location?: {
    country?: string;
    city?: string;
    ip?: string;
  };
  userAgent?: string;
  referrer?: string;
}

export interface QRAnalytics {
  qrId: string;
  totalScans: number;
  uniqueScans: number;
  firstScan?: Date;
  lastScan?: Date;
  scanEvents: QRScanEvent[];
  createdAt: Date;
  userId?: string;
}

const ANALYTICS_COLLECTION = 'qr_analytics';
const SCAN_EVENTS_COLLECTION = 'qr_scan_events';

/**
 * Track a QR code scan event
 */
export async function trackQRScan(
  qrId: string,
  scannerUserId?: string, // User who scanned (for scan events)
  metadata?: {
    location?: { country?: string; city?: string; ip?: string };
    userAgent?: string;
    referrer?: string;
  }
): Promise<void> {
  try {
    if (!qrId || qrId.trim().length === 0) {
      console.warn('⚠️ Cannot track scan: QR ID is empty');
      return;
    }

    // Get the QR creator's userId from the PIN-protected QR data
    // Analytics should be associated with the QR creator, not the scanner
    let qrCreatorUserId: string | undefined;
    try {
      const pinQRRef = doc(db, PIN_PROTECTED_QR_COLLECTION, qrId);
      const pinQRSnap = await getDoc(pinQRRef);
      if (pinQRSnap.exists()) {
        const pinQRData = pinQRSnap.data();
        qrCreatorUserId = pinQRData.userId;
        console.log('📝 Found QR creator userId:', qrCreatorUserId, 'for QR:', qrId);
      } else {
        console.warn('⚠️ PIN-protected QR not found in Firebase:', qrId);
      }
    } catch (error) {
      console.warn('⚠️ Could not get QR creator userId:', error);
    }

    // Create scan event (with scanner's userId)
    const scanEvent: QRScanEvent = {
      qrId,
      timestamp: new Date(),
      location: metadata?.location,
      userAgent: metadata?.userAgent,
      referrer: metadata?.referrer
    };

    // Store scan event (with scanner's userId)
    const eventRef = doc(collection(db, SCAN_EVENTS_COLLECTION));
    await setDoc(eventRef, {
      ...scanEvent,
      timestamp: serverTimestamp(),
      userId: scannerUserId // Scanner's userId for the event
    });

    // Update analytics summary (with QR creator's userId)
    const analyticsRef = doc(db, ANALYTICS_COLLECTION, qrId);
    const analyticsSnap = await getDoc(analyticsRef);

    if (analyticsSnap.exists()) {
      // Update existing analytics (preserve original creator's userId)
      const currentData = analyticsSnap.data();
      await updateDoc(analyticsRef, {
        totalScans: increment(1),
        lastScan: serverTimestamp(),
        // Note: uniqueScans would require more complex logic (tracking unique IPs/users)
        // For now, we'll approximate it
        uniqueScans: increment(1),
        // Preserve the original creator's userId if it exists
        userId: currentData.userId || qrCreatorUserId
      });
    } else {
      // Create new analytics record (with QR creator's userId)
      await setDoc(analyticsRef, {
        qrId,
        totalScans: 1,
        uniqueScans: 1,
        firstScan: serverTimestamp(),
        lastScan: serverTimestamp(),
        createdAt: serverTimestamp(),
        userId: qrCreatorUserId // QR creator's userId, not scanner's
      });
    }

    console.log('✅ QR scan tracked:', qrId, 'Creator:', qrCreatorUserId, 'Scanner:', scannerUserId);

    // Check and trigger scan threshold automations in real-time
    // Import dynamically to avoid circular dependencies
    const { checkAndTriggerScanThresholdAutomations } = await import('./workflowAutomations');
    checkAndTriggerScanThresholdAutomations(qrId).catch(err => {
      console.warn('⚠️ Failed to check automations:', err);
    });
  } catch (error) {
    console.error('❌ Error tracking QR scan:', error);
    // Don't throw - analytics failures shouldn't break the app
  }
}

/**
 * Get analytics for a specific QR code
 */
export async function getQRAnalytics(qrId: string): Promise<QRAnalytics | null> {
  try {
    const analyticsRef = doc(db, ANALYTICS_COLLECTION, qrId);
    const analyticsSnap = await getDoc(analyticsRef);

    if (!analyticsSnap.exists()) {
      return null;
    }

    const data = analyticsSnap.data();
    
    // Get recent scan events with fallback for missing index
    let scanEvents: QRScanEvent[] = [];
    try {
      const eventsQuery = query(
        collection(db, SCAN_EVENTS_COLLECTION),
        where('qrId', '==', qrId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const eventsSnap = await getDocs(eventsQuery);
      scanEvents = eventsSnap.docs.map(doc => {
        const eventData = doc.data();
        return {
          qrId: eventData.qrId,
          timestamp: eventData.timestamp?.toDate() || new Date(),
          location: eventData.location,
          userAgent: eventData.userAgent,
          referrer: eventData.referrer
        };
      });
    } catch (indexError: any) {
      // If index doesn't exist, fall back to querying without orderBy
      if (indexError?.code === 'failed-precondition' || indexError?.message?.includes('index')) {
        console.warn('⚠️ Index not found for qr_scan_events, using fallback query without orderBy');
        
        const eventsQuery = query(
          collection(db, SCAN_EVENTS_COLLECTION),
          where('qrId', '==', qrId),
          limit(100) // Get more to sort in memory
        );
        const eventsSnap = await getDocs(eventsQuery);
        scanEvents = eventsSnap.docs.map(doc => {
          const eventData = doc.data();
          return {
            qrId: eventData.qrId,
            timestamp: eventData.timestamp?.toDate() || new Date(),
            location: eventData.location,
            userAgent: eventData.userAgent,
            referrer: eventData.referrer
          };
        });
        
        // Sort by timestamp in memory (descending)
        scanEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Limit to 50 most recent
        scanEvents = scanEvents.slice(0, 50);
      } else {
        throw indexError;
      }
    }

    return {
      qrId: data.qrId,
      totalScans: data.totalScans || 0,
      uniqueScans: data.uniqueScans || 0,
      firstScan: data.firstScan?.toDate(),
      lastScan: data.lastScan?.toDate(),
      scanEvents,
      createdAt: data.createdAt?.toDate() || new Date(),
      userId: data.userId
    };
  } catch (error) {
    console.error('❌ Error getting QR analytics:', error);
    return null;
  }
}

/**
 * Get all analytics for a user's QR codes
 */
export async function getUserQRAnalytics(userId: string): Promise<QRAnalytics[]> {
  try {
    // First, try with the indexed query (if index exists)
    try {
      const analyticsQuery = query(
        collection(db, ANALYTICS_COLLECTION),
        where('userId', '==', userId),
        orderBy('lastScan', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(analyticsQuery);
      const analytics: QRAnalytics[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        analytics.push({
          qrId: data.qrId,
          totalScans: data.totalScans || 0,
          uniqueScans: data.uniqueScans || 0,
          firstScan: data.firstScan?.toDate(),
          lastScan: data.lastScan?.toDate(),
          scanEvents: [], // Don't load all events for list view
          createdAt: data.createdAt?.toDate() || new Date(),
          userId: data.userId
        });
      }

      // Sort by lastScan in memory as fallback
      analytics.sort((a, b) => {
        const aTime = a.lastScan?.getTime() || 0;
        const bTime = b.lastScan?.getTime() || 0;
        return bTime - aTime; // Descending order
      });

      return analytics;
    } catch (indexError: any) {
      // If index doesn't exist, fall back to querying without orderBy
      if (indexError?.code === 'failed-precondition' || indexError?.message?.includes('index')) {
        console.warn('⚠️ Index not found, using fallback query without orderBy');
        
        const analyticsQuery = query(
          collection(db, ANALYTICS_COLLECTION),
          where('userId', '==', userId),
          limit(100)
        );
        
        const snapshot = await getDocs(analyticsQuery);
        const analytics: QRAnalytics[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          analytics.push({
            qrId: data.qrId,
            totalScans: data.totalScans || 0,
            uniqueScans: data.uniqueScans || 0,
            firstScan: data.firstScan?.toDate(),
            lastScan: data.lastScan?.toDate(),
            scanEvents: [], // Don't load all events for list view
            createdAt: data.createdAt?.toDate() || new Date(),
            userId: data.userId
          });
        }

        // Sort by lastScan in memory
        analytics.sort((a, b) => {
          const aTime = a.lastScan?.getTime() || 0;
          const bTime = b.lastScan?.getTime() || 0;
          return bTime - aTime; // Descending order
        });

        return analytics;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('❌ Error getting user QR analytics:', error);
    return [];
  }
}

/**
 * Get user's IP address (for location tracking)
 */
export async function getUserIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn('⚠️ Could not get user IP:', error);
    return null;
  }
}

