import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  WorkflowAutomation,
  createWorkflowAutomation,
  deleteWorkflowAutomation,
  fetchUserWorkflows,
  updateWorkflowStatus,
} from '@/utils/workflowAutomations';
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/utils/workflowTemplates';
import { Loader2, PlayCircle, PauseCircle, Clock, Trash2, Zap, AlertCircle, CheckCircle2, Sparkles, Info, HelpCircle } from 'lucide-react';
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

interface WorkflowAutomationsProps {
  prefillData?: { qrId: string; qrName: string; qrUrl?: string } | null;
  onPrefillUsed?: () => void;
  onClearGeneratorCache?: () => void;
}

const WorkflowAutomations: React.FC<WorkflowAutomationsProps> = ({ prefillData, onPrefillUsed, onClearGeneratorCache }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);
  const [showPrefillDialog, setShowPrefillDialog] = useState(false);
  const [prefillActionType, setPrefillActionType] = useState<'notify' | 'pause_qr'>('notify');
  const [prefillTriggerType, setPrefillTriggerType] = useState<'schedule' | 'scan_threshold'>('schedule');
  const [prefillThreshold, setPrefillThreshold] = useState(100);
  const [prefillFrequency, setPrefillFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [prefillQrUrl, setPrefillQrUrl] = useState<string | null>(null);

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
      setError(null);
      const data = await fetchUserWorkflows(currentUser.uid);
      setWorkflows(data);
    } catch (error: any) {
      console.error('Failed to load workflows', error);
      const errorMessage = error?.message || 'Unable to fetch automations. Please try again later.';
      setError(errorMessage);
      toast({
        title: 'Unable to fetch automations',
        description: errorMessage,
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

  // Handle prefill data
  useEffect(() => {
    if (prefillData) {
      setShowPrefillDialog(true);
      // Pre-fill form with QR data
      setFormData(prev => ({
        ...prev,
        name: `${prefillData.qrName} Automation`,
        qrId: prefillData.qrId,
        qrLabel: prefillData.qrName,
      }));
      // Store QR URL for download after creation
      if (prefillData.qrUrl) {
        setPrefillQrUrl(prefillData.qrUrl);
      }
    }
  }, [prefillData]);

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
    setSelectedTemplate(null);
    setUseTemplate(false);
  };

  const applyTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setUseTemplate(true);
    setFormData({
      name: template.preset.name,
      qrId: '',
      qrLabel: template.preset.qrLabel || '',
      triggerType: template.preset.triggerType,
      frequency: (template.preset.triggerConfig.frequency as 'daily' | 'weekly' | 'monthly') || 'daily',
      threshold: template.preset.triggerConfig.threshold || 100,
      actionType: template.preset.actions[0]?.type || 'notify',
      actionPayload: template.preset.actions[0]?.payload?.message || '',
    });
  };

  const handlePrefillCreate = async () => {
    if (!currentUser || !prefillData) return;

    try {
      setCreating(true);
      
      const workflowData = {
        userId: currentUser.uid,
        name: formData.name.trim() || `${prefillData.qrName} Automation`,
        qrId: prefillData.qrId,
        qrLabel: prefillData.qrName,
        triggerType: prefillTriggerType as WorkflowAutomation['triggerType'],
            triggerConfig:
          prefillTriggerType === 'schedule'
            ? {
                frequency: prefillFrequency,
                runAtHour: 9,
              }
            : {
                threshold: prefillThreshold,
              },
        actions: [
          {
            type: prefillActionType as WorkflowAutomation['actions'][number]['type'],
            ...(prefillActionType === 'notify'
              ? { payload: { message: `Automation for ${prefillData.qrName} executed.` } }
              : { payload: { message: `QR paused: ${prefillData.qrName}` } }),
          },
        ],
        status: 'active' as const,
      };

      await createWorkflowAutomation(workflowData);

      toast({
        title: 'Automation created',
        description: `"${workflowData.name}" automation created successfully!`,
      });

      // Auto-download QR code if URL is available
      if (prefillQrUrl) {
        try {
          const link = document.createElement('a');
          link.download = `qr-code-${prefillData.qrId}-${Date.now()}.png`;
          link.href = prefillQrUrl;
          link.click();
          toast({
            title: 'QR Code Downloaded',
            description: 'Your QR code has been downloaded automatically.',
          });
        } catch (error) {
          console.error('Failed to download QR:', error);
        }
      }

      setShowPrefillDialog(false);
      if (onPrefillUsed) onPrefillUsed();
      resetForm();
      setPrefillQrUrl(null);
      loadWorkflows();
      
      // Clear generator cache after successful automation creation and download
      if (onClearGeneratorCache) {
        onClearGeneratorCache();
      }
    } catch (error: any) {
      console.error('Failed to create workflow', error);
      const errorMessage = error?.message || 'Unable to save automation. Please check your input and try again.';
      toast({
        title: 'Creation failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
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
      
      // Use template preset if selected, otherwise use form data
      const workflowData = useTemplate && selectedTemplate
        ? {
            userId: currentUser.uid,
            name: formData.name.trim() || selectedTemplate.preset.name,
            qrId: formData.qrId.trim() || undefined,
            qrLabel: formData.qrLabel.trim() || selectedTemplate.preset.qrLabel || undefined,
            triggerType: selectedTemplate.preset.triggerType,
            triggerConfig: selectedTemplate.preset.triggerConfig,
            actions: selectedTemplate.preset.actions,
            status: 'active' as const,
          }
        : {
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
                : formData.triggerType === 'inactivity'
                ? {
                    inactivityDays: formData.threshold || 30,
                  }
                : {
                    threshold: formData.threshold,
                  },
            actions: [
              {
                type: formData.actionType as WorkflowAutomation['actions'][number]['type'],
                ...(formData.actionPayload
                  ? formData.actionType === 'update_destination'
                    ? { payload: { destination: formData.actionPayload } }
                    : { payload: { message: formData.actionPayload } }
                  : {}),
              },
            ],
            status: 'active' as const,
          };

      await createWorkflowAutomation(workflowData);

      toast({
        title: 'Automation created',
        description: useTemplate 
          ? `"${workflowData.name}" workflow created from template.`
          : 'Workflow automation saved successfully.',
      });

      resetForm();
      setDialogOpen(false);
      loadWorkflows();
    } catch (error: any) {
      console.error('Failed to create workflow', error);
      const errorMessage = error?.message || 'Unable to save automation. Please check your input and try again.';
      toast({
        title: 'Creation failed',
        description: errorMessage,
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
    <div className="space-y-4">
      {/* Prefill Automation Dialog */}
      <Dialog open={showPrefillDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPrefillDialog(false);
          if (onPrefillUsed) onPrefillUsed();
          resetForm();
          setPrefillQrUrl(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Quick Automation Setup
            </DialogTitle>
            <DialogDescription>
              Let's set up an automation for your PIN-protected QR code. Choose your preferences below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
            {/* QR Info */}
            <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                QR Code: {prefillData?.qrName}
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 font-mono">
                ID: {prefillData?.qrId}
              </p>
            </div>

            {/* Action Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">What should happen?</Label>
              <div className="grid grid-cols-2 gap-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    prefillActionType === 'notify'
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setPrefillActionType('notify')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Notify Me</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Get alerts</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-all ${
                    prefillActionType === 'pause_qr'
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setPrefillActionType('pause_qr')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <PauseCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Pause QR</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Auto-disable</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Trigger Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">When should it trigger?</Label>
              <div className="grid grid-cols-2 gap-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    prefillTriggerType === 'schedule'
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setPrefillTriggerType('schedule')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Scheduled</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Daily/Weekly</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-all ${
                    prefillTriggerType === 'scan_threshold'
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setPrefillTriggerType('scan_threshold')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Scan Threshold</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">After X scans</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Frequency Selector (only for schedule trigger) */}
            {prefillTriggerType === 'schedule' && (
              <div className="space-y-2">
                <Label htmlFor="prefill-frequency">Frequency</Label>
                <Select
                  value={prefillFrequency}
                  onValueChange={(value) => setPrefillFrequency(value as 'daily' | 'weekly' | 'monthly')}
                >
                  <SelectTrigger id="prefill-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  How often should this automation run?
                </p>
              </div>
            )}

            {/* Threshold Input (only for scan_threshold trigger) */}
            {prefillTriggerType === 'scan_threshold' && (
              <div className="space-y-2">
                <Label htmlFor="prefill-threshold">Scan Threshold</Label>
                <Input
                  id="prefill-threshold"
                  type="number"
                  min={1}
                  value={prefillThreshold}
                  onChange={(e) => setPrefillThreshold(Number(e.target.value) || 1)}
                  placeholder="e.g. 100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Trigger when total scans reach this number
                </p>
              </div>
            )}

            {/* Workflow Name */}
            <div className="space-y-2">
              <Label htmlFor="prefill-name">Automation Name</Label>
              <Input
                id="prefill-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Daily Scan Summary"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0 border-t pt-4 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowPrefillDialog(false);
                if (onPrefillUsed) onPrefillUsed();
                resetForm();
              }}
              disabled={creating}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePrefillCreate}
              disabled={creating || !formData.name.trim()}
              className="w-full sm:w-auto"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Create Automation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Automation Guide Alert */}
      <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">How Automation Works</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2 space-y-2">
          <p>
            <strong>Automations work on existing PIN-protected QR codes</strong>, not generate new ones.
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>First, generate a <strong>PIN-protected QR code</strong> in the Generate tab</li>
            <li>Then create an automation here that monitors that QR code</li>
            <li>When the trigger condition is met (schedule, scan threshold, etc.), the action runs automatically</li>
            <li>The backend runs every 15 minutes to check and execute automations</li>
          </ol>
          <p className="text-xs mt-3 pt-2 border-t border-blue-300 dark:border-blue-700">
            <strong>Note:</strong> Scheduled automations require the Netlify function to be deployed with Firebase service account credentials.
          </p>
        </AlertDescription>
      </Alert>

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
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) {
              resetForm();
              setDialogOpen(false);
            } else {
              setDialogOpen(true);
            }
          }}>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Automation
            </Button>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create workflow automation</DialogTitle>
                <DialogDescription>
                  Start with a template or create a custom automation. You can edit or pause automations at any time.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue={useTemplate ? "templates" : "custom"} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="templates" onClick={() => setUseTemplate(true)}>
                    Templates
                  </TabsTrigger>
                  <TabsTrigger value="custom" onClick={() => setUseTemplate(false)}>
                    Custom
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="templates" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                    {WORKFLOW_TEMPLATES.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate?.id === template.id
                            ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/20'
                            : ''
                        }`}
                        onClick={() => applyTemplate(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{template.icon}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {template.description}
                              </p>
                              <Badge variant="outline" className="mt-2 text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {selectedTemplate && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Template selected</AlertTitle>
                      <AlertDescription>
                        Using "{selectedTemplate.name}" template. You can customize the name and QR ID below.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Custom automation</AlertTitle>
                    <AlertDescription>
                      Configure your own trigger and action combination.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>

              <div className="space-y-4 pt-4">
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
                        <SelectItem value="scan_threshold">Scan Threshold</SelectItem>
                        <SelectItem value="inactivity">Inactivity</SelectItem>
                        <SelectItem value="expiry">Expiry Date</SelectItem>
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
                  ) : formData.triggerType === 'scan_threshold' ? (
                    <div className="space-y-2">
                      <Label>Scan threshold</Label>
                      <Input
                        type="number"
                        min={10}
                        value={formData.threshold}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, threshold: Number(e.target.value) || 10 }))
                        }
                        placeholder="e.g. 100"
                      />
                      <p className="text-xs text-gray-500">Trigger when total scans reach this number</p>
                    </div>
                  ) : formData.triggerType === 'inactivity' ? (
                    <div className="space-y-2">
                      <Label>Days of inactivity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.threshold}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, threshold: Number(e.target.value) || 1 }))
                        }
                        placeholder="e.g. 30"
                      />
                      <p className="text-xs text-gray-500">Trigger after this many days without scans</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Expiry date</Label>
                      <Input
                        type="datetime-local"
                        onChange={(e) => {
                          const date = e.target.value;
                          setFormData((prev) => ({ ...prev, threshold: date ? new Date(date).toISOString() : '' }));
                        }}
                      />
                      <p className="text-xs text-gray-500">Trigger on this date and time</p>
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
                        <SelectItem value="update_destination">Update Destination</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {formData.actionType === 'notify'
                        ? 'Notification message'
                        : formData.actionType === 'update_destination'
                        ? 'New destination URL'
                        : 'Action message / reason'}
                    </Label>
                    {formData.actionType === 'update_destination' ? (
                      <Input
                        type="url"
                        placeholder="https://example.com/new-destination"
                        value={formData.actionPayload}
                        onChange={(e) => setFormData((prev) => ({ ...prev, actionPayload: e.target.value }))}
                      />
                    ) : (
                      <Textarea
                        rows={3}
                        placeholder={
                          formData.actionType === 'notify'
                            ? 'Message to include in notification...'
                            : 'Optional message or reason...'
                        }
                        value={formData.actionPayload}
                        onChange={(e) => setFormData((prev) => ({ ...prev, actionPayload: e.target.value }))}
                      />
                    )}
                    <p className="text-xs text-gray-500">
                      {formData.actionType === 'update_destination'
                        ? 'The QR code will redirect to this URL when triggered'
                        : 'Optional: Add a custom message or note'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      resetForm();
                      setDialogOpen(false);
                    }} 
                    disabled={creating}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateWorkflow} 
                    disabled={creating || !formData.name.trim()}
                    className="w-full sm:w-auto"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Save Automation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-white/10 rounded-xl p-4"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full max-w-md" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading automations</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkflows}
                className="w-full sm:w-auto mt-2"
              >
                <Clock className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                No automations yet
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Create your first workflow to automate QR maintenance.
              </p>
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Create Your First Automation
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-white/10 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-base sm:text-lg">
                        {workflow.name}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {triggerLabels[workflow.triggerType] || 'Custom'}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                      >
                        {actionLabels[workflow.actions?.[0]?.type || 'notify']}
                      </Badge>
                      <Badge
                        variant={workflow.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {workflow.status === 'active' ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                      <span className="font-medium">
                        {workflow.qrLabel || workflow.qrId || 'Any QR'}
                      </span>
                      {' • '}
                      <span>{triggerSummary(workflow)}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {workflow.lastRunAt ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="font-medium">Executed {formatDistanceToNow(workflow.lastRunAt, { addSuffix: true })}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>Not executed yet</span>
                        </div>
                      )}
                      <span className="text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Updated {workflow.updatedAt
                          ? formatDistanceToNow(workflow.updatedAt, { addSuffix: true })
                          : 'just now'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-lg px-2 py-1">
                      <PlayCircle className="h-4 w-4 text-green-500 hidden sm:block" />
                      <Switch
                        checked={workflow.status === 'active'}
                        onCheckedChange={(value) => handleStatusToggle(workflow, value)}
                        disabled={loading}
                      />
                      <PauseCircle className="h-4 w-4 text-yellow-500 hidden sm:block" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(workflow.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete automation</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

export default WorkflowAutomations;

