/**
 * SMS Service
 *
 * The main SMS send pipeline. Reads config, prepends country code, delegates
 * to kwtsms-js for normalization/validation/cleaning/sending, and logs results.
 *
 * kwtsms-js handles: phone normalization, validation, message cleaning,
 * deduplication, batching (>200), ERR013 retry, and balance caching.
 *
 * This service adds: gateway_enabled check, test_mode passthrough, country
 * code prepend, coverage filtering, template resolution, and Firestore logging.
 *
 * Related files:
 *   - kwtsms-client.ts: creates KwtSMS instances
 *   - config.ts: provides settings and sync data
 *   - services/templates.ts: resolves message from templates
 *   - services/logger.ts: writes logs
 */

import * as admin from 'firebase-admin';
import { normalizePhone, findCountryCode } from 'kwtsms';
import type { SendResult, BulkSendResult } from 'kwtsms';
import { createClient } from '../kwtsms-client';
import { getSettings, getSyncData } from '../config';
import type { Settings, SyncData } from '../config';
import { resolveMessage } from './templates';
import { writeLog, debug, info, error as logError } from './logger';
import type { LogTrigger } from './logger';

export interface SendPipelineInput {
  to: string;
  message?: string;
  template?: string;
  templateData?: Record<string, string>;
  language?: string;
  sender?: string;
  settings?: Settings;
  syncData?: SyncData | null;
  trigger?: LogTrigger;
}

export interface SendPipelineResult {
  status: 'sent' | 'failed' | 'skipped';
  response?: SendResult | BulkSendResult | null;
  error?: string | null;
  message?: string;
}

/**
 * Prepend default country code if the normalized number does not start
 * with any known country prefix from the coverage list. Falls back to
 * findCountryCode from kwtsms-js if coverage is empty.
 */
export function prependCountryCode(
  normalized: string,
  defaultCode: string,
  coverage: Array<{ prefix: string; [key: string]: unknown }>
): string {
  if (coverage.length > 0) {
    const hasKnownPrefix = coverage.some((c) => normalized.startsWith(c.prefix));
    if (hasKnownPrefix) {
      return normalized;
    }
  } else {
    const found = findCountryCode(normalized);
    if (found && normalized.startsWith(found)) {
      // Only trust the result when the detected code matches the default code,
      // so local numbers that happen to begin with a foreign country code digit
      // sequence are still prepended with the correct default.
      if (found === defaultCode) {
        return normalized;
      }
    }
  }

  return defaultCode + normalized;
}

/**
 * Filter numbers whose country prefix is not in the account's coverage list.
 * Returns [valid, skipped] arrays.
 */
function filterByCoverage(
  numbers: string[],
  coverage: Array<{ prefix: string; [key: string]: unknown }>
): [string[], string[]] {
  if (coverage.length === 0) {
    return [numbers, []];
  }

  const valid: string[] = [];
  const skipped: string[] = [];

  for (const num of numbers) {
    const inCoverage = coverage.some((c) => num.startsWith(c.prefix));
    if (inCoverage) {
      valid.push(num);
    } else {
      skipped.push(num);
    }
  }

  return [valid, skipped];
}

/**
 * Run the full send pipeline: config check, message resolution, phone
 * normalization with country code prepend, coverage filter, and send.
 */
export async function buildSendPipeline(input: SendPipelineInput): Promise<SendPipelineResult> {
  const settings = input.settings || await getSettings();
  const syncData = input.syncData === undefined ? await getSyncData() : input.syncData;
  const trigger = input.trigger || 'callable';

  // 1. Check gateway enabled
  if (!settings.gateway_enabled) {
    return { status: 'skipped', error: 'Gateway is disabled' };
  }

  // 2. Resolve message text
  let messageText: string;
  try {
    messageText = await resolveMessage({
      message: input.message,
      template: input.template,
      templateData: input.templateData,
      language: input.language,
    });
  } catch (err) {
    return { status: 'failed', error: (err as Error).message };
  }

  // 3. Process phone numbers: split, normalize, prepend country code
  const rawNumbers = input.to.split(',').map((n) => n.trim()).filter(Boolean);
  const defaultCode = settings.default_country_code;
  const coverage = syncData?.coverage || [];

  const processedNumbers = rawNumbers.map((raw) => {
    const normalized = normalizePhone(raw);
    return prependCountryCode(normalized, defaultCode, coverage);
  });

  // 4. Filter by coverage
  const [validNumbers, skippedNumbers] = filterByCoverage(processedNumbers, coverage);

  if (skippedNumbers.length > 0) {
    await debug('Numbers skipped (no coverage)', { skipped: skippedNumbers });
  }

  if (validNumbers.length === 0) {
    return { status: 'failed', error: 'No valid numbers after filtering' };
  }

  // 5. Check cached balance
  if (syncData && syncData.balance <= 0) {
    return { status: 'failed', error: 'Zero balance' };
  }

  // 6. Send via kwtsms-js (handles dedup, cleaning, batching, retry)
  const startTime = Date.now();
  let result: SendPipelineResult;

  try {
    const client = await createClient(settings);
    const sender = input.sender || settings.selected_sender_id;
    const response = await client.send(validNumbers, messageText, sender);
    const duration = Date.now() - startTime;

    const isOk = response.result === 'OK' || response.result === 'PARTIAL';

    result = {
      status: isOk ? 'sent' : 'failed',
      response,
      error: isOk ? null : (response as SendResult).description || 'Send failed',
      message: messageText,
    };

    // Update cached balance from response
    const balanceAfter = (response as SendResult)['balance-after'];
    if (balanceAfter !== undefined && balanceAfter !== null) {
      const db = admin.firestore();
      await db.doc('sms_config/sync').set(
        { balance: balanceAfter },
        { merge: true }
      );
    }

    info('SMS sent', { status: result.status, duration_ms: duration });

    await writeLog({
      type: 'send',
      trigger,
      to: validNumbers.join(','),
      message_preview: messageText,
      template: input.template || null,
      status: result.status,
      test: settings.test_mode,
      sender_id: sender,
      response: response as unknown as Record<string, unknown>,
      error: result.error,
      duration_ms: duration,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    result = {
      status: 'failed',
      error: (err as Error).message,
      message: messageText,
    };

    logError('SMS send error', { error: (err as Error).message });

    await writeLog({
      type: 'send',
      trigger,
      to: validNumbers.join(','),
      message_preview: messageText,
      template: input.template || null,
      status: 'failed',
      test: settings.test_mode,
      sender_id: input.sender || settings.selected_sender_id,
      response: null,
      error: (err as Error).message,
      duration_ms: duration,
    });
  }

  return result;
}
