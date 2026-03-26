/**
 * kwtSMS Firebase Extension - Entry Point
 *
 * Exports all Cloud Functions for the extension. Firebase Extensions
 * reads this file to discover available functions.
 *
 * Functions:
 *   processQueue     - Firestore onCreate: sends SMS from queue documents
 *   onUserCreate     - Auth onCreate: sends welcome SMS to new users
 *   sendSms          - HTTPS callable: send SMS on demand
 *   handleOtp        - HTTPS callable: OTP generation and verification
 *   scheduledSync    - Scheduled: daily balance/senderID/coverage sync
 *   onInstallHandler - Lifecycle: seeds templates and runs first sync
 *
 * Related files:
 *   - extension.yaml: defines which functions are resources
 *   - handlers/*: individual handler implementations
 *   - lifecycle/*: lifecycle event handlers
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (once)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export all Cloud Functions
export { processQueue } from './handlers/queue';
export { onUserCreate } from './handlers/auth';
export { sendSms } from './handlers/callable';
export { handleOtp } from './handlers/otp';
export { scheduledSync } from './handlers/scheduled';
export { onInstallHandler } from './lifecycle/on-install';
