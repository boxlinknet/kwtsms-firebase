# kwtSMS - SMS Gateway

Use this extension to send SMS messages via the [kwtSMS](https://www.kwtsms.com) gateway from your Firebase project.

## What this extension does

- **Firestore Queue**: Write a document to a Firestore collection and the extension sends it as SMS automatically.
- **Auth Trigger**: Sends a welcome SMS when a new user signs up with a phone number.
- **HTTPS Callable**: Send SMS on demand from your client app.
- **OTP Verification**: Generate and verify one-time passwords via SMS.
- **Scheduled Sync**: Daily sync of balance, sender IDs, and coverage.
- **Templates**: Multilingual message templates (English, Arabic) with placeholder support.

## Before you begin

- You need a [kwtSMS account](https://www.kwtsms.com) with API access enabled.
- You need your kwtSMS API username and password (not your account mobile number).
- For production use, register a private Sender ID on your kwtSMS account. The default `KWT-SMS` sender is for testing only.

## Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Functions
- Cloud Firestore

This extension also uses the kwtSMS API which has its own credit-based pricing. SMS credits are consumed per message sent. Visit [kwtsms.com](https://www.kwtsms.com) for pricing details.

You are responsible for any costs associated with your use of these services.
