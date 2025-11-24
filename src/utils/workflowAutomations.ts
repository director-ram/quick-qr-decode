import { db } from '@/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { differenceInCalendarDays, differenceInHours } from 'date-fns';

const WORKFLOW_COLLECTION = 'qr_workflows';
const QR_COLLECTION = 'pin_protected_qr_codes';
const ANALYTICS_COLLECTION = 'qr_analytics';

export type WorkflowTriggerType = 'schedule' | 'scan_threshold' | 'inactivity' | 'expiry';
export type WorkflowActionType = 'notify' | 'pause_qr' | 'update_destination';

export interface WorkflowTriggerConfig {
  frequency?: 'daily' | 'weekly' | 'monthly';
  runAtHour?: number;
  threshold?: number;
  inactivityDays?: number;
  expiryDate?: string;
}

export interface WorkflowActionConfig {
  type: WorkflowActionType;
  payload?: Record<string, any>;
}

export interface WorkflowAutomation {
  id: string;
  userId: string;
  name: string;
  qrId?: string;
  qrLabel?: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: WorkflowTriggerConfig;
  actions: WorkflowActionConfig[];
  status: 'active' | 'paused';
  lastRunAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface CreateWorkflowPayload
  extends Omit<WorkflowAutomation, 'id' | 'lastRunAt' | 'createdAt' | 'updatedAt'> {}

export const fetchUserWorkflows = async (userId: string): Promise<WorkflowAutomation[]> => {
  const baseQuery = query(collection(db, WORKFLOW_COLLECTION), where('userId', '==', userId));

  const runQuery = async (ordered: boolean) => {
    const workflowsQuery = ordered ? query(baseQuery, orderBy('createdAt', 'desc')) : baseQuery;
    const snapshot = await getDocs(workflowsQuery);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        name: data.name,
        qrId: data.qrId,
        qrLabel: data.qrLabel,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig || {},
        actions: data.actions || [],
        status: data.status || 'active',
        lastRunAt: data.lastRunAt?.toDate ? data.lastRunAt.toDate() : null,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
      } as WorkflowAutomation;
    });
  };

  try {
    return await runQuery(true);
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('The query requires an index')) {
      // Extract the index creation link from the error if available
      const linkMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
      const indexLink = linkMatch ? linkMatch[0] : null;
      
      console.warn(
        '⚠️ Firestore index missing for qr_workflows orderBy(createdAt). ' +
        'Falling back to unordered query. ' +
        'To enable sorting, create a composite index:\n' +
        '  Collection: qr_workflows\n' +
        '  Fields: userId (Ascending), createdAt (Descending)' +
        (indexLink ? `\n  Create it here: ${indexLink}` : '')
      );
      
      return await runQuery(false);
    }
    throw error;
  }
};

const sanitize = (value: any): any => {
  // Handle undefined - return a special marker to filter it out
  if (value === undefined) {
    return undefined; // Will be filtered out
  }
  
  // Handle null - keep null as it's a valid Firestore value
  if (value === null) {
    return null;
  }
  
  // Handle arrays - recursively sanitize and filter out undefined items
  if (Array.isArray(value)) {
    const sanitized = value.map(item => sanitize(item));
    return sanitized.filter(item => item !== undefined);
  }
  
  // Handle objects - recursively sanitize and remove undefined properties
  if (typeof value === 'object' && value !== null) {
    const cleaned: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const sanitized = sanitize(val);
      // Only include if not undefined after sanitization
      if (sanitized !== undefined) {
        cleaned[key] = sanitized;
      }
    });
    return cleaned;
  }
  
  // Handle primitives (string, number, boolean, etc.)
  return value;
};

export const createWorkflowAutomation = async (payload: CreateWorkflowPayload) => {
  const rawData: Record<string, any> = {
    userId: payload.userId,
    name: payload.name,
    triggerType: payload.triggerType,
    triggerConfig: payload.triggerConfig || {},
    actions: payload.actions || [],
    status: payload.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastRunAt: null,
  };

  // Conditionally add optional fields
  if (payload.qrId) {
    rawData.qrId = payload.qrId;
  }
  if (payload.qrLabel) {
    rawData.qrLabel = payload.qrLabel;
  }

  // Sanitize the entire data object to remove undefined values
  const data = sanitize(rawData) as Record<string, any>;

  await addDoc(collection(db, WORKFLOW_COLLECTION), data);
};

