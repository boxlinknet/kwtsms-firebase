export function renderHeader(title: string, actionsHtml: string = ''): string {
  return `
    <div class="header">
      <div class="header-title">${title}</div>
      <div class="header-actions">${actionsHtml}</div>
    </div>`;
}
