import type { Handler } from '@netlify/functions';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { differenceInCalendarDays, differenceInHours } from 'date-fns';

type WorkflowTriggerType = 'schedule' | 'scan_threshold' | 'inactivity' | 'expiry';
type WorkflowActionType = 'notify' | 'pause_qr' | 'update_destination';

interface WorkflowActionConfig {
  type: WorkflowActionType;
  payload?: Record<string, any>;
}

interface WorkflowTriggerConfig {
  frequency?: 'daily' | 'weekly' | 'monthly';
  runAtHour?: number;
  threshold?: number;
  inactivityDays?: number;
  expiryDate?: string;
}

interface WorkflowDocument {
  userId: string;
  name: string;
  qrId?: string;
  qrLabel?: string;
  triggerType: WorkflowTriggerType;
  triggerConfig?: WorkflowTriggerConfig;
  actions: WorkflowActionConfig[];
  status: 'active' | 'paused';
  lastRunAt?: FirebaseFirestore.Timestamp | null;
  lastTriggerValue?: number | null;
}

interface TriggerEvaluation {
  shouldRun: boolean;
  reason?: string;
  triggerValue?: number;
  triggerSnapshot?: Record<string, any>;
}

const REQUIRED_ENV = ['FIREBASE_SERVICE_ACCOUNT'];
const WORKFLOW_COLLECTION = 'qr_workflows';
const WORKFLOW_RUNS_COLLECTION = 'qr_workflow_runs';
const WORKFLOW_NOTIFICATIONS_COLLECTION = 'qr_workflow_notifications';
const QR_COLLECTION = 'pin_protected_qr_codes';
const ANALYTICS_COLLECTION = 'qr_analytics';

const initAdmin = () => {
  REQUIRED_ENV.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });

  if (getApps().length) {
    return getApp();
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT as string;
  const decoded =
    rawServiceAccount.trim().startsWith('{')
      ? rawServiceAccount
      : Buffer.from(rawServiceAccount, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(decoded);

  return initializeApp({
    credential: cert(serviceAccount),
  });
};

const app = initAdmin();
const firestore = getFirestore(app);

const hoursForFrequency = (frequency: 'daily' | 'weekly' | 'monthly' = 'daily') => {
  switch (frequency) {
    case 'weekly':
      return 24 * 7;
    case 'monthly':
      return 24 * 30;
    default:
      return 24;
  }
};

const evaluateScheduleTrigger = (workflow: WorkflowDocument, now: Date): TriggerEvaluation => {
  const runAtHour = workflow.triggerConfig?.runAtHour ?? 9;
  if (now.getUTCHours() !== runAtHour) {
    return { shouldRun: false, reason: 'Outside runAtHour window' };
  }

  if (!workflow.lastRunAt) {
    return { shouldRun: true, triggerSnapshot: { runAtHour } };
  }

  const diff = differenceInHours(now, workflow.lastRunAt.toDate());
  const requiredGap = hoursForFrequency(workflow.triggerConfig?.frequency);

  if (diff >= requiredGap) {
    return { shouldRun: true, triggerSnapshot: { diffHours: diff } };
  }

  return { shouldRun: false, reason: `Ran ${diff}h ago` };
};

const evaluateScanThresholdTrigger = async (
  workflow: WorkflowDocument
): Promise<TriggerEvaluation> => {
  if (!workflow.qrId) {
    return { shouldRun: false, reason: 'Missing qrId for threshold trigger' };
  }

  const threshold = workflow.triggerConfig?.threshold ?? 100;
  const analyticsSnap = await firestore.collection(ANALYTICS_COLLECTION).doc(workflow.qrId).get();
  const totalScans = analyticsSnap.exists ? analyticsSnap.data()?.totalScans ?? 0 : 0;

  if (totalScans < threshold) {
    return { shouldRun: false, reason: 'Threshold not met', triggerSnapshot: { totalScans } };
  }

  if (workflow.lastTriggerValue && workflow.lastTriggerValue === totalScans) {
    return { shouldRun: false, reason: 'Already handled for this scan total' };
  }

  return {
    shouldRun: true,
    triggerValue: totalScans,
    triggerSnapshot: { totalScans, threshold },
  };
};

const evaluateInactivityTrigger = async (
  workflow: WorkflowDocument,
  now: Date
): Promise<TriggerEvaluation> => {
  if (!workflow.qrId) {
    return { shouldRun: false, reason: 'Missing qrId for inactivity trigger' };
  }

  const inactivityDays = workflow.triggerConfig?.inactivityDays ?? 3;
  const analyticsSnap = await firestore.collection(ANALYTICS_COLLECTION).doc(workflow.qrId).get();

  if (!analyticsSnap.exists) {
    return { shouldRun: false, reason: 'No analytics yet' };
  }

  const lastScanTimestamp = analyticsSnap.data()?.lastScan as FirebaseFirestore.Timestamp | undefined;
  if (!lastScanTimestamp) {
    return { shouldRun: true, triggerSnapshot: { reason: 'Never scanned' } };
  }

  const diffDays = differenceInCalendarDays(now, lastScanTimestamp.toDate());

  if (diffDays >= inactivityDays) {
    return { shouldRun: true, triggerSnapshot: { diffDays, inactivityDays } };
  }

  return { shouldRun: false, reason: `Last scan ${diffDays} days ago` };
};

const evaluateExpiryTrigger = (workflow: WorkflowDocument, now: Date): TriggerEvaluation => {
  const expiryDate = workflow.triggerConfig?.expiryDate;
  if (!expiryDate) {
    return { shouldRun: false, reason: 'No expiry date configured' };
  }

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return { shouldRun: false, reason: 'Invalid expiry date' };
  }

  if (now >= expiry) {
    if (!workflow.lastRunAt || workflow.lastRunAt.toDate() < expiry) {
      return { shouldRun: true, triggerSnapshot: { expiryDate } };
    }
    return { shouldRun: false, reason: 'Expiry already handled' };
  }

  return { shouldRun: false, reason: 'Not expired yet' };
};

