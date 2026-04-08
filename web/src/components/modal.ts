// Modal component
// Security: Content is from admin-controlled Firestore templates.
// This dashboard is behind Firebase Auth + admin custom claim.

export function openModal(title: string, bodyHtml: string, footerHtml: string): void {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  // Admin-controlled trusted content
  modal.innerHTML = `<div class="modal-header"><h2>${title}</h2>
    <button class="modal-close" id="modal-close-btn"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div><div class="modal-body">${bodyHtml}</div><div class="modal-footer">${footerHtml}</div>`;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.getElementById('modal-close-btn')!.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

export function closeModal(): void {
  document.getElementById('modal-overlay')?.remove();
}
