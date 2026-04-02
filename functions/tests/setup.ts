/**
 * Test Setup
 *
 * Initializes Firebase Admin with emulator and sets up kwtSMS
 * credentials from environment variables. All tests use test=1
 * (no SMS delivery, no credits consumed permanently).
 *
 * Required env vars: KWTSMS_USERNAME, KWTSMS_PASSWORD
 * Required: Firebase Emulator running (firestore on port 8080)
 */

import * as admin from 'firebase-admin';
import { clearConfigCache } from '../src/config';

// Connect to Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8181';

// Set extension params as env vars for testing
process.env.SMS_COLLECTION = process.env.SMS_COLLECTION || 'sms_queue';
process.env.SMS_TEMPLATES_COLLECTION = process.env.SMS_TEMPLATES_COLLECTION || 'sms_templates';
process.env.SMS_LOGS_COLLECTION = process.env.SMS_LOGS_COLLECTION || 'sms_logs';
process.env.OTP_COLLECTION = process.env.OTP_COLLECTION || 'otp_codes';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

export const db = admin.firestore();

/** Seed settings with test mode on. */
export async function seedSettings(): Promise<void> {
  await db.doc('sms_config/settings').set({
    gateway_enabled: true,
    test_mode: true,
    debug_logging: true,
    default_country_code: '965',
    selected_sender_id: 'KWT-SMS',
    app_name: 'Test App',
  });
}

/** Seed a minimal sync document. */
export async function seedSync(): Promise<void> {
  await db.doc('sms_config/sync').set({
    balance: 100,
    sender_ids: ['KWT-SMS'],
    coverage: [
      { prefix: '965', country: 'Kuwait' },
      { prefix: '966', country: 'Saudi Arabia' },
      { prefix: '971', country: 'UAE' },
    ],
    last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Clean all test data from emulator and reset config cache. */
export async function cleanUp(): Promise<void> {
  clearConfigCache();
  const collections = ['sms_queue', 'sms_templates', 'sms_logs', 'otp_codes', 'sms_rate_limits'];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await db.doc('sms_config/settings').delete().catch(() => {});
  await db.doc('sms_config/sync').delete().catch(() => {});
}
