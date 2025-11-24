import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  WorkflowAutomation,
  createWorkflowAutomation,
  deleteWorkflowAutomation,
  fetchUserWorkflows,
  updateWorkflowStatus,
} from '@/utils/workflowAutomations';
import { Loader2, PlayCircle, PauseCircle, Clock, Trash2, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const triggerLabels: Record<string, string> = {
  schedule: 'Scheduled',
  scan_threshold: 'Scan Threshold',
  inactivity: 'Inactivity',
  expiry: 'Expiry',
};

const actionLabels: Record<string, string> = {
  notify: 'Notify',
  pause_qr: 'Pause QR',
  update_destination: 'Update Destination',
};

const WorkflowAutomations: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    qrId: '',
    qrLabel: '',
    triggerType: 'schedule',
    frequency: 'daily',
    threshold: 100,
    actionType: 'notify',
    actionPayload: '',
  });

  const loadWorkflows = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await fetchUserWorkflows(currentUser.uid);
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to load workflows', error);
      toast({
        title: 'Unable to fetch automations',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const resetForm = () => {
    setFormData({
      name: '',
      qrId: '',
      qrLabel: '',
      triggerType: 'schedule',
      frequency: 'daily',
      threshold: 100,
      actionType: 'notify',
      actionPayload: '',
    });
  };

  const handleCreateWorkflow = async () => {
    if (!currentUser) return;
    if (!formData.name.trim()) {
      toast({
        title: 'Missing name',
        description: 'Please provide a workflow name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      await createWorkflowAutomation({
        userId: currentUser.uid,
        name: formData.name.trim(),
        qrId: formData.qrId.trim() || undefined,
        qrLabel: formData.qrLabel.trim() || undefined,
        triggerType: formData.triggerType as WorkflowAutomation['triggerType'],
        triggerConfig:
          formData.triggerType === 'schedule'
            ? {
                frequency: formData.frequency as 'daily' | 'weekly' | 'monthly',
                runAtHour: 9,
              }
            : {
                threshold: formData.threshold,
              },
        actions: [
          {
            type: formData.actionType as WorkflowAutomation['actions'][number]['type'],
            payload: formData.actionPayload ? { message: formData.actionPayload } : undefined,
          },
        ],
        status: 'active',
      });

      toast({
        title: 'Automation created',
        description: 'Workflow automation saved successfully.',
      });

      resetForm();
      setDialogOpen(false);
      loadWorkflows();
    } catch (error) {
      console.error('Failed to create workflow', error);
      toast({
        title: 'Creation failed',
        description: 'Unable to save automation. Please retry.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusToggle = async (workflow: WorkflowAutomation, value: boolean) => {
    try {
      await updateWorkflowStatus(workflow.id, value ? 'active' : 'paused');
      toast({
        title: value ? 'Automation enabled' : 'Automation paused',
        description: workflow.name,
      });
      setWorkflows((prev) =>
        prev.map((wf) => (wf.id === workflow.id ? { ...wf, status: value ? 'active' : 'paused' } : wf))
      );
    } catch (error) {
      console.error('Failed to update status', error);
      toast({
        title: 'Update failed',
        description: 'We could not update the automation status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (workflowId: string) => {
    try {
      await deleteWorkflowAutomation(workflowId);
      toast({
        title: 'Automation removed',
        description: 'Workflow deleted successfully.',
      });
      setWorkflows((prev) => prev.filter((wf) => wf.id !== workflowId));
    } catch (error) {
      console.error('Failed to delete workflow', error);
      toast({
        title: 'Delete failed',
        description: 'Unable to delete automation.',
        variant: 'destructive',
      });
    }
  };

  const triggerSummary = useMemo(
    () => (workflow: WorkflowAutomation) => {
      switch (workflow.triggerType) {
        case 'schedule':
          return `${workflow.triggerConfig.frequency || 'daily'} @ ${
            typeof workflow.triggerConfig.runAtHour === 'number' ? workflow.triggerConfig.runAtHour : '09'
          }:00`;
        case 'scan_threshold':
          return `After ${workflow.triggerConfig.threshold || 100} scans`;
        case 'inactivity':
          return `${workflow.triggerConfig.inactivityDays || 3} days inactive`;
        case 'expiry':
          return `On ${workflow.triggerConfig.expiryDate || 'set date'}`;
        default:
          return 'Custom trigger';
      }
    },
    []
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Workflow Automations
          </CardTitle>
          <CardDescription>Automate actions when QR activity meets certain conditions.</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadWorkflows} disabled={loading}>
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : setDialogOpen(false))}>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              Create Automation
            </Button>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create workflow automation</DialogTitle>
                <DialogDescription>
                  Choose a trigger and action. You can edit or pause automations at any time.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Workflow name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Daily scan summary"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qr-id">QR ID (optional)</Label>
                    <Input
                      id="qr-id"
                      placeholder="Associate with a QR"
                      value={formData.qrId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, qrId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qr-label">Label / Notes</Label>
                    <Input
                      id="qr-label"
                      placeholder="Campaign link, etc."
                      value={formData.qrLabel}
                      onChange={(e) => setFormData((prev) => ({ ...prev, qrLabel: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Select
                      value={formData.triggerType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, triggerType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="schedule">Scheduled</SelectItem>
                        <SelectItem value="scan_threshold">Scan threshold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.triggerType === 'schedule' ? (
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, frequency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Scan threshold</Label>
                      <Input
                        type="number"
                        min={10}
                        value={formData.threshold}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, threshold: Number(e.target.value) || 10 }))
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select
                      value={formData.actionType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, actionType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notify">Notify me</SelectItem>
                        <SelectItem value="pause_qr">Pause QR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Action notes / message</Label>
                    <Textarea
                      rows={3}
                      placeholder="Optional message or link"
                      value={formData.actionPayload}
                      onChange={(e) => setFormData((prev) => ({ ...prev, actionPayload: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={creating}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWorkflow} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Automation
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            Loading automations...
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Zap className="h-10 w-10 text-purple-300 mx-auto" />
            <p className="text-lg font-medium text-gray-900">No automations yet</p>
            <p className="text-sm text-gray-600">Create your first workflow to automate QR maintenance.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white border border-white/20 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between shadow-sm"
              >
                <div className="space-y-1 text-gray-900">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{workflow.name}</p>
                    <Badge variant="secondary">{triggerLabels[workflow.triggerType] || 'Custom'}</Badge>
                    <Badge variant="outline">{actionLabels[workflow.actions?.[0]?.type || 'notify']}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {workflow.qrLabel || workflow.qrId || 'Any QR'} • {triggerSummary(workflow)}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last updated{' '}
                    {workflow.updatedAt
                      ? formatDistanceToNow(workflow.updatedAt, { addSuffix: true })
                      : 'just now'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-green-400" />
                    <Switch
                      checked={workflow.status === 'active'}
                      onCheckedChange={(value) => handleStatusToggle(workflow, value)}
                    />
                    <PauseCircle className="h-4 w-4 text-yellow-400" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(workflow.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowAutomations;