export const updateWorkflowStatus = async (workflowId: string, status: 'active' | 'paused') => {
  const workflowRef = doc(db, WORKFLOW_COLLECTION, workflowId);
  await updateDoc(workflowRef, {
    status,
    updatedAt: serverTimestamp(),
  });
};

export const deleteWorkflowAutomation = async (workflowId: string) => {
  await deleteDoc(doc(db, WORKFLOW_COLLECTION, workflowId));
};

/**
 * Check and trigger scan threshold automations in real-time
 * This is called immediately after a scan is tracked to avoid delays
 */
export const checkAndTriggerScanThresholdAutomations = async (qrId: string): Promise<void> => {
  try {
    console.log('🔍 Checking scan threshold automations for QR:', qrId);

    // Get current scan count from analytics
    const analyticsRef = doc(db, ANALYTICS_COLLECTION, qrId);
    const analyticsSnap = await getDoc(analyticsRef);
    
    if (!analyticsSnap.exists()) {
      console.log('⚠️ No analytics found for QR:', qrId);
      return;
    }

    const analyticsData = analyticsSnap.data();
    const totalScans = analyticsData?.totalScans || 0;
    console.log('📊 Current total scans:', totalScans);

    // Find all active workflows for this QR with scan_threshold trigger
    // Note: This query requires a composite index: qrId (Ascending), status (Ascending), triggerType (Ascending)
    // If the index is missing, we'll fall back to querying by qrId only and filter in memory
    // Also note: This will only work if the current user is the QR owner (due to Firestore security rules)
    // If permission is denied, we'll silently fail and let the backend scheduled function handle it
    let workflowsSnap;
    try {
      const workflowsQuery = query(
        collection(db, WORKFLOW_COLLECTION),
        where('qrId', '==', qrId),
        where('status', '==', 'active'),
        where('triggerType', '==', 'scan_threshold')
      );
      workflowsSnap = await getDocs(workflowsQuery);
    } catch (queryError: any) {
      // Handle permission denied - scanner is not the QR owner
      if (queryError?.code === 'permission-denied' || queryError?.message?.includes('permission')) {
        console.log('ℹ️ Permission denied to query workflows. Scanner is not the QR owner. Backend will handle automation.');
        return; // Silently exit - backend scheduled function will handle it
      }
      
      // Fallback: query by qrId only and filter in memory (for index errors)
      if (queryError?.code === 'failed-precondition' || queryError?.message?.includes('index')) {
        console.warn('⚠️ Composite index missing, using fallback query');
        try {
          const workflowsQuery = query(
            collection(db, WORKFLOW_COLLECTION),
            where('qrId', '==', qrId)
          );
          workflowsSnap = await getDocs(workflowsQuery);
          // Filter in memory
          workflowsSnap = {
            ...workflowsSnap,
            docs: workflowsSnap.docs.filter(doc => {
              const data = doc.data();
              return data.status === 'active' && data.triggerType === 'scan_threshold';
            })
          } as any;
        } catch (fallbackError: any) {
          if (fallbackError?.code === 'permission-denied') {
            console.log('ℹ️ Permission denied to query workflows. Backend will handle automation.');
            return;
          }
          throw fallbackError;
        }
      } else {
        throw queryError;
      }
    }
    
    if (workflowsSnap.empty) {
      console.log('ℹ️ No active scan threshold workflows found for QR:', qrId);
      return;
    }

    console.log(`📋 Found ${workflowsSnap.docs.length} active scan threshold workflow(s)`);

    // Check each workflow
    for (const workflowDoc of workflowsSnap.docs) {
      const workflow = workflowDoc.data();
      const workflowId = workflowDoc.id;
      const threshold = workflow.triggerConfig?.threshold || 100;
      const lastTriggerValue = workflow.lastTriggerValue || 0;

      console.log(`🔍 Checking workflow "${workflow.name}": threshold=${threshold}, current=${totalScans}, lastTriggered=${lastTriggerValue}`);

      // Check if threshold is met
      if (totalScans < threshold) {
        console.log(`⏳ Threshold not met yet: ${totalScans} < ${threshold}`);
        continue;
      }

      // Check if already triggered for this scan count
      if (lastTriggerValue === totalScans) {
        console.log(`✅ Already triggered for scan count ${totalScans}`);
        continue;
      }

      console.log(`✅ Threshold met! Triggering workflow "${workflow.name}"`);

      // Execute actions
      for (const action of workflow.actions || []) {
        try {
          switch (action.type) {
            case 'pause_qr':
              console.log('⏸️ Executing pause_qr action');
              try {
                const qrRef = doc(db, QR_COLLECTION, qrId);
                // Create a detailed pause reason message
                let pauseReason = action.payload?.message;
                if (!pauseReason) {
                  if (workflow.triggerType === 'scan_threshold') {
                    pauseReason = `⏸️ This QR code has been automatically paused after reaching ${threshold} scans. The automation "${workflow.name}" has been triggered.`;
                  } else if (workflow.triggerType === 'schedule') {
                    pauseReason = `⏸️ This QR code has been automatically paused by the scheduled automation "${workflow.name}".`;
                  } else if (workflow.triggerType === 'inactivity') {
                    pauseReason = `⏸️ This QR code has been automatically paused due to inactivity. The automation "${workflow.name}" has been triggered.`;
                  } else if (workflow.triggerType === 'expiry') {
                    pauseReason = `⏸️ This QR code has been automatically paused as it has expired. The automation "${workflow.name}" has been triggered.`;
                  } else {
                    pauseReason = `⏸️ This QR code has been automatically paused by the automation "${workflow.name}".`;
                  }
                }
                await updateDoc(qrRef, {
                  automationStatus: 'paused',
                  automationPausedAt: serverTimestamp(),
                  automationPausedBy: workflow.name,
                  automationPausedReason: pauseReason,
                });
                console.log('✅ QR code paused successfully');
              } catch (pauseError: any) {
                // If permission denied, log but don't fail - backend will handle it
                if (pauseError?.code === 'permission-denied') {
                  console.warn('⚠️ Permission denied to pause QR. Backend scheduled function will handle it.');
                } else {
                  throw pauseError;
                }
              }
              break;

            case 'update_destination':
              console.log('🔁 Executing update_destination action');
              const destination = action.payload?.destination || action.payload?.url;
              if (destination) {
                try {
                  const qrRef = doc(db, QR_COLLECTION, qrId);
                  await updateDoc(qrRef, {
                    automationOverrides: {
                      destination,
                      updatedAt: serverTimestamp(),
                      workflowName: workflow.name,
                    },
                  });
                  console.log('✅ Destination updated successfully');
                } catch (updateError: any) {
                  // If permission denied, log but don't fail - backend will handle it
                  if (updateError?.code === 'permission-denied') {
                    console.warn('⚠️ Permission denied to update destination. Backend scheduled function will handle it.');
                  } else {
                    throw updateError;
                  }
                }
              }
              break;

            case 'notify':
              console.log('📧 Notify action would be handled by backend (webhook/email)');
              // Notify actions are handled by the backend scheduled function
              // We'll just log it here
              break;

            default:
              console.warn('⚠️ Unknown action type:', action.type);
          }
        } catch (actionError) {
          console.error(`❌ Error executing action ${action.type}:`, actionError);
        }
      }

      // Update workflow's lastRunAt and lastTriggerValue
      try {
        const workflowRef = doc(db, WORKFLOW_COLLECTION, workflowId);
        await updateDoc(workflowRef, {
          lastRunAt: serverTimestamp(),
          lastTriggerValue: totalScans,
          updatedAt: serverTimestamp(),
        });
        console.log(`✅ Workflow "${workflow.name}" executed successfully`);
      } catch (updateError: any) {
        // If permission denied, log but don't fail - backend will handle it
        if (updateError?.code === 'permission-denied') {
          console.warn('⚠️ Permission denied to update workflow. Backend scheduled function will handle it.');
        } else {
          throw updateError;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking scan threshold automations:', error);
    // Don't throw - automation failures shouldn't break the scan tracking
  }
};

/**
 * Check and trigger time-based automations (schedule, expiry, inactivity) in real-time
 * This is called when scanning a QR to check if any time-based automations should have triggered
 */
export const checkAndTriggerTimeBasedAutomations = async (qrId: string): Promise<void> => {
  try {
    console.log('🔍 Checking time-based automations for QR:', qrId);

    // Find all active workflows for this QR with time-based triggers
    // Note: This will only work if the current user is the QR owner (due to Firestore security rules)
    // If permission is denied, we'll silently fail and let the backend scheduled function handle it
    let workflowsSnap;
    try {
      const workflowsQuery = query(
        collection(db, WORKFLOW_COLLECTION),
        where('qrId', '==', qrId),
        where('status', '==', 'active')
      );
      workflowsSnap = await getDocs(workflowsQuery);
    } catch (queryError: any) {
      // Handle permission denied - scanner is not the QR owner
      if (queryError?.code === 'permission-denied' || queryError?.message?.includes('permission')) {
        console.log('ℹ️ Permission denied to query workflows. Scanner is not the QR owner. Backend will handle automation.');
        return; // Silently exit - backend scheduled function will handle it
      }
      
      // Fallback for index errors
      if (queryError?.code === 'failed-precondition' || queryError?.message?.includes('index')) {
        console.warn('⚠️ Index missing, using fallback query');
        try {
          const workflowsQuery = query(
            collection(db, WORKFLOW_COLLECTION),
            where('qrId', '==', qrId)
          );
          workflowsSnap = await getDocs(workflowsQuery);
          workflowsSnap = {
            ...workflowsSnap,
            docs: workflowsSnap.docs.filter(doc => {
              const data = doc.data();
              return data.status === 'active';
            })
          } as any;
        } catch (fallbackError: any) {
          if (fallbackError?.code === 'permission-denied') {
            console.log('ℹ️ Permission denied to query workflows. Backend will handle automation.');
            return;
          }
          throw fallbackError;
        }
      } else {
        throw queryError;
      }
    }

    if (workflowsSnap.empty) {
      console.log('ℹ️ No active workflows found for QR:', qrId);
      return;
    }

    const now = new Date();
    const timeBasedTriggers = ['schedule', 'expiry', 'inactivity'];

    // Get analytics for inactivity check
    let analyticsData: any = null;
    try {
      const analyticsRef = doc(db, ANALYTICS_COLLECTION, qrId);
      const analyticsSnap = await getDoc(analyticsRef);
      if (analyticsSnap.exists()) {
        analyticsData = analyticsSnap.data();
      }
    } catch (error) {
      console.warn('⚠️ Could not get analytics for inactivity check:', error);
    }

    // Check each workflow
    for (const workflowDoc of workflowsSnap.docs) {
      const workflow = workflowDoc.data();
      const workflowId = workflowDoc.id;
      const triggerType = workflow.triggerType;

      // Only check time-based triggers
      if (!timeBasedTriggers.includes(triggerType)) {
        continue;
      }

      console.log(`🔍 Checking ${triggerType} workflow "${workflow.name}"`);

      let shouldTrigger = false;
      let triggerReason = '';

      // Evaluate schedule trigger
      if (triggerType === 'schedule') {
        const runAtHour = workflow.triggerConfig?.runAtHour ?? 9;
        const frequency = workflow.triggerConfig?.frequency || 'daily';
        
        // Check if current hour matches runAtHour
        if (now.getUTCHours() === runAtHour) {
          // Check if it hasn't run today yet
          const lastRunAt = workflow.lastRunAt?.toDate ? workflow.lastRunAt.toDate() : null;
          
          if (!lastRunAt) {
            shouldTrigger = true;
            triggerReason = `Scheduled time reached (${runAtHour}:00 UTC)`;
          } else {
            const diff = differenceInHours(now, lastRunAt);
            const requiredGap = frequency === 'weekly' ? 24 * 7 : frequency === 'monthly' ? 24 * 30 : 24;
            
            if (diff >= requiredGap) {
              shouldTrigger = true;
              triggerReason = `Scheduled time reached (${runAtHour}:00 UTC, ${frequency})`;
            }
          }
        }
      }

      // Evaluate expiry trigger
      if (triggerType === 'expiry') {
        const expiryDate = workflow.triggerConfig?.expiryDate;
        if (expiryDate) {
          const expiry = new Date(expiryDate);
          if (!isNaN(expiry.getTime()) && now >= expiry) {
            const lastRunAt = workflow.lastRunAt?.toDate ? workflow.lastRunAt.toDate() : null;
            if (!lastRunAt || lastRunAt < expiry) {
              shouldTrigger = true;
              triggerReason = `Expiry date reached (${expiryDate})`;
            }
          }
        }
      }

      // Evaluate inactivity trigger
      if (triggerType === 'inactivity') {
        const inactivityDays = workflow.triggerConfig?.inactivityDays ?? 3;
        
        if (!analyticsData) {
          // No analytics = never scanned = inactive
          shouldTrigger = true;
          triggerReason = `No scans recorded (inactivity threshold: ${inactivityDays} days)`;
        } else {
          const lastScanTimestamp = analyticsData.lastScan?.toDate ? analyticsData.lastScan.toDate() : null;
          if (!lastScanTimestamp) {
            shouldTrigger = true;
            triggerReason = `No scans recorded (inactivity threshold: ${inactivityDays} days)`;
          } else {
            const diffDays = differenceInCalendarDays(now, lastScanTimestamp);
            if (diffDays >= inactivityDays) {
              shouldTrigger = true;
              triggerReason = `Inactivity threshold reached (${diffDays} days without scans)`;
            }
          }
        }
      }

      // If trigger condition is met, execute actions
      if (shouldTrigger) {
        // Check if already triggered for this condition
        const lastRunAt = workflow.lastRunAt?.toDate ? workflow.lastRunAt.toDate() : null;
        if (lastRunAt) {
          // For schedule, check if already run today
          if (triggerType === 'schedule') {
            const lastRunDate = new Date(lastRunAt);
            const today = new Date(now);
            if (
              lastRunDate.getUTCFullYear() === today.getUTCFullYear() &&
              lastRunDate.getUTCMonth() === today.getUTCMonth() &&
              lastRunDate.getUTCDate() === today.getUTCDate() &&
              lastRunDate.getUTCHours() === now.getUTCHours()
            ) {
              console.log(`⏭️ Already triggered today for workflow "${workflow.name}"`);
              continue;
            }
          } else {
            // For expiry/inactivity, check if already handled
            if (lastRunAt >= now) {
              console.log(`⏭️ Already triggered for workflow "${workflow.name}"`);
              continue;
            }
          }
        }

        console.log(`✅ ${triggerType} trigger met! Executing workflow "${workflow.name}": ${triggerReason}`);

        // Execute actions
        for (const action of workflow.actions || []) {
          try {
            switch (action.type) {
              case 'pause_qr':
                console.log('⏸️ Executing pause_qr action');
                try {
                  const qrRef = doc(db, QR_COLLECTION, qrId);
                  let pauseReason = action.payload?.message;
                  if (!pauseReason) {
                    pauseReason = `⏸️ This QR code has been automatically paused by the ${triggerType} automation "${workflow.name}". ${triggerReason}`;
                  }
                  await updateDoc(qrRef, {
                    automationStatus: 'paused',
                    automationPausedAt: serverTimestamp(),
                    automationPausedBy: workflow.name,
                    automationPausedReason: pauseReason,
                  });
                  console.log('✅ QR code paused successfully');
                } catch (pauseError: any) {
                  if (pauseError?.code === 'permission-denied') {
                    console.warn('⚠️ Permission denied to pause QR. Backend scheduled function will handle it.');
                  } else {
                    throw pauseError;
                  }
                }
                break;

              case 'update_destination':
                console.log('🔁 Executing update_destination action');
                const destination = action.payload?.destination || action.payload?.url;
                if (destination) {
                  try {
                    const qrRef = doc(db, QR_COLLECTION, qrId);
                    await updateDoc(qrRef, {
                      automationOverrides: {
                        destination,
                        updatedAt: serverTimestamp(),
                        workflowName: workflow.name,
                      },
                    });
                    console.log('✅ Destination updated successfully');
                  } catch (updateError: any) {
                    if (updateError?.code === 'permission-denied') {
                      console.warn('⚠️ Permission denied to update destination. Backend scheduled function will handle it.');
                    } else {
                      throw updateError;
                    }
                  }
                }
                break;

              case 'notify':
                console.log('📧 Notify action would be handled by backend (webhook/email)');
                break;

              default:
                console.warn('⚠️ Unknown action type:', action.type);
            }
          } catch (actionError) {
            console.error(`❌ Error executing action ${action.type}:`, actionError);
          }
        }

        // Update workflow's lastRunAt
        try {
          const workflowRef = doc(db, WORKFLOW_COLLECTION, workflowId);
          await updateDoc(workflowRef, {
            lastRunAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log(`✅ Workflow "${workflow.name}" executed successfully`);
        } catch (updateError: any) {
          if (updateError?.code === 'permission-denied') {
            console.warn('⚠️ Permission denied to update workflow. Backend scheduled function will handle it.');
          } else {
            throw updateError;
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking time-based automations:', error);
    // Don't throw - automation failures shouldn't break the scan
  }
};
