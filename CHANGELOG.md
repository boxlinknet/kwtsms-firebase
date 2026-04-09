# Changelog

## [1.0.0] - 2026-04-09

### Added
- **Dashboard SPA** (Phase 2): Vite + TypeScript admin panel with 5 pages
  - Dashboard: stat cards (balance, sent today, test mode, gateway status), recent activity, current settings display
  - Settings: gateway toggles, sender ID dropdown, app name, country code, save/discard
  - Templates: list all templates EN/AR, edit modal with language tabs, create/delete custom templates
  - SMS Logs: filters (type, trigger, status, date range), expandable rows, pagination, CSV export
  - Help: code examples, template variables reference, troubleshooting, error codes
  - Send Test SMS form on settings page (follows system test_mode)
- Firebase Auth login with admin custom claim for dashboard access
- Firestore rules updated with `isAdmin()` helper for dashboard read/write
- Emulator support for local development (`?dev` URL param bypasses auth)
- Graceful error handling on all dashboard pages (degrades to defaults)

### Changed (Security Hardening)
- Firestore rules locked down (was `allow read, write: if true`)
- OTP codes hashed with SHA-256 before storage, phone hashed for doc IDs
- Timing-safe OTP comparison (crypto.timingSafeEqual)
- Rate limiting: 10 sends/min per user (callable), 60s OTP cooldown
- Generic error messages in callable/OTP handlers (anti-enumeration)
- Queue handler: input validation, idempotency guard
- Settings cache with 5s TTL (returns shallow copies)
- Configurable APP_NAME extension parameter
- Balance check changed from hard block to warning
- Removed balanceAfter from callable response (admin-only data)

### Testing
- 93 tests total: unit + emulator + E2E + integration (real API, test=1)
- E2E security tests: XSS, SQL injection, path traversal, phone injection, enumeration
- Edge cases: emoji, unicode, Arabic digits, RTL markers

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
