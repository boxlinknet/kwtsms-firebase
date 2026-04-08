// Help page - static docs, code examples, troubleshooting
// All content is static trusted HTML. No Firestore reads needed.

import { renderHeader } from '../components/header';

function codeBlock(code: string): string {
  return `<div class="code-block">${code}</div>`;
}

const SECTIONS = [
  {
    icon: 'orange',
    iconSvg: '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    title: 'Send SMS via Firestore Queue',
    desc: 'Write a document to trigger an SMS automatically',
    body: `<p>Create a document in the <code>sms_queue</code> collection. The extension picks it up and sends the SMS automatically.</p>
      <h4>Inline message</h4>
      ${codeBlock(`<span class="keyword">await</span> db.<span class="func">collection</span>(<span class="string">'sms_queue'</span>).<span class="func">add</span>({
  <span class="key">to</span>: <span class="string">'96598765432'</span>,
  <span class="key">message</span>: <span class="string">'Your order has been shipped!'</span>,
});`)}
      <h4>Using a template</h4>
      ${codeBlock(`<span class="keyword">await</span> db.<span class="func">collection</span>(<span class="string">'sms_queue'</span>).<span class="func">add</span>({
  <span class="key">to</span>: <span class="string">'96598765432'</span>,
  <span class="key">template</span>: <span class="string">'order_confirmed'</span>,
  <span class="key">templateData</span>: { <span class="key">customer_name</span>: <span class="string">'Ahmad'</span>, <span class="key">order_id</span>: <span class="string">'ORD-123'</span> },
  <span class="key">language</span>: <span class="string">'ar'</span>,
});`)}
      <h4>Document fields</h4>
      <table class="help-table"><thead><tr><th>Field</th><th>Required</th><th>Description</th></tr></thead><tbody>
        <tr><td><code>to</code></td><td>Yes</td><td>Phone number or comma-separated list</td></tr>
        <tr><td><code>message</code></td><td>*</td><td>Inline message text</td></tr>
        <tr><td><code>template</code></td><td>*</td><td>Template name (instead of message)</td></tr>
        <tr><td><code>templateData</code></td><td>No</td><td>Key-value pairs for placeholders</td></tr>
        <tr><td><code>language</code></td><td>No</td><td><code>en</code> or <code>ar</code> (default: <code>en</code>)</td></tr>
        <tr><td><code>sender</code></td><td>No</td><td>Override sender ID</td></tr>
      </tbody></table>
      <p style="font-size:12px;color:var(--text-muted);">* Either <code>message</code> or <code>template</code> is required.</p>`,
  },
  {
    icon: 'blue',
    iconSvg: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    title: 'Send SMS via Callable Function',
    desc: 'Call directly from your client app (requires Firebase Auth)',
    body: `${codeBlock(`<span class="keyword">import</span> { getFunctions, httpsCallable } <span class="keyword">from</span> <span class="string">'firebase/functions'</span>;

<span class="keyword">const</span> functions = <span class="func">getFunctions</span>();
<span class="keyword">const</span> sendSms = <span class="func">httpsCallable</span>(functions, <span class="string">'ext-kwtsms-firebase-sendSms'</span>);

<span class="keyword">const</span> result = <span class="keyword">await</span> <span class="func">sendSms</span>({
  <span class="key">action</span>: <span class="string">'send'</span>,
  <span class="key">to</span>: <span class="string">'96598765432'</span>,
  <span class="key">message</span>: <span class="string">'Your delivery is arriving in 10 minutes'</span>,
});
console.<span class="func">log</span>(result.data); <span class="comment">// { success: true, msgId: "f4c841..." }</span>`)}
      <p>The caller must be authenticated with Firebase Auth. Rate limited to 10 requests per minute per user.</p>`,
  },
  {
    icon: 'purple',
    iconSvg: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    title: 'OTP Verification',
    desc: 'Send and verify one-time passwords via SMS',
    body: `<h4>Send OTP</h4>
      ${codeBlock(`<span class="keyword">const</span> handleOtp = <span class="func">httpsCallable</span>(functions, <span class="string">'ext-kwtsms-firebase-handleOtp'</span>);
<span class="keyword">await</span> <span class="func">handleOtp</span>({ <span class="key">action</span>: <span class="string">'sendOtp'</span>, <span class="key">phone</span>: <span class="string">'96598765432'</span> });
<span class="comment">// { success: true, expiresIn: 300 }</span>`)}
      <h4>Verify OTP</h4>
      ${codeBlock(`<span class="keyword">const</span> result = <span class="keyword">await</span> <span class="func">handleOtp</span>({
  <span class="key">action</span>: <span class="string">'verifyOtp'</span>,
  <span class="key">phone</span>: <span class="string">'96598765432'</span>,
  <span class="key">code</span>: <span class="string">'483921'</span>,
});
<span class="comment">// { success: true } or { success: false, error: "Verification failed" }</span>`)}
      <ul>
        <li>Codes expire after <strong>5 minutes</strong></li>
        <li>Maximum <strong>3 verification attempts</strong> per code</li>
        <li><strong>60-second cooldown</strong> between sends to the same phone</li>
        <li>Codes are hashed before storage (SHA-256)</li>
      </ul>`,
  },
  {
    icon: 'green',
    iconSvg: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    title: 'Template Variables',
    desc: 'Available placeholders for SMS templates',
    body: `<p>Use <code>{{placeholder}}</code> syntax in template bodies. Missing placeholders are replaced with empty text.</p>
      <table class="help-table"><thead><tr><th>Placeholder</th><th>Used In</th><th>Description</th></tr></thead><tbody>
        <tr><td><code>{{app_name}}</code></td><td>welcome, otp</td><td>Your application name</td></tr>
        <tr><td><code>{{code}}</code></td><td>otp</td><td>6-digit verification code</td></tr>
        <tr><td><code>{{expiry_minutes}}</code></td><td>otp</td><td>Code expiry time (5)</td></tr>
        <tr><td><code>{{customer_name}}</code></td><td>order_*, reminder, status</td><td>Customer name</td></tr>
        <tr><td><code>{{order_id}}</code></td><td>order_*, status</td><td>Order identifier</td></tr>
        <tr><td><code>{{status}}</code></td><td>status_update</td><td>Order status text</td></tr>
        <tr><td><code>{{reminder_text}}</code></td><td>reminder</td><td>Reminder message</td></tr>
        <tr><td><code>{{message}}</code></td><td>custom</td><td>Freeform message</td></tr>
      </tbody></table>`,
  },
  {
    icon: 'orange',
    iconSvg: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    title: 'Troubleshooting',
    desc: 'Common issues and solutions',
    body: `<h4>SMS not sending</h4>
      <ul>
        <li>Check that <strong>Gateway Enabled</strong> is ON in Settings</li>
        <li>Check that <strong>Test Mode</strong> is OFF for real delivery</li>
        <li>Check your kwtSMS balance on the Dashboard</li>
        <li>Enable <strong>Debug Logging</strong> and check Cloud Functions logs</li>
      </ul>
      <h4>Wrong sender ID</h4>
      <ul>
        <li>"KWT-SMS" is for testing only. Register a private sender ID on kwtsms.com</li>
        <li>Click "Sync Now" on the Dashboard to refresh available sender IDs</li>
      </ul>
      <h4>OTP not arriving</h4>
      <ul>
        <li>Check that the phone number includes the country code</li>
        <li>Wait 60 seconds between OTP requests (cooldown enforced)</li>
        <li>Check SMS Logs for the OTP send status and error details</li>
      </ul>
      <h4>kwtSMS error codes</h4>
      <table class="help-table"><thead><tr><th>Code</th><th>Meaning</th><th>Solution</th></tr></thead><tbody>
        <tr><td><code>ERR003</code></td><td>Wrong credentials</td><td>Reconfigure extension with correct API username/password</td></tr>
        <tr><td><code>ERR006</code></td><td>No valid numbers</td><td>Check phone number format includes country code</td></tr>
        <tr><td><code>ERR009</code></td><td>Empty message</td><td>Provide message text or valid template</td></tr>
        <tr><td><code>ERR010</code></td><td>Zero balance</td><td>Recharge at kwtsms.com</td></tr>
        <tr><td><code>ERR028</code></td><td>15s cooldown</td><td>Wait 15 seconds before sending to same number</td></tr>
      </tbody></table>`,
  },
];

export function renderHelp(container: HTMLElement): void {
  const linkHtml = '<a class="link" href="https://www.kwtsms.com/developers.html" target="_blank" style="font-size:13px;">kwtSMS API Docs &#8599;</a>';
  const sectionsHtml = SECTIONS.map((s, i) => `
    <div class="help-section">
      <div class="help-section-header" data-section="${i}">
        <div class="help-section-icon ${s.icon}">${s.iconSvg}</div>
        <div><div class="help-section-title">${s.title}</div><div class="help-section-desc">${s.desc}</div></div>
      </div>
      <div class="help-section-body" id="help-body-${i}">${s.body}</div>
    </div>
  `).join('');

  const footerLinks = `<div style="text-align:center;padding:24px 0;font-size:13px;color:var(--text-muted);">
    <a class="link" href="https://www.kwtsms.com/developers.html" target="_blank">kwtSMS API Docs</a>
    &nbsp;&middot;&nbsp;
    <a class="link" href="https://www.kwtsms.com/support.html" target="_blank">kwtSMS Support</a>
    &nbsp;&middot;&nbsp;
    <a class="link" href="https://github.com/boxlinknet/kwtsms-firebase" target="_blank">GitHub</a>
  </div>`;

  container.innerHTML = renderHeader('Help', linkHtml) + `<div class="content" style="max-width:800px;">${sectionsHtml}${footerLinks}</div>`;

  // Toggle sections
  container.querySelectorAll('.help-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const idx = header.getAttribute('data-section')!;
      const body = document.getElementById(`help-body-${idx}`)!;
      body.style.display = body.style.display === 'none' ? '' : 'none';
    });
  });
}
