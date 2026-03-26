/**
 * Scheduled Sync Handler
 *
 * Runs once daily. Syncs balance, sender IDs, and coverage from the
 * kwtSMS API and caches results in Firestore sms_config/sync.
 *
 * Each API call is independent: if one fails, the others still run.
 *
 * Related files:
 *   - kwtsms-client.ts: creates KwtSMS client
 *   - config.ts: getCredentials()
 *   - services/logger.ts: logging
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createClient } from '../kwtsms-client';
import { writeLog, info, error as logError, debug } from '../services/logger';

export const scheduledSync = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    await runSync();
  });

/** Run sync. Called by scheduled trigger and on-install lifecycle. */
export async function runSync(): Promise<void> {
  info('Starting scheduled sync');
  const startTime = Date.now();

  const db = admin.firestore();
  const syncRef = db.doc('sms_config/sync');
  const updates: Record<string, unknown> = {};
  const errors: string[] = [];

  let client;
  try {
    client = await createClient();
  } catch (err) {
    logError('Sync failed: cannot create client', { error: (err as Error).message });
    await writeLog({
      type: 'sync',
      trigger: 'scheduled',
      status: 'failed',
      test: false,
      error: (err as Error).message,
    });
    return;
  }

  // Sync balance
  try {
    const balance = await client.balance();
    if (balance !== null) {
      updates.balance = balance;
      await debug('Synced balance', { balance });
    }
  } catch (err) {
    errors.push(`balance: ${(err as Error).message}`);
  }

  // Sync sender IDs
  try {
    const response = await client.senderids();
    if (response.result === 'OK' && response.senderids) {
      updates.sender_ids = response.senderids;
      await debug('Synced sender IDs', { count: response.senderids.length });
    } else if (response.code) {
      errors.push(`senderids: ${response.code} ${response.description}`);
    }
  } catch (err) {
    errors.push(`senderids: ${(err as Error).message}`);
  }

  // Sync coverage
  try {
    const response = await client.coverage();
    if (response.result === 'OK' && (response as Record<string, unknown>).coverage) {
      updates.coverage = (response as Record<string, unknown>).coverage;
      await debug('Synced coverage', { count: ((response as Record<string, unknown>).coverage as unknown[]).length });
    } else if (response.code) {
      errors.push(`coverage: ${response.code} ${response.description}`);
    }
  } catch (err) {
    errors.push(`coverage: ${(err as Error).message}`);
  }

  // Save whatever succeeded
  if (Object.keys(updates).length > 0) {
    updates.last_synced_at = admin.firestore.FieldValue.serverTimestamp();
    await syncRef.set(updates, { merge: true });
  }

  const duration = Date.now() - startTime;
  const status = errors.length === 0 ? 'success' : 'partial';

  info('Sync complete', { status, duration_ms: duration, errors });

  await writeLog({
    type: 'sync',
    trigger: 'scheduled',
    status,
    test: false,
    error: errors.length > 0 ? errors.join('; ') : null,
    duration_ms: duration,
    metadata: updates,
  });
}
