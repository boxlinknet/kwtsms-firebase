/**
 * Callable Handler
 *
 * HTTPS callable function for on-demand SMS sending from client apps.
 * Creates an audit trail document in sms_queue and logs to sms_logs.
 *
 * Requires Firebase Auth (caller must be authenticated).
 *
 * Related files:
 *   - services/sms.ts: buildSendPipeline()
 *   - config.ts: getSettings(), getSyncData(), getCollectionNames()
 *   - services/logger.ts: logging
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getSettings, getSyncData, getCollectionNames } from '../config';
import { buildSendPipeline } from '../services/sms';
import { info, error as logError } from '../services/logger';

interface SendSmsRequest {
  action: 'send';
  to: string;
  message?: string;
  template?: string;
  templateData?: Record<string, string>;
  language?: string;
  sender?: string;
}

export const sendSms = functions.https.onCall(async (data: SendSmsRequest, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  if (!data.to) {
    throw new functions.https.HttpsError('invalid-argument', 'Field "to" is required.');
  }

  if (!data.message && !data.template) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Either "message" or "template" is required.'
    );
  }

  try {
    const settings = await getSettings();
    const syncData = await getSyncData();
    const collections = getCollectionNames();

    const result = await buildSendPipeline({
      to: data.to,
      message: data.message,
      template: data.template,
      templateData: data.templateData,
      language: data.language,
      sender: data.sender,
      settings,
      syncData,
      trigger: 'callable',
    });

    // Write audit trail to sms_queue
    const db = admin.firestore();
    await db.collection(collections.smsQueue).add({
      to: data.to,
      message: result.message || data.message,
      template: data.template || null,
      templateData: data.templateData || null,
      language: data.language || 'en',
      sender: data.sender || settings.selected_sender_id,
      status: result.status,
      response: result.response || null,
      error: result.error || null,
      test: settings.test_mode,
      source: 'callable',
      callerUid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (result.status === 'failed') {
      throw new functions.https.HttpsError('internal', result.error || 'Send failed');
    }

    info('Callable sendSms', { status: result.status, callerUid: context.auth.uid });

    return {
      success: true,
      msgId: (result.response as Record<string, unknown>)?.['msg-id'] || null,
      balanceAfter: (result.response as Record<string, unknown>)?.['balance-after'] || null,
    };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    logError('Callable sendSms error', { error: (err as Error).message });
    throw new functions.https.HttpsError('internal', 'Failed to send SMS');
  }
});
