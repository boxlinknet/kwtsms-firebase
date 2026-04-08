// kwtSMS Dashboard - Main entry point
// Security: Admin-only dashboard behind Firebase Auth + custom claim.
// All HTML rendered is from trusted static templates and admin-controlled
// Firestore data. No untrusted user input is rendered. innerHTML usage is
// intentional for rendering trusted admin UI components.

import './styles/main.css';
import { onAuth, login } from './firebase';
import { initRouter, registerRoute } from './router';
import { renderDashboard } from './pages/dashboard';
import { renderSettings } from './pages/settings';
import { renderTemplates } from './pages/templates';
import { renderLogs } from './pages/logs';
import { renderHelp } from './pages/help';

const appEl = document.getElementById('app')!;

// Register all pages
registerRoute({ id: 'dashboard', render: renderDashboard });
registerRoute({ id: 'settings', render: renderSettings });
registerRoute({ id: 'templates', render: renderTemplates });
registerRoute({ id: 'logs', render: renderLogs });
registerRoute({ id: 'help', render: renderHelp });

// Auth gate
onAuth((user) => {
  if (!user) {
    renderLogin();
  } else {
    initRouter(appEl);
  }
});

function renderLogin(): void {
  const page = document.createElement('div');
  page.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  const logo = document.createElement('img');
  logo.src = 'https://www.kwtsms.com/images/kwtsms_logo_60.png';
  logo.alt = 'kwtSMS';
  logo.className = 'login-logo';

  const title = document.createElement('h2');
  title.textContent = 'kwtSMS Dashboard';

  const form = document.createElement('form');

  const emailGroup = document.createElement('div');
  emailGroup.className = 'form-group';
  const emailLabel = document.createElement('label');
  emailLabel.className = 'form-label';
  emailLabel.textContent = 'Email';
  const emailInput = document.createElement('input');
  emailInput.className = 'form-input';
  emailInput.type = 'email';
  emailInput.required = true;
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  const passGroup = document.createElement('div');
  passGroup.className = 'form-group';
  const passLabel = document.createElement('label');
  passLabel.className = 'form-label';
  passLabel.textContent = 'Password';
  const passInput = document.createElement('input');
  passInput.className = 'form-input';
  passInput.type = 'password';
  passInput.required = true;
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passInput);

  const errorEl = document.createElement('div');
  errorEl.style.display = 'none';
  errorEl.style.color = 'var(--danger)';
  errorEl.style.fontSize = '13px';
  errorEl.style.marginBottom = '12px';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary';
  submitBtn.type = 'submit';
  submitBtn.style.width = '100%';
  submitBtn.textContent = 'Sign In';

  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(errorEl);
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    try {
      await login(emailInput.value, passInput.value);
    } catch {
      errorEl.textContent = 'Invalid credentials';
      errorEl.style.display = 'block';
    }
  });

  card.appendChild(logo);
  card.appendChild(title);
  card.appendChild(form);
  page.appendChild(card);

  appEl.replaceChildren(page);
}
