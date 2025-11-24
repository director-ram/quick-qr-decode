# Firestore Rules for Workflow Automations

The new `Workflow Automations` tab reads and writes from a Firestore collection named `qr_workflows`.  
If your current rules don't explicitly allow this collection, Firestore will throw
`FirebaseError: Missing or insufficient permissions` when you try to load or create automations.

## Required Rule Snippet
Add the following block to your Firestore Security Rules file (inside the main `match /databases/{database}/documents { ... }` scope):

```
match /qr_workflows/{workflowId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;

  allow create: if isSignedIn()
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.name is string
    && request.resource.data.triggerType in ['schedule', 'scan_threshold', 'inactivity', 'expiry'];

  allow update, delete: if isSignedIn() && resource.data.userId == request.auth.uid;
}
```

Where `isSignedIn()` is the helper you likely already have in your rules file:

```
function isSignedIn() {
  return request.auth != null;
}
```

## Steps
1. Open the Firebase Console → Firestore Database → Rules.
2. Insert the snippet above alongside the other collection rules.
3. Click **Publish** to deploy the rule changes.

After the update, authenticated users will be able to create, read, toggle, and delete only their own workflow automations; all other access remains blocked.

