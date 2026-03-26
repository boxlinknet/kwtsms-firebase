# kwtSMS Extension - Setup Complete

## Getting Started

The extension has been installed and configured with your kwtSMS credentials.

### Default Settings

The extension created a `sms_config/settings` document in Firestore with these defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `gateway_enabled` | `true` | Global on/off switch |
| `test_mode` | `true` | SMS sent with test=1 (no delivery, no credits) |
| `debug_logging` | `false` | Verbose Cloud Functions logs |
| `default_country_code` | `965` | Prepended to numbers without country code |
| `selected_sender_id` | `KWT-SMS` | Active sender ID |

**Important:** Test mode is ON by default. Set `test_mode` to `false` in `sms_config/settings` when you are ready for production.

### Send Your First SMS

Write a document to the `${param:SMS_COLLECTION}` collection:

```javascript
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();
await db.collection('${param:SMS_COLLECTION}').add({
  to: '96598765432',
  message: 'Hello from kwtSMS!',
});
```

### Using Templates

Reference a template by name instead of providing message text:

```javascript
await db.collection('${param:SMS_COLLECTION}').add({
  to: '96598765432',
  template: 'order_confirmed',
  templateData: {
    customer_name: 'Ahmad',
    order_id: 'ORD-123',
  },
  language: 'ar',
});
```

### OTP Verification

Use the `handleOtp` callable function:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const handleOtp = httpsCallable(functions, 'ext-${param:EXT_INSTANCE_ID}-handleOtp');

// Send OTP
await handleOtp({ action: 'sendOtp', phone: '96598765432' });

// Verify OTP
const result = await handleOtp({ action: 'verifyOtp', phone: '96598765432', code: '123456' });
```

### Monitoring

- **SMS Logs**: Check the `${param:SMS_LOGS_COLLECTION}` collection in Firestore
- **Balance & Sync**: Check the `sms_config/sync` document
- **Debug Logs**: Enable `debug_logging` in `sms_config/settings`, then check Cloud Functions logs

## Support

- kwtSMS Support: https://www.kwtsms.com/support.html
- kwtSMS API Docs: https://www.kwtsms.com/developers.html
