# Workflow Automations – Feature Blueprint

## 1. Goals
- Help QR owners keep campaigns fresh without manual effort.
- Provide proactive safeguards (auto-expiry, alerts, rotation) for high-volume QR deployments.
- Keep the solution no-code friendly while leaving room for API-based power users.

## 2. Core Concepts
| Term | Description |
| --- | --- |
| **Trigger** | Event that starts the automation (time-based, scan threshold, inactivity, expiry). |
| **Condition** | Optional filter applied after trigger fires (environment, QR tag, owner plan). |
| **Action** | Operation executed when trigger + condition pass (notify, update QR metadata, rotate destination, pause/activate). |
| **Workflow** | Bundle of trigger + condition + action(s) stored per user/QR. |

## 3. MVP Scope
### Supported Triggers
- **Scheduled**: daily/weekly/monthly at a user-selected time.
- **Scan Threshold**: total scans crosses X or increases by Y within 24h.
- **Inactivity**: no scans for N days.
- **Expiry Date**: exact timestamp.

### Supported Actions
- **Email/Push Notification** (initial: email via existing auth provider email or stored notification email).
- **Update Destination URL** (swap to fallback link or archive page).
- **Pause QR** (set a `isActive=false` flag consumed by scanner redirect logic).
- **Duplicate QR to Template** (optional stretch; allows archiving successful flows).

### Constraints
- Limit 5 workflows / free user, 20+ for premium (future monetisation hook).
- One active workflow per QR per trigger type to avoid conflicts.

## 4. Architecture
1. **Data Model (Firestore)**
   ```ts
   collection('qr_workflows'): {
     id,
     userId,
     qrId,
     trigger: {
       type: 'schedule' | 'scan_threshold' | 'inactivity' | 'expiry',
       config: {...}
     },
     conditions: {
       dayOfWeek?: number[],
       minPlan?: 'free'|'pro',
       tags?: string[]
     },
     actions: [
       { type: 'notify', channel: 'email', templateId?: string },
       { type: 'update_destination', destination: string },
       { type: 'pause_qr', reason?: string }
     ],
     status: 'active' | 'paused',
     lastRunAt,
     createdAt,
     updatedAt
   }
   ```
2. **Scheduler**
   - Cloud Function (cron) running every 5 minutes.
   - Fetch workflows whose trigger window matches current slice.
   - For scan-based triggers, read from aggregated analytics collection (`qr_analytics`) to avoid per-event processing.
   - Run actions transactionally; log results to `qr_workflow_runs`.

3. **Runtime Hooks**
   - QR serving endpoint checks `isActive` and `destinationOverride` fields.
   - Analytics updater increments counters used by automation triggers.

## 5. UI Additions
- **Automations Tab** (new tab next to Analytics) with:
  - List of existing workflows (name, trigger summary, status toggle, last run).
  - CTA: “Create Automation”.
- **Workflow Builder Drawer**
  1. Select scope: specific QR or any QR with tag.
  2. Choose trigger (with contextual inputs).
  3. Optional conditions.
  4. Choose actions (multi-select).
  5. Confirmation summary + enable switch.
- **Detail Drawer**
  - Execution history (last 10 runs).
  - Edit/delete actions.

### Mobile Considerations
- Use vertical stepper UI, stack cards, collapse advanced options behind accordions.

## 6. Validation & Safety
- Dry-run button to simulate next run and show expected actions.
- Guardrails preventing recursive workflows (e.g., action cannot create another workflow).
- Audit log entry each time an automation mutates QR data.

## 7. Rollout Plan
1. **Backend foundation**: collections, scheduler skeleton, helper functions.
2. **UI scaffolding**: tab, list, builder without backend wiring (mock data).
3. **Integration**: connect builder to Firestore, wire scheduler to analytics.
4. **Testing**:
   - Unit: trigger evaluation helpers.
   - Integration: emulator tests for scheduler + Firestore writes.
   - Manual QA: create workflow, run cron locally, verify actions.
5. **Docs & Onboarding**: add guide + sample use cases in README/Docs tab.

## 8. Next Steps
- Confirm trigger/action priorities with stakeholders.
- Decide notification channel provider (EmailJS, Firebase Extensions, or custom).
- Estimate backend cost impact for cron + extra reads/writes.

