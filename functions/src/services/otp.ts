/**
 * OTP Service
 *
 * Generates, stores, and verifies one-time passwords. OTP codes are stored
 * in Firestore with a 5-minute TTL. Max 3 verification attempts per code.
 * Successful verification deletes the document.
 *
 * Generic error messages prevent phone number enumeration.
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

export interface VerifyResult {
  success: boolean;
  error?: string;
}

/** Generate a cryptographically random 6-digit code. */
export function generateCode(): string {
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, '0');
}

/** Store OTP in Firestore. Overwrites any existing code for this phone. */
export async function storeOtp(phone: string, code: string): Promise<void> {
  const collections = getCollectionNames();
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  await db.collection(collections.otpCodes).doc(phone).set({
    code,
    attempts: 0,
    createdAt: now,
    expiresAt,
  });
}

/** Verify OTP code. Returns generic errors to prevent enumeration. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  const collections = getCollectionNames();
  const db = admin.firestore();
  const ref = db.collection(collections.otpCodes).doc(phone);
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

  // Check code
  if (data.code !== code) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    return { success: false, error: 'Invalid code' };
  }

  // Success: delete the OTP document
  await ref.delete();
  return { success: true };
}
