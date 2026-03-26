/**
 * Logger Service
 *
 * Dual logging: writes structured entries to Firestore sms_logs collection
 * (always on) and to Cloud Functions logger (debug level controlled by config).
 *
 * Phone numbers are masked in Firestore logs. Credentials are never logged.
 *
 * Related files:
 *   - config.ts: provides collection names and debug_logging setting
 *   - services/sms.ts: logs every send attempt
 *   - services/otp.ts: logs OTP operations
 *   - handlers/*: log trigger-level events
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { maskPhone } from 'kwtsms';
import { getCollectionNames, getSettings } from '../config';

export type LogType = 'send' | 'otp' | 'welcome' | 'sync' | 'install' | 'error';
export type LogTrigger = 'queue' | 'auth' | 'callable' | 'otp' | 'scheduled' | 'lifecycle';

export interface LogEntry {
  type: LogType;
  trigger: LogTrigger;
  to?: string;
  message_preview?: string;
  template?: string | null;
  status: string;
  test: boolean;
  sender_id?: string;
  response?: Record<string, unknown> | null;
  error?: string | null;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export async function writeLog(entry: LogEntry): Promise<void> {
  const collections = getCollectionNames();
  const db = admin.firestore();

  // Mask phone number for Firestore log
  const maskedEntry = {
    ...entry,
    to: entry.to ? maskPhone(entry.to) : undefined,
    message_preview: entry.message_preview ? entry.message_preview.substring(0, 50) : undefined,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Strip undefined fields
  const cleanEntry = Object.fromEntries(
    Object.entries(maskedEntry).filter(([, v]) => v !== undefined)
  );

  await db.collection(collections.smsLogs).add(cleanEntry);
}

export async function debug(message: string, data?: Record<string, unknown>): Promise<void> {
  const settings = await getSettings();
  if (settings.debug_logging) {
    functions.logger.debug(message, data);
  }
}

export function info(message: string, data?: Record<string, unknown>): void {
  functions.logger.info(message, data);
}

export function error(message: string, data?: Record<string, unknown>): void {
  functions.logger.error(message, data);
}
