// SMS Logs page - filters, expandable rows, pagination, CSV export
// Security: Admin-only. Log data from admin-controlled Firestore.

import { renderHeader } from '../components/header';
import { loadLogs } from '../firebase';
import { renderPagination, bindPagination } from '../components/pagination';
import type { LogEntry } from '../types';

const PAGE_SIZE = 25;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusBadge(status: string): string {
  const cls = status === 'sent' || status === 'success' ? 'sent' : status === 'failed' ? 'failed' : status === 'verified' ? 'verified' : status === 'skipped' ? 'skipped' : 'test';
  return `<span class="status ${cls}"><span class="status-dot"></span> ${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function typeBadge(type: string): string {
  const cls = type === 'send' ? 'send' : type === 'otp' ? 'otp' : type === 'welcome' ? 'welcome' : type === 'sync' ? 'sync' : 'send';
  return `<span class="type-badge ${cls}">${type.charAt(0).toUpperCase() + type.slice(1)}</span>`;
}

function formatTime(entry: LogEntry): string {
  if (!entry.createdAt) return '';
  const d = entry.createdAt.toDate();
  const mon = d.toLocaleString('en', { month: 'short' });
  return `${mon} ${d.getDate()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  return ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`;
}

function renderFilters(): string {
  return `<div class="filters">
    <div class="filter-group"><span class="filter-label">Type</span>
      <select class="filter-select" id="filter-type"><option value="all">All Types</option><option value="send">Send</option><option value="otp">OTP</option><option value="welcome">Welcome</option><option value="sync">Sync</option></select></div>
    <div class="filter-group"><span class="filter-label">Trigger</span>
      <select class="filter-select" id="filter-trigger"><option value="all">All Triggers</option><option value="queue">Queue</option><option value="callable">Callable</option><option value="auth">Auth</option><option value="otp">OTP</option><option value="scheduled">Scheduled</option></select></div>
    <div class="filter-group"><span class="filter-label">Status</span>
      <select class="filter-select" id="filter-status"><option value="all">All</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select></div>
    <div class="filter-divider"></div>
    <div class="filter-group"><span class="filter-label">From</span><input class="filter-input" type="date" id="filter-from" /></div>
    <div class="filter-group"><span class="filter-label">To</span><input class="filter-input" type="date" id="filter-to" /></div>
    <div class="filter-divider"></div>
    <span class="filter-clear" id="clear-filters">Clear filters</span>
    <span class="filter-count" id="filter-count"></span>
  </div>`;
}

function renderLogRow(log: LogEntry): string {
  const preview = escapeHtml((log.message_preview || '').slice(0, 50));
  return `<tr class="log-row" data-id="${log.id}" style="cursor:pointer;">
    <td style="color:var(--text-light);font-size:11px;">&#9654;</td>
    <td>${typeBadge(log.type)}</td>
    <td><span class="trigger">${log.trigger || ''}</span></td>
    <td class="mono">${escapeHtml(log.to || '')}</td>
    <td style="max-width:200px;"><div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${preview}</div></td>
    <td>${statusBadge(log.status)}</td>
    <td>${log.test !== undefined ? `<span class="test-dot${log.test ? '' : ' live'}"></span>` : ''}</td>
    <td class="mono">${formatDuration(log.duration_ms)}</td>
    <td class="mono" style="white-space:nowrap;">${formatTime(log)}</td>
  </tr>`;
}

function renderExpandedRow(log: LogEntry): string {
  return `<tr class="expanded-row" data-expand-id="${log.id}"><td colspan="9"><div class="expanded-detail">
    <div class="detail-item"><div class="detail-label">Template</div><div class="detail-value">${escapeHtml(log.template || 'N/A')}</div></div>
    <div class="detail-item"><div class="detail-label">Sender ID</div><div class="detail-value">${escapeHtml(log.sender_id || 'N/A')}</div></div>
    <div class="detail-item"><div class="detail-label">API Response</div><div class="detail-value mono">${log.response ? escapeHtml(JSON.stringify(log.response).slice(0, 100)) : 'N/A'}</div></div>
    <div class="detail-item"><div class="detail-label">Metadata</div><div class="detail-value mono">${log.metadata ? escapeHtml(JSON.stringify(log.metadata).slice(0, 100)) : 'N/A'}</div></div>
    ${log.error ? `<div class="detail-item"><div class="detail-label">Error</div><div class="detail-value error">${escapeHtml(log.error)}</div></div>` : ''}
  </div></td></tr>`;
}

function exportCsv(logs: LogEntry[]): void {
  const headers = ['Type','Trigger','To','Message','Status','Test','Duration (ms)','Sender ID','Template','Error','Time'];
  const rows = logs.map(l => [
    l.type, l.trigger, l.to || '', l.message_preview || '', l.status,
    l.test ? 'Yes' : 'No', l.duration_ms?.toString() || '', l.sender_id || '',
    l.template || '', l.error || '',
    l.createdAt ? l.createdAt.toDate().toISOString() : '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sms-logs-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function renderLogs(container: HTMLElement): Promise<void> {
  const exportBtn = `<button class="btn btn-ghost btn-sm" id="export-csv-btn">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV</button>`;
  container.innerHTML = renderHeader('SMS Logs', exportBtn) + '<div class="content" style="max-width:100%;"><div class="card"><div id="filters-area"></div><div id="table-area"><p style="padding:20px;color:var(--text-muted);">Loading...</p></div><div id="pagination-area"></div></div></div>';

  let allLogs: LogEntry[] = [];
  let filteredLogs: LogEntry[] = [];
  let currentPage = 1;
  const expandedIds = new Set<string>();

  async function loadAllLogs(): Promise<void> {
    allLogs = await loadLogs({ pageSize: 500 });
  }

  function getFilters(): { type: string; trigger: string; status: string; from: string; to: string } {
    return {
      type: (document.getElementById('filter-type') as HTMLSelectElement)?.value || 'all',
      trigger: (document.getElementById('filter-trigger') as HTMLSelectElement)?.value || 'all',
      status: (document.getElementById('filter-status') as HTMLSelectElement)?.value || 'all',
      from: (document.getElementById('filter-from') as HTMLInputElement)?.value || '',
      to: (document.getElementById('filter-to') as HTMLInputElement)?.value || '',
    };
  }

  function applyFilters(): void {
    const f = getFilters();
    filteredLogs = allLogs.filter(l => {
      if (f.type !== 'all' && l.type !== f.type) return false;
      if (f.trigger !== 'all' && l.trigger !== f.trigger) return false;
      if (f.status !== 'all' && l.status !== f.status) return false;
      if (f.from && l.createdAt && l.createdAt.toDate() < new Date(f.from)) return false;
      if (f.to && l.createdAt && l.createdAt.toDate() > new Date(f.to + 'T23:59:59')) return false;
      return true;
    });
    currentPage = 1;
    renderTable();
  }

  function renderTable(): void {
    const tableArea = document.getElementById('table-area')!;
    const paginationArea = document.getElementById('pagination-area')!;
    const countEl = document.getElementById('filter-count');
    if (countEl) countEl.textContent = `${filteredLogs.length} results`;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredLogs.slice(start, start + PAGE_SIZE);

    if (pageItems.length === 0) {
      tableArea.innerHTML = '<div style="padding:32px 20px;text-align:center;color:var(--text-muted);">No log entries found</div>';
      paginationArea.innerHTML = '';
      return;
    }

    let rowsHtml = '';
    for (const log of pageItems) {
      rowsHtml += renderLogRow(log);
      if (expandedIds.has(log.id)) rowsHtml += renderExpandedRow(log);
    }

    tableArea.innerHTML = `<table><thead><tr>
      <th style="width:30px;"></th><th>Type</th><th>Trigger</th><th>To</th><th>Message</th><th>Status</th><th>Test</th><th>Duration</th><th>Time</th>
    </tr></thead><tbody>${rowsHtml}</tbody></table>`;

    paginationArea.innerHTML = renderPagination(currentPage, filteredLogs.length, PAGE_SIZE);
    bindPagination(paginationArea, (page) => { currentPage = page; renderTable(); });

    // Bind row expand
    tableArea.querySelectorAll('.log-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id')!;
        if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
        renderTable();
      });
    });
  }

  // Initial load
  const filtersArea = document.getElementById('filters-area')!;
  filtersArea.innerHTML = renderFilters();
  await loadAllLogs();
  filteredLogs = [...allLogs];
  renderTable();

  // Bind filters
  ['filter-type','filter-trigger','filter-status'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });
  ['filter-from','filter-to'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    (document.getElementById('filter-type') as HTMLSelectElement).value = 'all';
    (document.getElementById('filter-trigger') as HTMLSelectElement).value = 'all';
    (document.getElementById('filter-status') as HTMLSelectElement).value = 'all';
    (document.getElementById('filter-from') as HTMLInputElement).value = '';
    (document.getElementById('filter-to') as HTMLInputElement).value = '';
    applyFilters();
  });

  // Export CSV
  container.querySelector('#export-csv-btn')?.addEventListener('click', () => exportCsv(filteredLogs));
}
