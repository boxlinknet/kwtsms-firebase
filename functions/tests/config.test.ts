import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';

// Initialize with emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8181';
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

import { getSettings, getSyncData, getCollectionNames, DEFAULTS } from '../src/config';

const db = admin.firestore();

describe('Config Service', () => {
  before(async () => {
    const settingsRef = db.doc('sms_config/settings');
    const syncRef = db.doc('sms_config/sync');
    await settingsRef.delete().catch(() => {});
    await syncRef.delete().catch(() => {});
  });

  it('returns default settings when no Firestore document exists', async () => {
    const settings = await getSettings();
    assert.strictEqual(settings.gateway_enabled, true);
    assert.strictEqual(settings.test_mode, true);
    assert.strictEqual(settings.debug_logging, false);
    assert.strictEqual(settings.default_country_code, '965');
    assert.strictEqual(settings.selected_sender_id, 'KWT-SMS');
  });

  it('reads settings from Firestore when document exists', async () => {
    await db.doc('sms_config/settings').set({
      gateway_enabled: false,
      test_mode: false,
      debug_logging: true,
      default_country_code: '966',
      selected_sender_id: 'MY-APP',
    });

    const settings = await getSettings();
    assert.strictEqual(settings.gateway_enabled, false);
    assert.strictEqual(settings.test_mode, false);
    assert.strictEqual(settings.debug_logging, true);
    assert.strictEqual(settings.default_country_code, '966');
    assert.strictEqual(settings.selected_sender_id, 'MY-APP');
  });

  it('returns null sync data when no document exists', async () => {
    const sync = await getSyncData();
    assert.strictEqual(sync, null);
  });

  it('reads sync data from Firestore', async () => {
    await db.doc('sms_config/sync').set({
      balance: 150,
      sender_ids: ['KWT-SMS', 'MY-APP'],
      coverage: [{ prefix: '965', country: 'Kuwait' }],
      last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const sync = await getSyncData();
    assert.ok(sync);
    assert.strictEqual(sync.balance, 150);
    assert.deepStrictEqual(sync.sender_ids, ['KWT-SMS', 'MY-APP']);
  });

  it('returns collection names from extension params with defaults', () => {
    const names = getCollectionNames();
    assert.strictEqual(names.smsQueue, 'sms_queue');
    assert.strictEqual(names.smsTemplates, 'sms_templates');
    assert.strictEqual(names.smsLogs, 'sms_logs');
    assert.strictEqual(names.otpCodes, 'otp_codes');
  });
});
