/**
 * OTP Handler
 *
 * HTTPS callable function for OTP generation and verification.
 * Two actions: sendOtp and verifyOtp.
 *
 * sendOtp: generates code, stores in Firestore, sends via kwtSMS.
 * verifyOtp: checks code, enforces max attempts and expiry.
 *
 * Uses generic error messages to prevent phone number enumeration.
 * Requires Firebase Auth (caller must be authenticated).
 *
 * Related files:
 *   - services/otp.ts: generateCode(), storeOtp(), verifyOtp()
 *   - services/sms.ts: buildSendPipeline()
 *   - services/logger.ts: logging
 */

import * as functions from 'firebase-functions';
import { normalizePhone } from 'kwtsms';
import { getSettings, getSyncData } from '../config';
import { generateCode, storeOtp, verifyOtp as verifyOtpCode } from '../services/otp';
import { buildSendPipeline } from '../services/sms';
import { writeLog, info, error as logError } from '../services/logger';

interface OtpRequest {
  action: 'sendOtp' | 'verifyOtp';
  phone: string;
  code?: string;
}

export const handleOtp = functions.https.onCall(async (data: OtpRequest, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  if (!data.phone) {
    throw new functions.https.HttpsError('invalid-argument', 'Field "phone" is required.');
  }

  if (!data.action || !['sendOtp', 'verifyOtp'].includes(data.action)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Field "action" must be "sendOtp" or "verifyOtp".'
    );
  }

  const phone = normalizePhone(data.phone);

  if (data.action === 'sendOtp') {
    return handleSendOtp(phone, context.auth.uid);
  }

  // data.action === 'verifyOtp' (guaranteed by validation above)
  if (!data.code) {
    throw new functions.https.HttpsError('invalid-argument', 'Field "code" is required.');
  }
  return handleVerifyOtp(phone, data.code, context.auth.uid);
});

async function handleSendOtp(phone: string, callerUid: string) {
  try {
    const settings = await getSettings();
    const syncData = await getSyncData();
    const code = generateCode();

    await storeOtp(phone, code);

    const result = await buildSendPipeline({
      to: phone,
      template: 'otp',
      templateData: {
        code,
        app_name: 'our app',
        expiry_minutes: '5',
      },
      language: 'en',
      settings,
      syncData,
      trigger: 'otp',
    });

    await writeLog({
      type: 'otp',
      trigger: 'otp',
      to: phone,
      status: result.status,
      test: settings.test_mode,
      sender_id: settings.selected_sender_id,
      error: result.error,
      metadata: { action: 'sendOtp', callerUid },
    });

    if (result.status === 'failed') {
      throw new functions.https.HttpsError('internal', 'Failed to send verification code');
    }

    info('OTP sent', { phone: phone.substring(0, 6) + '****' });

    return { success: true, expiresIn: 300 };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    logError('sendOtp error', { error: (err as Error).message });
    throw new functions.https.HttpsError('internal', 'Failed to send verification code');
  }
}

async function handleVerifyOtp(phone: string, code: string, callerUid: string) {
  try {
    const settings = await getSettings();
    const result = await verifyOtpCode(phone, code);

    await writeLog({
      type: 'otp',
      trigger: 'otp',
      to: phone,
      status: result.success ? 'verified' : 'failed',
      test: settings.test_mode,
      sender_id: settings.selected_sender_id,
      error: result.error || null,
      metadata: { action: 'verifyOtp', callerUid },
    });

    info('OTP verify', { success: result.success });

    // Return generic error to prevent phone enumeration
    if (!result.success) {
      return { success: false, error: 'Verification failed' };
    }
    return { success: true };
  } catch (err) {
    logError('verifyOtp error', { error: (err as Error).message });
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
}
