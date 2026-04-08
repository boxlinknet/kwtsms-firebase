// Templates page - list, edit, create, delete
// Security: Admin-only. Template data from admin-controlled Firestore.

import { renderHeader } from '../components/header';
import { loadTemplates, saveTemplate, deleteTemplate } from '../firebase';
import { openModal, closeModal } from '../components/modal';
import type { Template } from '../types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function placeholderPills(placeholders: string[]): string {
  return placeholders.map(p => `<span class="tmpl-placeholder">${p}</span>`).join(' ');
}

function renderTable(templates: Template[]): string {
  const rows = templates.map(t => `<tr>
    <td><div class="tmpl-name">${escapeHtml(t.name)}</div><div class="tmpl-desc">${escapeHtml(t.description || '')}</div></td>
    <td><div class="tmpl-preview">${escapeHtml(t.body_en || '')}</div></td>
    <td><div class="tmpl-preview" style="direction:rtl;text-align:right;">${escapeHtml(t.body_ar || '')}</div></td>
    <td>${placeholderPills(t.placeholders || [])}</td>
    <td><span class="tmpl-badge ${t.is_system ? 'system' : 'custom'}">${t.is_system ? 'System' : 'Custom'}</span></td>
    <td><div class="actions"><button class="btn btn-ghost btn-sm edit-tmpl-btn" data-name="${escapeHtml(t.name)}">Edit</button></div></td>
  </tr>`).join('');

  return `<div class="card"><table>
    <thead><tr><th>Template</th><th>English</th><th>Arabic</th><th>Placeholders</th><th>Type</th><th style="width:80px;"></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function editModalBody(t: Template, isNew: boolean): string {
  return `
    <div class="form-group">
      <label class="form-label">Template Name</label>
      <input class="form-input" type="text" id="tmpl-name" value="${escapeHtml(t.name)}" ${!isNew && t.is_system ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''} ${!isNew ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''} />
      ${!isNew ? '<div class="form-hint">Template names cannot be changed after creation.</div>' : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" type="text" id="tmpl-desc" value="${escapeHtml(t.description || '')}" />
    </div>
    <div class="lang-tabs">
      <div class="lang-tab active" data-lang="en">English</div>
      <div class="lang-tab" data-lang="ar">العربية</div>
    </div>
    <div id="body-en-group" class="form-group">
      <label class="form-label">Message Body (English)</label>
      <textarea class="form-input" id="tmpl-body-en">${escapeHtml(t.body_en || '')}</textarea>
      <div class="form-hint">Use {{placeholder}} for dynamic values.</div>
    </div>
    <div id="body-ar-group" class="form-group" style="display:none;">
      <label class="form-label">Message Body (Arabic)</label>
      <textarea class="form-input" id="tmpl-body-ar" dir="rtl">${escapeHtml(t.body_ar || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Placeholders</label>
      <div id="tmpl-placeholders">${placeholderPills(t.placeholders || [])}</div>
      <div class="form-hint">Click a placeholder to insert at cursor.</div>
    </div>`;
}

function editModalFooter(t: Template, isNew: boolean): string {
  const revert = t.is_system && !isNew ? '<span class="revert-link" id="revert-btn">Revert to default</span>' : '<span></span>';
  const deleteBtn = !t.is_system && !isNew ? '<button class="btn btn-danger-ghost btn-sm" id="delete-tmpl-btn">Delete</button>' : '';
  return `<div style="display:flex;align-items:center;gap:8px;">${revert}${deleteBtn}</div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost" id="cancel-tmpl-btn">Cancel</button>
      <button class="btn btn-primary" id="save-tmpl-btn">Save Template</button>
    </div>`;
}

let refreshFn: (() => Promise<void>) | null = null;

function openEditModal(t: Template, isNew: boolean): void {
  const title = isNew ? 'New Template' : `Edit Template: ${t.name}`;
  openModal(title, editModalBody(t, isNew), editModalFooter(t, isNew));

  // Lang tabs
  document.querySelectorAll('.lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lang-tab').forEach(t2 => t2.classList.remove('active'));
      tab.classList.add('active');
      const lang = tab.getAttribute('data-lang');
      const enGroup = document.getElementById('body-en-group')!;
      const arGroup = document.getElementById('body-ar-group')!;
      enGroup.style.display = lang === 'en' ? '' : 'none';
      arGroup.style.display = lang === 'ar' ? '' : 'none';
    });
  });

  // Placeholder click to insert
  document.querySelectorAll('#tmpl-placeholders .tmpl-placeholder').forEach(pill => {
    pill.addEventListener('click', () => {
      const enVisible = document.getElementById('body-en-group')!.style.display !== 'none';
      const textarea = document.getElementById(enVisible ? 'tmpl-body-en' : 'tmpl-body-ar') as HTMLTextAreaElement;
      const pos = textarea.selectionStart;
      const text = `{{${pill.textContent}}}`;
      textarea.value = textarea.value.slice(0, pos) + text + textarea.value.slice(pos);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = pos + text.length;
    });
  });

  // Save
  document.getElementById('save-tmpl-btn')!.addEventListener('click', async () => {
    const name = (document.getElementById('tmpl-name') as HTMLInputElement).value.trim();
    if (!name) return;
    const data: Partial<Template> = {
      description: (document.getElementById('tmpl-desc') as HTMLInputElement).value,
      body_en: (document.getElementById('tmpl-body-en') as HTMLTextAreaElement).value,
      body_ar: (document.getElementById('tmpl-body-ar') as HTMLTextAreaElement).value,
    };
    if (isNew) {
      data.name = name;
      data.placeholders = (data.body_en || '').match(/\{\{(\w+)\}\}/g)?.map(m => m.slice(2, -2)) || [];
      data.is_system = false;
      data.editable = true;
      data.deletable = true;
    }
    await saveTemplate(name, data);
    closeModal();
    if (refreshFn) await refreshFn();
  });

  // Cancel
  document.getElementById('cancel-tmpl-btn')!.addEventListener('click', closeModal);

  // Revert
  document.getElementById('revert-btn')?.addEventListener('click', () => {
    if (t.body_default_en) (document.getElementById('tmpl-body-en') as HTMLTextAreaElement).value = t.body_default_en;
    if (t.body_default_ar) (document.getElementById('tmpl-body-ar') as HTMLTextAreaElement).value = t.body_default_ar;
  });

  // Delete
  document.getElementById('delete-tmpl-btn')?.addEventListener('click', async () => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await deleteTemplate(t.name);
    closeModal();
    if (refreshFn) await refreshFn();
  });
}

export async function renderTemplates(container: HTMLElement): Promise<void> {
  const newBtn = `<button class="btn btn-primary" id="new-tmpl-btn">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Template</button>`;
  container.innerHTML = renderHeader('Templates', newBtn) + '<div class="content"><p style="color:var(--text-muted);">Loading...</p></div>';

  const contentEl = container.querySelector('.content')!;

  async function refresh(): Promise<void> {
    const templates = await loadTemplates().catch(() => [] as Template[]);
    const countHtml = `<span style="font-size:13px;color:var(--text-muted);margin-right:12px;">${templates.length} templates</span>`;
    container.querySelector('.header-actions')!.innerHTML = countHtml + newBtn;
    contentEl.innerHTML = renderTable(templates);

    // Bind edit buttons
    contentEl.querySelectorAll('.edit-tmpl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name')!;
        const t = templates.find(x => x.name === name);
        if (t) openEditModal(t, false);
      });
    });

    // Bind new template button
    container.querySelector('#new-tmpl-btn')?.addEventListener('click', () => {
      openEditModal({
        name: '', description: '', body_en: '', body_ar: '',
        placeholders: [], is_system: false, editable: true, deletable: true,
      }, true);
    });
  }

  refreshFn = refresh;
  await refresh();
}
