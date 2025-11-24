import type { WorkflowAutomation } from './workflowAutomations';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'monitoring' | 'maintenance' | 'alerts' | 'optimization';
  preset: {
    name: string;
    triggerType: WorkflowAutomation['triggerType'];
    triggerConfig: WorkflowAutomation['triggerConfig'];
    actions: WorkflowAutomation['actions'];
    qrLabel?: string;
  };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'daily-scan-summary',
    name: 'Daily Scan Summary',
    description: 'Get notified daily with your QR code scan statistics',
    icon: '📊',
    category: 'monitoring',
    preset: {
      name: 'Daily Scan Summary',
      triggerType: 'schedule',
      triggerConfig: {
        frequency: 'daily',
        runAtHour: 9,
      },
      actions: [
        {
          type: 'notify',
          payload: {
            message: 'Daily scan summary: Check your QR analytics dashboard for today\'s activity.',
          },
        },
      ],
    },
  },
  {
    id: 'high-traffic-alert',
    name: 'High Traffic Alert',
    description: 'Get notified when your QR code reaches a scan threshold',
    icon: '🚨',
    category: 'alerts',
    preset: {
      name: 'High Traffic Alert',
      triggerType: 'scan_threshold',
      triggerConfig: {
        threshold: 100,
      },
      actions: [
        {
          type: 'notify',
          payload: {
            message: 'Your QR code has reached 100 scans! Consider updating the destination or analyzing traffic patterns.',
          },
        },
      ],
    },
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Receive a weekly summary of QR code performance',
    icon: '📈',
    category: 'monitoring',
    preset: {
      name: 'Weekly Performance Report',
      triggerType: 'schedule',
      triggerConfig: {
        frequency: 'weekly',
        runAtHour: 9,
      },
      actions: [
        {
          type: 'notify',
          payload: {
            message: 'Weekly report: Review your QR code analytics for the past week.',
          },
        },
      ],
    },
  },
  {
    id: 'auto-pause-inactive',
    name: 'Auto-Pause Inactive QR',
    description: 'Automatically pause QR codes that haven\'t been scanned in a while',
    icon: '⏸️',
    category: 'maintenance',
    preset: {
      name: 'Auto-Pause Inactive QR',
      triggerType: 'inactivity',
      triggerConfig: {
        inactivityDays: 30,
      },
      actions: [
        {
          type: 'pause_qr',
          payload: {
            message: 'QR code paused due to inactivity (30 days without scans).',
          },
        },
        {
          type: 'notify',
          payload: {
            message: 'Your QR code has been paused due to 30 days of inactivity.',
          },
        },
      ],
    },
  },
  {
    id: 'campaign-rotation',
    name: 'Campaign Rotation',
    description: 'Update QR destination when scan threshold is reached',
    icon: '🔄',
    category: 'optimization',
    preset: {
      name: 'Campaign Rotation',
      triggerType: 'scan_threshold',
      triggerConfig: {
        threshold: 500,
      },
      actions: [
        {
          type: 'update_destination',
          payload: {
            destination: 'https://example.com/archive',
            message: 'Campaign completed. Redirecting to archive page.',
          },
        },
        {
          type: 'notify',
          payload: {
            message: 'Campaign rotation: QR destination updated after reaching 500 scans.',
          },
        },
      ],
    },
  },
  {
    id: 'monthly-review',
    name: 'Monthly Review',
    description: 'Monthly reminder to review and optimize your QR codes',
    icon: '📅',
    category: 'monitoring',
    preset: {
      name: 'Monthly Review Reminder',
      triggerType: 'schedule',
      triggerConfig: {
        frequency: 'monthly',
        runAtHour: 10,
      },
      actions: [
        {
          type: 'notify',
          payload: {
            message: 'Monthly review: Time to check your QR code performance and make optimizations.',
          },
        },
      ],
    },
  },
];

export const getTemplatesByCategory = (category?: WorkflowTemplate['category']) => {
  if (!category) return WORKFLOW_TEMPLATES;
  return WORKFLOW_TEMPLATES.filter((t) => t.category === category);
};

