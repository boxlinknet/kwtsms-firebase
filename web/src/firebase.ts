import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import type { Settings, SyncData, LogEntry, Template } from './types';
import { SETTINGS_DEFAULTS } from './types';

// Firebase Hosting auto-provides config via /__/firebase/init.json
// For local dev, populate this or use the emulator
const firebaseConfig = {};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// --- Settings ---

export async function loadSettings(): Promise<Settings> {
  const snap = await getDoc(doc(db, 'sms_config', 'settings'));
  if (!snap.exists()) return { ...SETTINGS_DEFAULTS };
  const data = snap.data();
  return {
    gateway_enabled: data.gateway_enabled ?? SETTINGS_DEFAULTS.gateway_enabled,
    test_mode: data.test_mode ?? SETTINGS_DEFAULTS.test_mode,
    debug_logging: data.debug_logging ?? SETTINGS_DEFAULTS.debug_logging,
    default_country_code: data.default_country_code ?? SETTINGS_DEFAULTS.default_country_code,
    selected_sender_id: data.selected_sender_id ?? SETTINGS_DEFAULTS.selected_sender_id,
    app_name: data.app_name ?? SETTINGS_DEFAULTS.app_name,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setDoc(doc(db, 'sms_config', 'settings'), settings, { merge: true });
}

// --- Sync Data ---

export async function loadSyncData(): Promise<SyncData | null> {
  const snap = await getDoc(doc(db, 'sms_config', 'sync'));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    balance: data.balance ?? 0,
    sender_ids: data.sender_ids ?? [],
    coverage: data.coverage ?? [],
    last_synced_at: data.last_synced_at ?? null,
  };
}

// --- Templates ---

export async function loadTemplates(): Promise<Template[]> {
  const snap = await getDocs(collection(db, 'sms_templates'));
  return snap.docs.map(d => ({ name: d.id, ...d.data() } as Template));
}

export async function saveTemplate(name: string, data: Partial<Template>): Promise<void> {
  await setDoc(doc(db, 'sms_templates', name), data, { merge: true });
}

export async function deleteTemplate(name: string): Promise<void> {
  await deleteDoc(doc(db, 'sms_templates', name));
}

// --- Logs ---

export interface LogQuery {
  type?: string;
  trigger?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  pageSize: number;
}

export async function loadLogs(q: LogQuery): Promise<LogEntry[]> {
  const ref = query(collection(db, 'sms_logs'), orderBy('createdAt', 'desc'), limit(q.pageSize));
  const snap = await getDocs(ref);
  let entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry));

  // Client-side filtering (avoids compound index requirements)
  if (q.type && q.type !== 'all') entries = entries.filter(e => e.type === q.type);
  if (q.trigger && q.trigger !== 'all') entries = entries.filter(e => e.trigger === q.trigger);
  if (q.status && q.status !== 'all') entries = entries.filter(e => e.status === q.status);
  if (q.fromDate) entries = entries.filter(e => e.createdAt && e.createdAt.toDate() >= q.fromDate!);
  if (q.toDate) entries = entries.filter(e => e.createdAt && e.createdAt.toDate() <= q.toDate!);

  return entries;
}

// --- Auth ---

export function onAuth(callback: (user: User | null) => void): void {
  onAuthStateChanged(auth, callback);
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}
