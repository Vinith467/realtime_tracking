# Debugging & Fixing Cycle Tracker

## Problem
The Rider App's "On Duty" toggle does not persist in the "On" state. No user or tracking data appears in the Admin Dashboard.

## Hypotheses
1. **Firebase Permissions**: Firestore security rules might be blocking writes.
2. **Configuration Error**: `firebase.js` might have incorrect keys or initialization.
3. **Unhandled Promise Rejections**: The `toggleDuty` function might be failing silently or the error isn't successfully caught/logged in a visible way.

## Implementation Plan

### 1. Analyze & Debug
- [ ] Inspect browser console logs from a fresh run to identify specific error messages (e.g., "permission-denied", "api-key-expired").
- [ ] Review `src/firebase.js` for proper initialization and export of `db`.
- [ ] Review `src/pages/RiderHome.jsx` logic for potential race conditions or state issues.

### 2. Implementation Fixes
- [ ] **If Permission Error**: Update Firestore rules (if possible, or guide user).
- [ ] **If Config Error**: Correct `firebase.js`.
- [ ] **Code Improvements**:
    - Add more robust error logging in `RiderHome.jsx`.
    - Ensure `setIsOnline(true)` is only called *after* successful critical operations or handling failures gracefully.

### 3. Verification
- [x] Run a browser test to user "On Duty".
- [x] **ROOT CAUSE FOUND**: Cloud Firestore API is disabled.
- [ ] User must enable the API in Google Cloud Console.

## Resolution
The issue is not in the code but in the project configuration. The Firestore API must be enabled.
Error: `PERMISSION_DENIED: Cloud Firestore API has not been used in project real-time-tracker-26064 before or it is disabled.`
Action: Enable at https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=real-time-tracker-26064

