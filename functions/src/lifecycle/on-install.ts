/**
 * Install Lifecycle Handler
 *
 * Runs on extension install and update. Seeds default templates,
 * creates the settings document with defaults, and runs the first sync.
 *
 * Templates that already exist are not overwritten (preserves user edits).
 * Settings that already exist are not overwritten (preserves user changes).
 *
 * Related files:
 *   - templates/defaults.ts: default template definitions
 *   - config.ts: DEFAULTS, getCollectionNames()
 *   - handlers/scheduled.ts: runSync()
 *   - services/logger.ts: logging
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DEFAULT_TEMPLATES } from '../templates/defaults';
import { DEFAULTS, getCollectionNames } from '../config';
import { runSync } from '../handlers/scheduled';
import { writeLog, info, error as logError } from '../services/logger';

export const onInstallHandler = functions.tasks.taskQueue().onDispatch(async () => {
  info('Running install/update lifecycle');
  const db = admin.firestore();
  const collections = getCollectionNames();

  // 1. Create settings document with defaults (if not exists)
  const settingsRef = db.doc('sms_config/settings');
  const settingsDoc = await settingsRef.get();

  if (!settingsDoc.exists) {
    await settingsRef.set({
      ...DEFAULTS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    info('Created default settings');
  }

  // 2. Seed default templates (skip existing)
  let seeded = 0;
  for (const template of DEFAULT_TEMPLATES) {
    const templateRef = db.collection(collections.smsTemplates).doc(template.name);
    const existing = await templateRef.get();

    if (!existing.exists) {
      await templateRef.set({
        name: template.name,
        description: template.description,
        body_en: template.body_en,
        body_ar: template.body_ar,
        body_default_en: template.body_en,
        body_default_ar: template.body_ar,
        placeholders: template.placeholders,
        is_system: true,
        editable: true,
        deletable: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      seeded++;
    }
  }
  info('Templates seeded', { seeded, total: DEFAULT_TEMPLATES.length });

  // 3. Run initial sync (balance, sender IDs, coverage)
  try {
    await runSync();
    info('Initial sync complete');
  } catch (err) {
    logError('Initial sync failed', { error: (err as Error).message });
  }

  await writeLog({
    type: 'install',
    trigger: 'lifecycle',
    status: 'success',
    test: false,
    metadata: { templates_seeded: seeded },
  });
});
