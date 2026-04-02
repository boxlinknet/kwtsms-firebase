/**
 * Auth Handler
 *
 * Firebase Auth onCreate trigger. Sends a welcome SMS to new users
 * who have a phone number on their Auth record.
 *
 * Respects gateway_enabled and test_mode settings. Skips silently
 * if no phone number is present. Uses configurable app_name from settings.
 *
 * Related files:
 *   - services/sms.ts: buildSendPipeline()
 *   - config.ts: getSettings()
 *   - services/logger.ts: logging
 */

import * as functions from 'firebase-functions';
import { getSettings, getSyncData } from '../config';
import { buildSendPipeline } from '../services/sms';
import { debug, info, error as logError } from '../services/logger';

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  await debug('onUserCreate triggered', { uid: user.uid });

  if (!user.phoneNumber) {
    await debug('No phone number on auth record, skipping welcome SMS', { uid: user.uid });
    return;
  }

  try {
    const settings = await getSettings();
    const syncData = await getSyncData();

    // Strip the + prefix that Firebase Auth includes on phone numbers
    const phone = user.phoneNumber.replace(/^\+/, '');

    const result = await buildSendPipeline({
      to: phone,
      template: 'welcome',
      templateData: {
        app_name: settings.app_name,
      },
      language: 'en',
      settings,
      syncData,
      trigger: 'auth',
    });

    info('Welcome SMS result', { uid: user.uid, status: result.status });
  } catch (err) {
    logError('onUserCreate error', { uid: user.uid, error: (err as Error).message });
  }
});
