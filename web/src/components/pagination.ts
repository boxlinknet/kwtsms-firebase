export function renderPagination(current: number, total: number, pageSize: number): string {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return '';

  const pages: string[] = [];
  pages.push(`<div class="page-btn${current === 1 ? ' disabled' : ''}" data-page="${current - 1}"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"/></svg></div>`);

  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) {
    pages.push(`<div class="page-btn${i === current ? ' active' : ''}" data-page="${i}">${i}</div>`);
  }
  if (end < totalPages) {
    pages.push('<div class="page-btn" style="font-size:10px;cursor:default;">...</div>');
    pages.push(`<div class="page-btn${totalPages === current ? ' active' : ''}" data-page="${totalPages}">${totalPages}</div>`);
  }

  pages.push(`<div class="page-btn${current === totalPages ? ' disabled' : ''}" data-page="${current + 1}"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"/></svg></div>`);

  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return `<div class="pagination">
    <div class="pagination-info">Showing ${from}-${to} of ${total}</div>
    <div class="pagination-controls">${pages.join('')}</div>
  </div>`;
}

export function bindPagination(container: HTMLElement, callback: (page: number) => void): void {
  container.querySelectorAll('.page-btn[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) return;
      const page = parseInt(el.getAttribute('data-page')!);
      if (!isNaN(page) && page >= 1) callback(page);
    });
  });
}
