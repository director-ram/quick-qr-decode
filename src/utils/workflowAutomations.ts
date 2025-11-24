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
} from 'firebase/firestore';

const WORKFLOW_COLLECTION = 'qr_workflows';

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
      console.warn('Firestore index missing for qr_workflows orderBy(createdAt). Falling back without order.');
      return await runQuery(false);
    }
    throw error;
  }
};

const sanitize = (value: Record<string, any> = {}) => {
  const cleaned: Record<string, any> = {};
  Object.entries(value).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      cleaned[key] = val;
    }
  });
  return cleaned;
};

export const createWorkflowAutomation = async (payload: CreateWorkflowPayload) => {
  const data: Record<string, any> = {
    userId: payload.userId,
    name: payload.name,
    triggerType: payload.triggerType,
    triggerConfig: sanitize(payload.triggerConfig || {}),
    actions: payload.actions || [],
    status: payload.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastRunAt: null,
  };

  if (payload.qrId) {
    data.qrId = payload.qrId;
  }
  if (payload.qrLabel) {
    data.qrLabel = payload.qrLabel;
  }

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

