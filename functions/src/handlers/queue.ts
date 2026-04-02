/**
 * Queue Handler
 *
 * Firestore onCreate trigger on the sms_queue collection. When a document
 * is created, it runs the SMS send pipeline and updates the document
 * with the result.
 *
 * Input document fields: to, message, template, templateData, language, sender
 * Output fields added: status, response, error, processedAt, createdAt
 *
 * Skips documents with source='callable' to prevent trigger loops.
 * Validates required fields before processing.
 * Idempotency guard: skips documents already in processing/sent state (retry safety).
 *
 * Related files:
 *   - services/sms.ts: buildSendPipeline()
 *   - config.ts: getSettings(), getSyncData()
 *   - services/logger.ts: debug logging
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getSettings, getSyncData } from '../config';
import { buildSendPipeline } from '../services/sms';
import { debug, error as logError } from '../services/logger';

const smsCollection = process.env.SMS_COLLECTION || 'sms_queue';

export const processQueue = functions.firestore
  .document(`${smsCollection}/{docId}`)
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docRef = snap.ref;

    await debug('processQueue triggered', { docId: context.params.docId });

    // Skip documents created by callable handler (audit trail only)
    if (data.source === 'callable') {
      await debug('Skipping callable audit document', { docId: context.params.docId });
      return;
    }

    // Idempotency guard: skip if already processed (retry safety)
    if (data.status === 'processing' || data.status === 'sent') {
      await debug('Skipping already processed document', { docId: context.params.docId, status: data.status });
      return;
    }

    // Validate required fields
    if (!data.to || typeof data.to !== 'string') {
      await docRef.update({
        status: 'failed',
        error: 'Missing or invalid required field: "to"',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    if (!data.message && !data.template) {
      await docRef.update({
        status: 'failed',
        error: 'Either "message" or "template" is required',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Mark as processing
    await docRef.update({
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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
        trigger: 'queue',
      });

      await docRef.update({
        status: result.status,
        response: result.response || null,
        error: result.error || null,
        test: settings.test_mode,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logError('processQueue error', { error: (err as Error).message });
      await docRef.update({
        status: 'failed',
        error: (err as Error).message,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
