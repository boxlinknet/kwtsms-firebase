// Settings page - gateway, identity, phone number config
// Security: Admin-only. All Firestore data is admin-controlled.

import { renderHeader } from '../components/header';
import { loadSettings, saveSettings, loadSyncData } from '../firebase';
import { bindToggles } from '../components/toggle';
import type { Settings, SyncData } from '../types';

function warningBanner(): string {
  return `<div class="warning-banner" id="test-warning">
    <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <div><strong>Test mode is active.</strong> SMS messages are sent to the API but not delivered. No credits are permanently consumed.</div>
  </div>`;
}

function senderOptions(senderIds: string[], selected: string): string {
  return senderIds.map(id =>
    `<option value="${id}"${id === selected ? ' selected' : ''}>${id}</option>`
  ).join('');
}

function coverageOptions(coverage: Array<{prefix:string;country:string}>, selected: string): string {
  return coverage.map(c =>
    `<option value="${c.prefix}"${c.prefix === selected ? ' selected' : ''}>+${c.prefix} ${c.country}</option>`
  ).join('');
}

function renderContent(settings: Settings, sync: SyncData | null): string {
  const senders = sync?.sender_ids || [settings.selected_sender_id];
  const coverage = sync?.coverage || [{ prefix: settings.default_country_code, country: 'Default' }];

  return `
    ${settings.test_mode ? warningBanner() : ''}
    <div class="card">
      <div class="card-header"><div><h3>Gateway</h3><p>Core SMS gateway controls</p></div></div>
      <div class="card-body">
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Gateway Enabled</div>
            <div class="setting-desc">Master on/off switch. When disabled, all SMS sending stops.</div></div>
          <div class="setting-control"><div class="toggle ${settings.gateway_enabled ? 'on' : ''}" data-key="gateway_enabled" data-variant="on"></div></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Test Mode</div>
            <div class="setting-desc">Send with test=1. Messages hit kwtSMS API but are not delivered.</div></div>
          <div class="setting-control"><div class="toggle ${settings.test_mode ? 'warn' : ''}" data-key="test_mode" data-variant="warn"></div></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Debug Logging</div>
            <div class="setting-desc">Enable verbose Cloud Functions logger output.</div></div>
          <div class="setting-control"><div class="toggle ${settings.debug_logging ? 'on' : ''}" data-key="debug_logging" data-variant="on"></div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div><h3>Identity</h3><p>Sender ID and app name</p></div></div>
      <div class="card-body">
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Sender ID</div>
            <div class="setting-desc">The name that appears as the SMS sender.</div></div>
          <div class="setting-control"><div class="select-wrap"><select id="sender-select">${senderOptions(senders, settings.selected_sender_id)}</select></div></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Application Name</div>
            <div class="setting-desc">Used in SMS templates as {{app_name}}.</div></div>
          <div class="setting-control"><input class="input" type="text" id="app-name-input" value="${settings.app_name}" /></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div><h3>Phone Numbers</h3><p>Country code and number handling</p></div></div>
      <div class="card-body">
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Default Country Code</div>
            <div class="setting-desc">Prepended to numbers without a country code.</div></div>
          <div class="setting-control"><div class="select-wrap"><select id="country-select">${coverageOptions(coverage, settings.default_country_code)}</select></div></div>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
      <button class="btn btn-ghost" id="discard-btn">Discard</button>
      <button class="btn btn-primary" id="save-btn">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
        Save Changes
      </button>
    </div>`;
}

export async function renderSettings(container: HTMLElement): Promise<void> {
  const saveBtnHtml = `<button class="btn btn-primary" id="header-save-btn">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
    Save Changes
  </button>`;
  container.innerHTML = renderHeader('Settings', saveBtnHtml) + '<div class="content" style="max-width:720px;"><p style="color:var(--text-muted);">Loading...</p></div>';

  let settings = await loadSettings();
  const sync = await loadSyncData();
  const contentEl = container.querySelector('.content')!;

  function render(): void {
    contentEl.innerHTML = renderContent(settings, sync);
    bindToggles(contentEl as HTMLElement);
    bindActions();
  }

  function collectSettings(): Settings {
    const gateway = container.querySelector('[data-key="gateway_enabled"]')!;
    const testMode = container.querySelector('[data-key="test_mode"]')!;
    const debug = container.querySelector('[data-key="debug_logging"]')!;
    return {
      gateway_enabled: gateway.classList.contains('on'),
      test_mode: testMode.classList.contains('warn'),
      debug_logging: debug.classList.contains('on'),
      selected_sender_id: (container.querySelector('#sender-select') as HTMLSelectElement).value,
      app_name: (container.querySelector('#app-name-input') as HTMLInputElement).value,
      default_country_code: (container.querySelector('#country-select') as HTMLSelectElement).value,
    };
  }

  function bindActions(): void {
    container.querySelector('#save-btn')?.addEventListener('click', save);
    container.querySelector('#header-save-btn')?.addEventListener('click', save);
    container.querySelector('#discard-btn')?.addEventListener('click', async () => {
      settings = await loadSettings();
      render();
    });
  }

  async function save(): Promise<void> {
    settings = collectSettings();
    await saveSettings(settings);
    render(); // Re-render to update warning banner
  }

  render();
}