const evaluateTrigger = async (
  workflow: WorkflowDocument,
  now: Date
): Promise<TriggerEvaluation> => {
  switch (workflow.triggerType) {
    case 'schedule':
      return evaluateScheduleTrigger(workflow, now);
    case 'scan_threshold':
      return evaluateScanThresholdTrigger(workflow);
    case 'inactivity':
      return evaluateInactivityTrigger(workflow, now);
    case 'expiry':
      return evaluateExpiryTrigger(workflow, now);
    default:
      return { shouldRun: false, reason: 'Unknown trigger' };
  }
};

const runNotifyAction = async (workflowId: string, workflow: WorkflowDocument, action: WorkflowActionConfig) => {
  const webhook = action.payload?.webhookUrl || process.env.AUTOMATION_NOTIFY_WEBHOOK;
  const message =
    action.payload?.message ||
    `Automation "${workflow.name}" executed for ${workflow.qrLabel || workflow.qrId || 'your QR code'}.`;

  const notificationDoc = {
    workflowId,
    userId: workflow.userId,
    createdAt: Timestamp.now(),
    message,
    channel: webhook ? 'webhook' : 'inbox',
  };

  if (webhook) {
    const safeFetch = (globalThis as any).fetch as
      | ((input: any, init?: any) => Promise<any>)
      | undefined;
    if (safeFetch) {
      try {
        await safeFetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId,
            userId: workflow.userId,
            qrId: workflow.qrId,
            message,
            metadata: action.payload?.metadata,
          }),
        });
      } catch (error) {
        console.warn('Notify webhook failed', error);
      }
    }
  }

  await firestore.collection(WORKFLOW_NOTIFICATIONS_COLLECTION).add(notificationDoc);
  return { success: true, detail: message };
};

