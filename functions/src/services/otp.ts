/**
 * OTP Service
 *
 * Generates, stores, and verifies one-time passwords. OTP codes are hashed
 * with SHA-256 before storage. Stored in Firestore with a 5-minute TTL.
 * Max 3 verification attempts per code. 60-second cooldown between sends.
 *
 * Phone numbers are hashed for document IDs to avoid exposing them in
 * Firestore paths. Verification uses timing-safe comparison to prevent
 * timing attacks. Generic error messages prevent phone number enumeration.
 *
 * Related files:
 *   - config.ts: provides OTP collection name
 *   - services/sms.ts: sends OTP via SMS
 *   - handlers/otp.ts: callable handler for sendOtp/verifyOtp
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getCollectionNames } from '../config';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_SECONDS = 60;

export interface VerifyResult {
  success: boolean;
  error?: string;
}

/** Hash a value with SHA-256. Used for codes and phone-based doc IDs. */
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Generate a cryptographically random 6-digit code. */
export function generateCode(): string {
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, '0');
}

/**
 * Check if an OTP was sent to this phone within the cooldown window.
 * Returns true if the caller should wait (rate limited).
 */
export async function checkCooldown(phone: string): Promise<boolean> {
  const collections = getCollectionNames();
  const db = admin.firestore();
  const docId = sha256(phone);
  const ref = db.collection(collections.otpCodes).doc(docId);
  const doc = await ref.get();

  if (!doc.exists) return false;

  const data = doc.data()!;
  if (!data.createdAt) return false;

  const now = admin.firestore.Timestamp.now();
  const elapsed = (now.toMillis() - data.createdAt.toMillis()) / 1000;
  return elapsed < OTP_COOLDOWN_SECONDS;
}

/** Store OTP in Firestore (hashed). Overwrites any existing code for this phone. */
export async function storeOtp(phone: string, code: string): Promise<void> {
  const collections = getCollectionNames();
  const db = admin.firestore();
  const docId = sha256(phone);
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  await db.collection(collections.otpCodes).doc(docId).set({
    code: sha256(code),
    attempts: 0,
    createdAt: now,
    expiresAt,
  });
}

/** Verify OTP code using timing-safe comparison. Returns generic errors to prevent enumeration. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  const collections = getCollectionNames();
  const db = admin.firestore();
  const docId = sha256(phone);
  const ref = db.collection(collections.otpCodes).doc(docId);
  const doc = await ref.get();

  if (!doc.exists) {
    return { success: false, error: 'Code expired or not found' };
  }

  const data = doc.data()!;

  // Check expiry
  const now = admin.firestore.Timestamp.now();
  if (data.expiresAt.toMillis() < now.toMillis()) {
    await ref.delete();
    return { success: false, error: 'Code expired or not found' };
  }

  // Check attempts
  if (data.attempts >= MAX_ATTEMPTS) {
    return { success: false, error: 'Too many attempts' };
  }

  // Timing-safe comparison of hashed codes
  const inputHash = sha256(code);
  const storedHash = data.code as string;
  const inputBuf = Buffer.from(inputHash, 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');

  if (inputBuf.length !== storedBuf.length || !crypto.timingSafeEqual(inputBuf, storedBuf)) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    return { success: false, error: 'Invalid code' };
  }

  // Success: delete the OTP document
  await ref.delete();
  return { success: true };
}
