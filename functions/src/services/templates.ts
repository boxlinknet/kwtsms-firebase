/**
 * Template Service
 *
 * Renders message templates by replacing {{placeholder}} tokens with data values.
 * Resolves templates from Firestore by name and language.
 *
 * Related files:
 *   - templates/defaults.ts: default template definitions
 *   - config.ts: provides collection names
 *   - services/sms.ts: calls resolveMessage() before sending
 */

import * as admin from 'firebase-admin';
import { getCollectionNames } from '../config';

/**
 * Replace {{placeholder}} tokens in a template body with values from data.
 * Missing placeholders are replaced with empty string.
 */
export function renderTemplate(body: string, data: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
}

/**
 * Resolve the final message text from either an inline message or a template reference.
 * Returns the rendered message string.
 */
export async function resolveMessage(params: {
  message?: string;
  template?: string;
  templateData?: Record<string, string>;
  language?: string;
}): Promise<string> {
  // Inline message takes priority
  if (params.message) {
    return params.message;
  }

  if (!params.template) {
    throw new Error('Either "message" or "template" must be provided.');
  }

  const collections = getCollectionNames();
  const db = admin.firestore();
  const lang = params.language || 'en';

  const doc = await db.collection(collections.smsTemplates).doc(params.template).get();
  if (!doc.exists) {
    throw new Error(`Template "${params.template}" not found.`);
  }

  const templateDoc = doc.data()!;
  const bodyField = `body_${lang}`;
  const body = templateDoc[bodyField] || templateDoc.body_en;

  if (!body) {
    throw new Error(`Template "${params.template}" has no body for language "${lang}".`);
  }

  return renderTemplate(body, params.templateData || {});
}
