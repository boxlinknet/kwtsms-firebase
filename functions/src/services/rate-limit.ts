/**
 * Rate Limit Service
 *
 * Simple Firestore-based rate limiter using a sliding window per key.
 * Each key (e.g., user UID) gets a document tracking the count and
 * window start time. Uses a transaction for atomicity.
 *
 * Related files:
 *   - handlers/callable.ts: rate limits per-user SMS sends
 *   - services/otp.ts: OTP cooldown (handled separately via OTP doc)
 */

import * as admin from 'firebase-admin';

const RATE_LIMIT_COLLECTION = 'sms_rate_limits';
const WINDOW_MS = 60_000; // 1 minute
const MAX_SENDS_PER_WINDOW = 10;

/**
 * Check and increment the rate limit counter for a key.
 * Returns true if the request should be rejected (rate limited).
 */
export async function checkSendRateLimit(key: string): Promise<boolean> {
  const db = admin.firestore();
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const now = Date.now();

    if (!doc.exists) {
      tx.set(ref, { count: 1, window_start: now });
      return false;
    }

    const data = doc.data()!;

    // Start a new window if the old one expired
    if (now - data.window_start > WINDOW_MS) {
      tx.set(ref, { count: 1, window_start: now });
      return false;
    }

    if (data.count >= MAX_SENDS_PER_WINDOW) {
      return true; // rate limited
    }

    tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
    return false;
  });
}
