export function bindToggles(container: HTMLElement): void {
  container.querySelectorAll('.toggle[data-key]').forEach(el => {
    el.addEventListener('click', () => {
      const current = el.classList.contains('on') || el.classList.contains('warn');
      const variant = el.getAttribute('data-variant') || 'on';
      if (current) {
        el.className = 'toggle';
      } else {
        el.className = `toggle ${variant}`;
      }
      el.dispatchEvent(new CustomEvent('toggle-change', {
        detail: { key: el.getAttribute('data-key'), value: !current },
        bubbles: true,
      }));
    });
  });
}
