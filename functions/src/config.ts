/**
 * Config Service
 *
 * Reads extension params (env vars set by Firebase Extensions) and runtime
 * settings from Firestore. Extension params require reconfiguration to change.
 * Firestore settings can be changed at any time.
 *
 * Settings and sync data are cached with a short TTL to avoid redundant
 * Firestore reads within a single function invocation.
 *
 * Related files:
 *   - kwtsms-client.ts: uses config to create KwtSMS instances
 *   - handlers/*: all handlers read config before processing
 */

import * as admin from 'firebase-admin';

// --- Types ---

export interface Settings {
  gateway_enabled: boolean;
  test_mode: boolean;
  debug_logging: boolean;
  default_country_code: string;
  selected_sender_id: string;
  app_name: string;
}

export interface SyncData {
  balance: number;
  sender_ids: string[];
  coverage: Array<{ prefix: string; country: string }>;
  last_synced_at: admin.firestore.Timestamp | null;
}

export interface CollectionNames {
  smsQueue: string;
  smsTemplates: string;
  smsLogs: string;
  otpCodes: string;
}

// --- Defaults ---

export const DEFAULTS: Settings = {
  gateway_enabled: true,
  test_mode: true,
  debug_logging: false,
  default_country_code: '965',
  selected_sender_id: 'KWT-SMS',
  app_name: process.env.APP_NAME || 'My App',
};

// --- In-memory cache (short TTL to cover a single invocation) ---

const CACHE_TTL_MS = 5000;

let settingsCache: { value: Settings; expires: number } | null = null;
let syncDataCache: { value: SyncData | null; expires: number } | null = null;

/** Clear in-memory caches. Used in tests. */
export function clearConfigCache(): void {
  settingsCache = null;
  syncDataCache = null;
}

// --- Extension Params (from env) ---

export function getCredentials(): { username: string; password: string } {
  return {
    username: process.env.KWTSMS_USERNAME || '',
    password: process.env.KWTSMS_PASSWORD || '',
  };
}

export function getCollectionNames(): CollectionNames {
  return {
    smsQueue: process.env.SMS_COLLECTION || 'sms_queue',
    smsTemplates: process.env.SMS_TEMPLATES_COLLECTION || 'sms_templates',
    smsLogs: process.env.SMS_LOGS_COLLECTION || 'sms_logs',
    otpCodes: process.env.OTP_COLLECTION || 'otp_codes',
  };
}

// --- Firestore Runtime Settings ---

export async function getSettings(): Promise<Settings> {
  if (settingsCache && Date.now() < settingsCache.expires) {
    return settingsCache.value;
  }

  const db = admin.firestore();
  const doc = await db.doc('sms_config/settings').get();

  let settings: Settings;
  if (!doc.exists) {
    settings = { ...DEFAULTS };
  } else {
    const data = doc.data()!;
    settings = {
      gateway_enabled: data.gateway_enabled ?? DEFAULTS.gateway_enabled,
      test_mode: data.test_mode ?? DEFAULTS.test_mode,
      debug_logging: data.debug_logging ?? DEFAULTS.debug_logging,
      default_country_code: data.default_country_code ?? DEFAULTS.default_country_code,
      selected_sender_id: data.selected_sender_id ?? DEFAULTS.selected_sender_id,
      app_name: data.app_name ?? DEFAULTS.app_name,
    };
  }

  settingsCache = { value: settings, expires: Date.now() + CACHE_TTL_MS };
  return settings;
}

export async function getSyncData(): Promise<SyncData | null> {
  if (syncDataCache && Date.now() < syncDataCache.expires) {
    return syncDataCache.value;
  }

  const db = admin.firestore();
  const doc = await db.doc('sms_config/sync').get();

  let syncData: SyncData | null;
  if (!doc.exists) {
    syncData = null;
  } else {
    const data = doc.data()!;
    syncData = {
      balance: data.balance ?? 0,
      sender_ids: data.sender_ids ?? [],
      coverage: data.coverage ?? [],
      last_synced_at: data.last_synced_at ?? null,
    };
  }

  syncDataCache = { value: syncData, expires: Date.now() + CACHE_TTL_MS };
  return syncData;
}
