/**
 * KwtSMS Client Wrapper
 *
 * Creates a KwtSMS instance using credentials from extension params and
 * runtime settings from Firestore. A new instance is created per invocation
 * to pick up settings changes (test_mode, sender_id).
 *
 * Related files:
 *   - config.ts: provides credentials and settings
 *   - services/sms.ts: uses this to send messages
 *   - handlers/scheduled.ts: uses this for sync calls
 */

import { KwtSMS } from 'kwtsms';
import { getCredentials, getSettings } from './config';
import type { Settings } from './config';

export async function createClient(settingsOverride?: Settings): Promise<KwtSMS> {
  const { username, password } = getCredentials();

  if (!username || !password) {
    throw new Error('kwtSMS credentials not configured. Reconfigure the extension with valid API credentials.');
  }

  const settings = settingsOverride || await getSettings();

  return new KwtSMS(username, password, {
    senderId: settings.selected_sender_id,
    testMode: settings.test_mode,
    logFile: '',  // disable file logging, we use Firestore logging
  });
}
