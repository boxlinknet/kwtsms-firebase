# kwtSMS Firebase Extension

Send SMS notifications, OTP codes, and alerts via the kwtSMS gateway from your Firebase project.

## Features

- Firestore-based SMS queue: write a document, SMS is sent automatically
- Auth trigger: send welcome SMS on new user signup
- HTTPS callable: send SMS on demand from your client app
- OTP verification: generate and verify OTP codes
- Scheduled sync: daily balance, sender ID, and coverage sync
- Multilingual templates: English and Arabic with placeholder support
- Full logging: Firestore audit trail + Cloud Functions debug logs

## Installation

```bash
firebase ext:install kwtsms/kwtsms-firebase --project=YOUR_PROJECT
```

## Configuration

During installation, provide your kwtSMS API credentials. After install, configure settings in the `sms_config/settings` Firestore document.

## Usage

### Send SMS via Firestore Queue

Write a document to the `sms_queue` collection:

```javascript
await db.collection('sms_queue').add({
  to: '96598765432',
  message: 'Hello from Firebase!',
});
```

### Send SMS via Callable

```javascript
const sendSms = httpsCallable(functions, 'ext-kwtsms-firebase-sendSms');
const result = await sendSms({
  action: 'send',
  to: '96598765432',
  template: 'order_confirmed',
  templateData: { customer_name: 'Ahmad', order_id: 'ORD-123' },
  language: 'ar',
});
```

## Documentation

- [kwtSMS API Documentation](https://www.kwtsms.com/developers.html)
- [Firebase Extensions](https://firebase.google.com/docs/extensions)

## Support

- kwtSMS Support: https://www.kwtsms.com/support.html
