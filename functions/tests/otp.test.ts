import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8181';
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

import { generateCode, storeOtp, verifyOtp, checkCooldown } from '../src/services/otp';

const db = admin.firestore();

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('OTP Service', () => {
  before(async () => {
    const snap = await db.collection('otp_codes').get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  });

  describe('generateCode', () => {
    it('generates a 6-digit string', () => {
      const code = generateCode();
      assert.strictEqual(code.length, 6);
      assert.ok(/^\d{6}$/.test(code));
    });

    it('generates different codes on successive calls', () => {
      const codes = new Set(Array.from({ length: 10 }, () => generateCode()));
      assert.ok(codes.size > 1);
    });
  });

  describe('storeOtp', () => {
    it('stores hashed OTP code in Firestore with expiry', async () => {
      const code = '123456';
      await storeOtp('96598765432', code);

      const docId = sha256('96598765432');
      const doc = await db.collection('otp_codes').doc(docId).get();
      assert.ok(doc.exists);
      assert.strictEqual(doc.data()!.code, sha256(code));
      assert.strictEqual(doc.data()!.attempts, 0);
      assert.ok(doc.data()!.expiresAt);
    });

    it('overwrites previous OTP for same phone', async () => {
      await storeOtp('96598765432', '111111');
      await storeOtp('96598765432', '222222');

      const docId = sha256('96598765432');
      const doc = await db.collection('otp_codes').doc(docId).get();
      assert.strictEqual(doc.data()!.code, sha256('222222'));
      assert.strictEqual(doc.data()!.attempts, 0);
    });
  });

  describe('checkCooldown', () => {
    it('returns true when OTP was recently sent', async () => {
      await storeOtp('96511111111', '123456');
      const onCooldown = await checkCooldown('96511111111');
      assert.strictEqual(onCooldown, true);
    });

    it('returns false for unknown phone', async () => {
      const onCooldown = await checkCooldown('96500000001');
      assert.strictEqual(onCooldown, false);
    });
  });

  describe('verifyOtp', () => {
    it('returns success for correct code', async () => {
      await storeOtp('96512345678', '654321');
      const result = await verifyOtp('96512345678', '654321');
      assert.strictEqual(result.success, true);
    });

    it('deletes OTP document after successful verification', async () => {
      const docId = sha256('96512345678');
      const doc = await db.collection('otp_codes').doc(docId).get();
      assert.ok(!doc.exists);
    });

    it('returns error for wrong code', async () => {
      await storeOtp('96512345678', '654321');
      const result = await verifyOtp('96512345678', '999999');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Invalid code');
    });

    it('increments attempts on wrong code', async () => {
      const docId = sha256('96512345678');
      const doc = await db.collection('otp_codes').doc(docId).get();
      assert.strictEqual(doc.data()!.attempts, 1);
    });

    it('blocks after 3 failed attempts', async () => {
      await storeOtp('96500000000', '123456');
      await verifyOtp('96500000000', '000001');
      await verifyOtp('96500000000', '000002');
      await verifyOtp('96500000000', '000003');
      const result = await verifyOtp('96500000000', '123456');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Too many attempts');
    });

    it('returns error for non-existent phone', async () => {
      const result = await verifyOtp('96599999999', '123456');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Code expired or not found');
    });
  });
});
