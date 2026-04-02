# Changelog

## [0.1.0] - 2026-03-27

### Added
- Firestore queue trigger for SMS sending
- Auth trigger for welcome SMS on new user signup
- HTTPS callable for on-demand SMS
- OTP generation and verification callable with enumeration protection
- Scheduled daily sync (balance, sender IDs, coverage)
- Install lifecycle: seeds settings, 8 multilingual templates, runs first sync
- Multilingual template system (English, Arabic) with `{{placeholder}}` replacement
- Phone normalization with country code prepend
- Firestore audit logging + Cloud Functions debug logging
- Test mode on by default (kwtSMS test=1)
- 33 tests: unit + integration with real kwtSMS API

### Changed
- Runtime upgraded from nodejs18 to nodejs20
- Added LICENSE (Apache 2.0), icon.png, externalServices, tags to extension manifest
- Three install methods: GitHub, Extensions Hub, local source
