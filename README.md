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
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node.js"></a>
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

**Triggers and functions:**

| Function | Type | What it does |
|----------|------|-------------|
| `processQueue` | Firestore trigger | Sends SMS when a document is created in the queue collection |
| `onUserCreate` | Auth trigger | Sends a welcome SMS when a new user signs up with a phone number |
| `sendSms` | HTTPS callable | Sends SMS on demand from your client app |
| `handleOtp` | HTTPS callable | Generates and verifies one-time passwords |
| `scheduledSync` | Scheduled | Syncs balance, sender IDs, and coverage from kwtSMS daily |

**Additional capabilities:**

- Multilingual templates with `{{placeholder}}` support (English and Arabic)
- Phone number normalization: strips prefixes, converts Arabic digits, prepends country codes
- Configurable sender ID and default country code from synced API data
- Global gateway on/off switch and test mode (no delivery, no credits consumed)
- Firestore audit logs + Cloud Functions debug logging

## Installation

```bash
firebase ext:install kwtsms/kwtsms-firebase --project=YOUR_PROJECT
```

You need a [kwtSMS account](https://www.kwtsms.com) with API access enabled. During installation, provide your API username and password. These are stored securely in Cloud Secret Manager.

## Configuration

The extension creates a `sms_config/settings` document in Firestore with these defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `gateway_enabled` | `true` | Global on/off switch for all SMS sending |
| `test_mode` | `true` | Sends with test=1, no delivery, no credits consumed |
| `debug_logging` | `false` | Enables verbose Cloud Functions logs |
| `default_country_code` | `965` | Prepended to numbers without a country code |
| `selected_sender_id` | `KWT-SMS` | Active sender ID from your kwtSMS account |

Test mode is on by default. Set `test_mode` to `false` when you're ready for production.

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

// Send with template
await addDoc(collection(db, 'sms_queue'), {
  to: '96598765432',
  template: 'order_confirmed',
  templateData: { customer_name: 'Ahmad', order_id: 'ORD-123' },
  language: 'ar',
});
```

The extension picks up the document, sends the SMS, and updates it with the result:

```javascript
{
  status: 'sent',        // 'sent', 'failed', or 'skipped'
  response: { ... },     // kwtSMS API response
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
// result.data = { success: true, msgId: '...', balanceAfter: 180 }
```

### OTP verification

```javascript
const handleOtp = httpsCallable(functions, 'ext-kwtsms-firebase-handleOtp');

// Generate and send OTP
await handleOtp({ action: 'sendOtp', phone: '96598765432' });

// Verify OTP code
const result = await handleOtp({
  action: 'verifyOtp',
  phone: '96598765432',
  code: '123456',
});
// result.data = { success: true }
```

OTP codes expire after 5 minutes. Maximum 3 verification attempts per code.

## Templates

The extension seeds 8 default templates on install. Templates support English and Arabic with `{{placeholder}}` replacement.

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

Edit template bodies in the `sms_templates` Firestore collection. System templates can't be deleted but their body text can be changed and reverted to the original.

## Monitoring

- **SMS logs**: `sms_logs` collection in Firestore
- **Balance and sync data**: `sms_config/sync` document
- **Debug logs**: Enable `debug_logging` in settings, then check Cloud Functions logs in Google Cloud Console

## Documentation

- [kwtSMS API docs](https://www.kwtsms.com/integrations.html)
- [kwtSMS JS client library](https://github.com/boxlinknet/kwtsms-js)
- [Firebase Extensions docs](https://firebase.google.com/docs/extensions)

## Support

- kwtSMS support: [kwtsms.com/support.html](https://www.kwtsms.com/support.html)
- Issues: [github.com/boxlinknet/kwtsms-firebase/issues](https://github.com/boxlinknet/kwtsms-firebase/issues)

## License

Apache-2.0
