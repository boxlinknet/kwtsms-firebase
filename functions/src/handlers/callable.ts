/**
 * Callable Handler
 *
 * HTTPS callable function for on-demand SMS sending from client apps.
 * Logs the send to sms_logs via the pipeline (no separate queue write).
 *
 * Requires Firebase Auth (caller must be authenticated).
 * Rate limited to 10 sends per minute per user.
 *
 * Related files:
 *   - services/sms.ts: buildSendPipeline()
 *   - services/rate-limit.ts: per-user send throttle
 *   - config.ts: getSettings(), getSyncData()
 *   - services/logger.ts: logging
 */

import * as functions from 'firebase-functions';
import { getSettings, getSyncData } from '../config';
import { buildSendPipeline } from '../services/sms';
import { checkSendRateLimit } from '../services/rate-limit';
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

  // Rate limit: 10 sends per minute per user
  const rateLimited = await checkSendRateLimit(context.auth.uid);
  if (rateLimited) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many requests. Please wait before sending again.'
    );
  }

  try {
    const settings = await getSettings();
    const syncData = await getSyncData();

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
      metadata: { callerUid: context.auth.uid },
    });

    if (result.status === 'failed') {
      throw new functions.https.HttpsError('internal', 'Failed to send SMS');
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
