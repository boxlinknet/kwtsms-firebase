// Dashboard page - stat cards, recent activity, quick settings
// Security: Admin-only dashboard. All data from admin-controlled Firestore.
// No untrusted user input rendered. innerHTML used for trusted template strings.

import { renderHeader } from '../components/header';
import { loadSettings, saveSettings, loadSyncData, loadLogs } from '../firebase';
import type { Settings, SyncData, LogEntry } from '../types';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadge(status: string): string {
  const cls = status === 'sent' || status === 'success' ? 'sent' :
    status === 'failed' ? 'failed' :
    status === 'verified' ? 'verified' :
    status === 'skipped' ? 'skipped' : 'test';
  return `<span class="status ${cls}"><span class="status-dot"></span> ${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    send: 'var(--primary)', otp: '#7C3AED', welcome: 'var(--success)',
    sync: 'var(--accent)', callable: 'var(--primary)',
  };
  return colors[type] || 'var(--text-muted)';
}

function renderStats(settings: Settings, sync: SyncData | null): string {
  const balance = sync ? sync.balance.toLocaleString() : '...';
  const syncedAgo = sync?.last_synced_at ? timeAgo(sync.last_synced_at.toDate()) : 'never';
  return `<div class="stats-row">
    <div class="stat-card balance">
      <div class="label">SMS Balance</div><div class="value">${balance}</div>
      <div class="sub">Synced ${syncedAgo}</div>
      <div class="icon"><svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="accent-bar"></div>
    </div>
    <div class="stat-card sent">
      <div class="label">Sent Today</div><div class="value" id="sent-count">...</div><div class="sub">&nbsp;</div>
      <div class="icon"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>
    </div>
    <div class="stat-card test">
      <div class="label">Test Mode</div>
      <div class="value" style="font-size:20px;">${settings.test_mode
        ? '<span class="status test"><span class="status-dot"></span> Active</span>'
        : '<span class="status on"><span class="status-dot"></span> Off</span>'}</div>
      <div class="sub">${settings.test_mode ? 'No SMS delivered' : 'Live mode'}</div>
      <div class="icon"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
    </div>
    <div class="stat-card gateway">
      <div class="label">Gateway</div>
      <div class="value" style="font-size:20px;">${settings.gateway_enabled
        ? '<span class="status on"><span class="status-dot"></span> Enabled</span>'
        : '<span class="status off"><span class="status-dot"></span> Disabled</span>'}</div>
      <div class="sub">${settings.gateway_enabled ? 'All triggers active' : 'All sending paused'}</div>
      <div class="icon"><svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg></div>
    </div>
  </div>`;
}

function renderRecentActivity(logs: LogEntry[]): string {
  if (logs.length === 0) return `<div class="card"><div class="card-header"><h3>Recent Activity</h3></div>
    <div style="padding:32px 20px;text-align:center;color:var(--text-muted);">No activity yet</div></div>`;
  const rows = logs.map(log => {
    const time = log.createdAt ? timeAgo(log.createdAt.toDate()) : '';
    return `<tr>
      <td><span style="color:${typeColor(log.type)};font-weight:600;">${log.type.charAt(0).toUpperCase() + log.type.slice(1)}</span></td>
      <td class="mono">${log.to || ''}</td>
      <td>${statusBadge(log.status)}</td>
      <td class="mono" style="color:var(--text-light);">${time}</td>
    </tr>`;
  }).join('');
  return `<div class="card"><div class="card-header"><h3>Recent Activity</h3><a class="btn btn-ghost btn-sm" href="#/logs">View All</a></div>
    <table><thead><tr><th>Type</th><th>To</th><th>Status</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderQuickSettings(settings: Settings, sync: SyncData | null): string {
  const sender = settings.selected_sender_id;
  const cc = sync?.coverage?.find(c => c.prefix === settings.default_country_code);
  const ccDisplay = cc ? `+${cc.prefix} ${cc.country}` : `+${settings.default_country_code}`;
  return `<div class="card"><div class="card-header"><h3>Quick Settings</h3><a class="btn btn-ghost btn-sm" href="#/settings">All Settings</a></div>
    <div style="padding:16px 20px;">
      <div class="setting-row"><div class="setting-info"><div class="setting-label">Gateway Enabled</div><div class="setting-desc">Master on/off for all SMS</div></div>
        <div class="setting-control"><div class="toggle ${settings.gateway_enabled ? 'on' : ''}" data-key="gateway_enabled"></div></div></div>
      <div class="setting-row"><div class="setting-info"><div class="setting-label">Test Mode</div><div class="setting-desc">Send with test=1</div></div>
        <div class="setting-control"><div class="toggle ${settings.test_mode ? 'warn' : ''}" data-key="test_mode"></div></div></div>
      <div class="setting-row"><div class="setting-info"><div class="setting-label">Debug Logging</div><div class="setting-desc">Verbose output</div></div>
        <div class="setting-control"><div class="toggle ${settings.debug_logging ? 'on' : ''}" data-key="debug_logging"></div></div></div>
      <div class="setting-row"><div class="setting-info"><div class="setting-label">Sender ID</div></div>
        <div class="setting-control"><div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;min-width:120px;text-align:center;">${sender}</div></div></div>
      <div class="setting-row" style="border-bottom:none;"><div class="setting-info"><div class="setting-label">Country Code</div></div>
        <div class="setting-control"><div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;min-width:120px;text-align:center;">${ccDisplay}</div></div></div>
    </div></div>`;
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
  const testBadge = '<span class="status test"><span class="status-dot"></span> Test Mode</span>';
  const syncBtn = '<button class="btn btn-ghost btn-sm" id="sync-now-btn"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync Now</button>';

  container.innerHTML = renderHeader('Dashboard', testBadge + syncBtn) + '<div class="content"><p style="color:var(--text-muted);">Loading dashboard...</p></div>';

  const [settings, sync, logs] = await Promise.all([
    loadSettings(), loadSyncData(),
    loadLogs({ pageSize: 5 }).catch(() => [] as LogEntry[]),
  ]);

  const content = container.querySelector('.content')!;
  content.innerHTML = renderStats(settings, sync) +
    '<div class="two-col">' + renderRecentActivity(logs) + renderQuickSettings(settings, sync) + '</div>';

  // Bind quick-settings toggles
  content.querySelectorAll('.toggle[data-key]').forEach(el => {
    el.addEventListener('click', async () => {
      const key = el.getAttribute('data-key') as keyof Settings;
      const s = settings as unknown as Record<string, unknown>;
      const current = s[key] as boolean;
      const next = !current;
      s[key] = next;
      el.className = next ? `toggle ${key === 'test_mode' ? 'warn' : 'on'}` : 'toggle';
      await saveSettings(settings);
    });
  });
}
