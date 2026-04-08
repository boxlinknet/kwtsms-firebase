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
  last_synced_at: { toDate(): Date } | null;
}

export interface LogEntry {
  id: string;
  type: 'send' | 'otp' | 'welcome' | 'sync' | 'install' | 'error';
  trigger: 'queue' | 'auth' | 'callable' | 'otp' | 'scheduled' | 'lifecycle';
  to?: string;
  message_preview?: string;
  template?: string | null;
  status: string;
  test: boolean;
  sender_id?: string;
  response?: Record<string, unknown> | null;
  error?: string | null;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  createdAt: { toDate(): Date } | null;
}

export interface Template {
  name: string;
  description: string;
  body_en: string;
  body_ar: string;
  body_default_en?: string;
  body_default_ar?: string;
  placeholders: string[];
  is_system: boolean;
  editable: boolean;
  deletable: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
  gateway_enabled: true,
  test_mode: true,
  debug_logging: false,
  default_country_code: '965',
  selected_sender_id: 'KWT-SMS',
  app_name: 'My App',
};
