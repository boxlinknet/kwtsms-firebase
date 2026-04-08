// Router for kwtSMS Dashboard SPA
// XSS note: All rendered content is from trusted sources (static nav items,
// admin-only Firestore data). No untrusted user input is rendered as HTML.

import { renderSidebar } from './components/sidebar';

interface Route {
  id: string;
  render: (container: HTMLElement) => Promise<void> | void;
}

const routes: Route[] = [];

export function registerRoute(route: Route): void {
  routes.push(route);
}

export function initRouter(app: HTMLElement): void {
  function navigate(): void {
    const hash = window.location.hash || '#/';
    const path = hash.replace('#', '') || '/';
    const route = routes.find(r =>
      `/${r.id}` === path || (r.id === 'dashboard' && path === '/')
    );

    if (!route) {
      window.location.hash = '#/';
      return;
    }

    // Build layout: sidebar + main > page-container
    const sidebarWrapper = document.createElement('div');
    // Sidebar HTML is static trusted content (nav items defined in sidebar.ts)
    sidebarWrapper.innerHTML = renderSidebar(route.id); // trusted static content

    const main = document.createElement('div');
    main.className = 'main';
    const pageContainer = document.createElement('div');
    pageContainer.id = 'page-container';
    main.appendChild(pageContainer);

    app.replaceChildren(sidebarWrapper.firstElementChild!, main);

    route.render(pageContainer);
  }

  window.addEventListener('hashchange', navigate);
  navigate();
}