const runPauseAction = async (workflow: WorkflowDocument, action: WorkflowActionConfig) => {
  if (!workflow.qrId) {
    return { success: false, detail: 'No QR bound to workflow' };
  }

  const qrRef = firestore.collection(QR_COLLECTION).doc(workflow.qrId);
  await qrRef.set(
    {
      automationStatus: 'paused',
      automationPausedAt: Timestamp.now(),
      automationPausedBy: workflow.name,
      automationPausedReason: action.payload?.message || 'Paused by automation',
    },
    { merge: true }
  );

  return { success: true, detail: 'QR paused' };
};

const runUpdateDestinationAction = async (workflow: WorkflowDocument, action: WorkflowActionConfig) => {
  if (!workflow.qrId) {
    return { success: false, detail: 'No QR bound to workflow' };
  }

  const destination = action.payload?.destination || action.payload?.url;
  if (!destination) {
    return { success: false, detail: 'Missing destination payload' };
  }

  const qrRef = firestore.collection(QR_COLLECTION).doc(workflow.qrId);
  await qrRef.set(
    {
      automationOverrides: {
        destination,
        updatedAt: Timestamp.now(),
        workflowName: workflow.name,
      },
    },
    { merge: true }
  );

  return { success: true, detail: `Destination -> ${destination}` };
};

const executeActions = async (workflowId: string, workflow: WorkflowDocument) => {
  const results = [];

  for (const action of workflow.actions || []) {
    try {
      switch (action.type) {
        case 'notify':
          results.push({
            type: action.type,
            ...(await runNotifyAction(workflowId, workflow, action)),
          });
          break;
        case 'pause_qr':
          results.push({
            type: action.type,
            ...(await runPauseAction(workflow, action)),
          });
          break;
        case 'update_destination':
          results.push({
            type: action.type,
            ...(await runUpdateDestinationAction(workflow, action)),
          });
          break;
        default:
          results.push({ type: action.type, success: false, detail: 'Unsupported action' });
      }
    } catch (error) {
      console.error(`Action ${action.type} failed`, error);
      results.push({ type: action.type, success: false, detail: (error as Error).message });
    }
  }

  return results;
};

const persistRunLog = async ({
  workflowId,
  workflow,
  triggerResult,
  actionResults,
}: {
  workflowId: string;
  workflow: WorkflowDocument;
  triggerResult: TriggerEvaluation;
  actionResults: Array<Record<string, any>>;
}) => {
  await firestore.collection(WORKFLOW_RUNS_COLLECTION).add({
    workflowId,
    userId: workflow.userId,
    executedAt: Timestamp.now(),
    triggerType: workflow.triggerType,
    triggerSnapshot: triggerResult.triggerSnapshot,
    actions: actionResults,
  });

  await firestore.collection(WORKFLOW_COLLECTION).doc(workflowId).update({
    lastRunAt: Timestamp.now(),
    lastTriggerValue: triggerResult.triggerValue ?? FieldValue.delete(),
    updatedAt: Timestamp.now(),
  });
};

export const config = {
  schedule: '*/15 * * * *',
};

export const handler: Handler = async () => {
  try {
    const now = new Date();

    const activeWorkflowsSnap = await firestore
      .collection(WORKFLOW_COLLECTION)
      .where('status', '==', 'active')
      .get();

    if (activeWorkflowsSnap.empty) {
      return {
        statusCode: 200,
        body: JSON.stringify({ processed: 0, message: 'No active workflows' }),
      };
    }

    const results: Array<Record<string, any>> = [];

    for (const doc of activeWorkflowsSnap.docs) {
      const workflow = doc.data() as WorkflowDocument;
      const triggerResult = await evaluateTrigger(workflow, now);

      if (!triggerResult.shouldRun) {
        continue;
      }

      const actionResults = await executeActions(doc.id, workflow);
      await persistRunLog({ workflowId: doc.id, workflow, triggerResult, actionResults });
      results.push({ workflowId: doc.id, actionResults, trigger: workflow.triggerType });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: results.length,
        results,
      }),
    };
  } catch (error) {
    console.error('Automation runner failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message,
      }),
    };
  }
};


