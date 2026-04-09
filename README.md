<p align="center">
  <img src="https://www.kwtsms.com/images/kwtsms_logo_60.png" alt="kwtSMS" height="60">
</p>

<h1 align="center">kwtSMS Firebase Extension</h1>

<p align="center">
  Send SMS notifications, OTP codes, and alerts from Firebase using the <a href="https://www.kwtsms.com">kwtSMS</a> gateway.
</p>

<p align="center">
  <a href="https://github.com/boxlinknet/kwtsms-firebase/releases"><img src="https://img.shields.io/github/v/release/boxlinknet/kwtsms-firebase?label=version&color=FFA200" alt="Version"></a>
  <a href="https://github.com/boxlinknet/kwtsms-firebase/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://firebase.google.com/docs/extensions"><img src="https://img.shields.io/badge/Firebase-Extension-FFCA28?logo=firebase&logoColor=black" alt="Firebase Extension"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://www.kwtsms.com"><img src="https://img.shields.io/badge/SMS-kwtSMS-FFA200" alt="kwtSMS"></a>
</p>

---

## About kwtSMS

[kwtSMS](https://www.kwtsms.com) is a Kuwait-based SMS gateway that provides reliable A2P (application-to-person) messaging across Kuwait and 100+ countries. It supports transactional SMS (OTP, alerts, notifications) and promotional campaigns with Arabic and English content. kwtSMS is used by businesses, banks, and government entities in the GCC region for SMS delivery through local carrier routes.

- API documentation: [kwtsms.com/integrations.html](https://www.kwtsms.com/integrations.html)
- Client libraries: PHP, Python, JavaScript, Ruby, Go, Java, C#, Swift, Kotlin, Rust, Dart, Zig
- Sender ID registration, transactional and promotional routing, real-time balance and coverage APIs

## What this extension does

Install this extension in your Firebase project to send SMS through kwtSMS. Write a document to Firestore and the extension sends it as SMS automatically. No server setup, no SMS infrastructure to manage.

**Cloud Functions (6 total):**

| Function | Type | What it does |
|----------|------|-------------|
| `processQueue` | Firestore trigger | Sends SMS when a document is created in the queue collection |
| `onUserCreate` | Auth trigger | Sends a welcome SMS when a new user signs up with a phone number |
| `sendSms` | HTTPS callable | Sends SMS on demand from your client app (rate limited: 10/min per user) |
| `handleOtp` | HTTPS callable | Generates and verifies one-time passwords (60s cooldown, 3 attempts, 5min expiry) |
| `scheduledSync` | Scheduled | Syncs balance, sender IDs, and coverage from kwtSMS daily |
| `onInstallHandler` | Lifecycle | Seeds settings, templates, and runs first sync on install |

**Admin Dashboard (Firebase Hosting):**

| Page | What it does |
|------|-------------|
| Dashboard | Balance, sent today, test mode/gateway status, recent activity |
| Settings | Gateway toggles, sender ID, app name, country code, test SMS sender |
| Templates | View/edit all templates (EN + AR), create custom, delete, revert to defaults |
| SMS Logs | Filter by type/trigger/status/date, expandable detail rows, pagination, CSV export |
| Help | Code examples, template variables reference, troubleshooting, error codes |

**Security features:**

- OTP codes hashed (SHA-256) with timing-safe comparison
- Rate limiting: 10 sends/min per user (callable), 60s OTP cooldown
- Generic error messages to prevent phone enumeration
- Firestore rules with admin custom claim for dashboard access
- Input validation and idempotency guards on all handlers
- Credentials never logged at any level

**Additional capabilities:**

- Multilingual templates with `{{placeholder}}` support (English and Arabic)
- Phone number normalization: strips prefixes, converts Arabic digits, prepends country codes
- Configurable sender ID and default country code from synced API data
- Global gateway on/off switch and test mode (no delivery, no credits consumed)
- Firestore audit logs + Cloud Functions debug logging
- Settings cache with 5s TTL to reduce Firestore reads

## Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) installed (`npm install -g firebase-tools`)
- A Firebase project with **Firestore** and **Authentication** (email/password) enabled
- A [kwtSMS account](https://www.kwtsms.com) with API access enabled
- Node.js >= 20

## Installation

### Step 1: Install the extension

**From GitHub (recommended):**

```bash
firebase ext:install https://github.com/boxlinknet/kwtsms-firebase --project=YOUR_PROJECT
```

**From Firebase Extensions Hub** (when available):

```bash
firebase ext:install kwtsms/kwtsms-firebase --project=YOUR_PROJECT
```

**From local source:**

```bash
git clone https://github.com/boxlinknet/kwtsms-firebase.git
cd kwtsms-firebase/functions && npm install && npx tsc && cd ..
firebase ext:install . --project=YOUR_PROJECT
```

During installation, you will be prompted for:
- **kwtSMS API username** (not your phone number, find it in your kwtSMS account settings)
- **kwtSMS API password**
- **Application name** (used in welcome/OTP templates)
- **Cloud Functions location** (choose closest to your users)

Credentials are stored securely in [Cloud Secret Manager](https://cloud.google.com/secret-manager).

### Step 2: Deploy the dashboard (optional)

```bash
cd kwtsms-firebase/web
npm install
npm run build
cd ..
firebase deploy --only hosting --project=YOUR_PROJECT
```

### Step 3: Set up admin access for the dashboard

The dashboard requires Firebase Auth with an admin custom claim. Create an admin user:

```bash
# Create a user in Firebase Console > Authentication > Users > Add User
# Then set the admin claim using the Firebase Admin SDK:
firebase functions:shell
> const admin = require('firebase-admin');
> admin.auth().setCustomUserClaims('USER_UID_HERE', { admin: true });
```

### Step 4: Verify installation

1. Check Firestore: `sms_config/settings` and `sms_config/sync` documents should exist
2. Check `sms_templates` collection: 8 default templates seeded
3. Open the dashboard and log in with your admin user
4. Send a test SMS from Settings page (test mode is ON by default, no real delivery)

## Configuration

The extension creates a `sms_config/settings` document in Firestore with these defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `gateway_enabled` | `true` | Global on/off switch for all SMS sending |
| `test_mode` | `true` | Sends with test=1, no delivery, no credits consumed |
| `debug_logging` | `false` | Enables verbose Cloud Functions logs |
| `default_country_code` | `965` | Prepended to numbers without a country code |
| `selected_sender_id` | `KWT-SMS` | Active sender ID from your kwtSMS account |
| `app_name` | `My App` | Used in template placeholders (welcome, OTP messages) |

Test mode is on by default. Change settings via the dashboard or edit the Firestore document directly. Set `test_mode` to `false` when you're ready for production.

## Usage

### Send SMS with Firestore queue

Write a document to the `sms_queue` collection:

```javascript
import { getFirestore, addDoc, collection } from 'firebase/firestore';

const db = getFirestore();

// Send with inline message
await addDoc(collection(db, 'sms_queue'), {
  to: '96598765432',
  message: 'Your order has been confirmed.',
});

// Send with template (Arabic)
await addDoc(collection(db, 'sms_queue'), {
  to: '96598765432',
  template: 'order_confirmed',
  templateData: { customer_name: 'Ahmad', order_id: 'ORD-123' },
  language: 'ar',
});

// Send to multiple recipients
await addDoc(collection(db, 'sms_queue'), {
  to: '96598765432, 96612345678',
  message: 'Flash sale starts now!',
});
```

The extension picks up the document, sends the SMS, and updates it with the result:

```javascript
{
  status: 'sent',        // 'sent', 'failed', or 'skipped'
  response: { ... },     // kwtSMS API response
  test: true,            // whether test mode was active
  processedAt: Timestamp
}
```

### Send SMS with callable function

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendSms = httpsCallable(functions, 'ext-kwtsms-firebase-sendSms');

const result = await sendSms({
  action: 'send',
  to: '96598765432',
  template: 'order_shipped',
  templateData: { customer_name: 'Ahmad', order_id: 'ORD-123' },
  language: 'en',
});
// result.data = { success: true, msgId: '...' }
```

Requires Firebase Auth. Rate limited to 10 requests per minute per user.

### OTP verification

```javascript
const handleOtp = httpsCallable(functions, 'ext-kwtsms-firebase-handleOtp');

// Generate and send OTP
await handleOtp({ action: 'sendOtp', phone: '96598765432' });
// { success: true, expiresIn: 300 }

// Verify OTP code
const result = await handleOtp({
  action: 'verifyOtp',
  phone: '96598765432',
  code: '123456',
});
// { success: true } or { success: false, error: 'Verification failed' }
```

- Codes expire after **5 minutes**
- Maximum **3 verification attempts** per code
- **60-second cooldown** between sends to the same phone
- Codes are hashed before storage (SHA-256)

## Templates

The extension seeds 8 default templates on install. Templates support English and Arabic with `{{placeholder}}` replacement. Edit via the dashboard or directly in the `sms_templates` Firestore collection.

| Template | Placeholders |
|----------|-------------|
| `welcome` | `app_name` |
| `otp` | `app_name`, `code`, `expiry_minutes` |
| `order_confirmed` | `customer_name`, `order_id` |
| `order_shipped` | `customer_name`, `order_id` |
| `order_delivered` | `customer_name`, `order_id` |
| `status_update` | `customer_name`, `order_id`, `status` |
| `reminder` | `customer_name`, `reminder_text` |
| `custom` | `message` |

System templates can't be deleted but their body text can be changed and reverted to the original. Create custom templates via the dashboard.

## Monitoring

- **Dashboard**: Balance, sent count, gateway status, recent activity at a glance
- **SMS Logs**: Filter and search all send attempts in the dashboard (or `sms_logs` collection)
- **Balance**: Synced daily from kwtSMS API (or click "Sync Now" on dashboard)
- **Debug logs**: Enable `debug_logging` in settings, then check Cloud Functions logs

## Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| 1. Extension core | v1.0.0 | Queue, Auth, callable, OTP, sync, templates, logging, security hardening |
| 2. Dashboard | v1.0.0 | Settings UI, templates editor, SMS logs viewer, help page (Firebase Hosting) |
| 3. Campaigns | Planned | Scheduled messages, reminders, bulk campaigns |
| 4. Security | Planned | CAPTCHA, advanced rate limiting, abuse prevention |

## Documentation

- [kwtSMS API docs](https://www.kwtsms.com/integrations.html)
- [kwtSMS JS client library](https://github.com/boxlinknet/kwtsms-js)
- [Firebase Extensions docs](https://firebase.google.com/docs/extensions)

## Support

- kwtSMS support: [kwtsms.com/support.html](https://www.kwtsms.com/support.html)
- Issues: [github.com/boxlinknet/kwtsms-firebase/issues](https://github.com/boxlinknet/kwtsms-firebase/issues)

## License

Apache-2.0
