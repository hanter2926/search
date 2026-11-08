# SEARCH development progress

Last updated: 2026-11-08

## Current task

IN PROGRESS — group conversations, membership permissions, and group messaging; contacts and privacy controls are tested.

## Preview URLs

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

The web preview is not visually verified until the integrated browser inspection is complete.

## Latest preview verification

- `VISUALLY VERIFIED` — landing, about, features, help, and login sections rendered at desktop width in the integrated browser.
- `VISUALLY VERIFIED` — same public/auth surface rendered at a 390px mobile viewport with responsive content.
- `TESTED` — API health at `http://localhost:4000/health`.
- `RUNNING` — Vite at `http://localhost:5173/`.
- `RUNNING` — API watcher at `http://localhost:4000/`.
- `RUNNING` — Expo Metro at `http://localhost:8081/` for LAN device testing.

## Completed

- TypeScript workspace with shared contracts
- Express API foundation with security headers and health check
- Local persistent development store
- Password-hashed registration and login
- Opaque bearer sessions
- Authenticated user discovery
- Direct conversations and membership checks
- Persistent messaging and Socket.IO delivery
- Web and Expo authentication/chat clients
- Message lifecycle controls: edit, delete, star, and pin
- Server-side message authorization and validation
- Supabase-compatible message schema fields
- API lifecycle integration test
- Authorization regression test proving another participant cannot edit a message
- Message replies with persisted references
- Message forwarding with source references
- Emoji reaction add/remove
- Delivery and read receipts
- Per-user unread counts and read clearing
- Authenticated message search
- Two-client Socket.IO integration coverage
- Contact records and bidirectional accepted-contact relationships
- Private custom contact names with owner-scoped persistence
- Message request creation, listing, acceptance, and rejection
- Server-enforced request gate before direct conversations
- Public landing/about/features/help sections with working anchor navigation
- Live development workflow with Vite, API watcher, and Expo Metro
- Desktop online-now strip and mobile chat-list/navigation treatment based on supplied visual references
- Clean browser reload/HMR root mounting guard
- Runtime integration health boundary for Supabase, Redis, and SMTP configuration
- Email ownership verification with hashed six-digit OTPs, expiry, resend cooldown, attempt limits, SMTP delivery, and test outbox
- Passwordless existing-user recovery/new-user creation by normalized email, atomic per-email OTP locking, and legacy password routes returning 410
- Web and Android email -> OTP authentication flow
- Android Expo entrypoint and Android bundle export validated; physical-device verification remains external
- Shared responsive light theme for authentication and the two-panel messaging workspace

## SMTP verification (2026-11-08)

- `TESTED` — `apps/api/.env` exists, is Git-ignored, and the API loaded its required keys without exposing values.
- `TESTED` — API restarted with the local environment.
- `TESTED` — Nodemailer SMTP `verify()` succeeded on Gmail port 587 with STARTTLS.
- `TESTED` — `/health/integrations` reported `email: "configured"`.
- `TESTED` — Real OTP request returned HTTP `202`.
- `TESTED` — OTP arrived in the real Gmail inbox and verification returned HTTP `201`.
- `TESTED` — The server reported `existingAccount: false`; a new account was created without modifying existing user data.
- `IMPLEMENTED` — Gmail SMTP delivery is operationally verified for this environment.

## Contacts privacy controls (2026-11-08)

- `TESTED` — Added persisted per-user `discoverableByEmail` and `allowMessageRequests` settings with permissive defaults for existing users.
- `TESTED` — Added authenticated `GET/PATCH /api/privacy` endpoints with boolean validation.
- `TESTED` — Email discovery respects the target user's privacy setting.
- `TESTED` — Message request creation rejects recipients who disabled requests.
- `TESTED` — Added PostgreSQL migration `005_privacy_controls.sql` and matching baseline schema fields.
- `TESTED` — Web authenticated shell exposes controls for email discoverability and message requests.
- `TESTED` — API lifecycle and OTP integration tests pass with privacy isolation coverage.

## Groups and group messaging (2026-11-08)

- `IMPLEMENTED` — Added persisted group records and group membership data in the local store.
- `IMPLEMENTED` — Added `POST/GET /api/groups` and admin-gated `POST /api/groups/:groupId/members`.
- `TESTED` — Group members can use the existing conversation message endpoint; non-members remain blocked by conversation membership authorization.
- `IMPLEMENTED` — Added baseline schema and migration `006_groups.sql`.
- `IN PROGRESS` — Group management controls and group-specific responsive web/mobile surfaces remain.

## Current phase

Passwordless OTP authentication and Gmail SMTP delivery are implemented and tested. Existing profiles are reused by normalized email and legacy profile data is not overwritten. Contacts and privacy controls are tested at the API level; authenticated workspace visual inspection remains pending a browser session. Domain operations still use the local store. The next product task is groups and group permissions.

## Persistence audit

- **Active runtime store:** `apps/api/src/store.ts` persists to `apps/api/data/search.json` (or `SEARCH_DATA_FILE`). The current API does not connect to Supabase PostgreSQL.
- **Lifecycle persistence:** edits, deletions, stars, pins, replies, forwards, reactions, receipt arrays, and unread counters are persisted in the local JSON store.
- **Supabase schema:** [apps/api/src/schema.sql](./apps/api/src/schema.sql) and [apps/api/migrations/001_message_features.sql](./apps/api/migrations/001_message_features.sql) contain executable PostgreSQL DDL, but they have not been applied by this workspace because no Supabase URL, credentials, or PostgreSQL migration runner is configured.
- **Integration health:** `/health/integrations` reports local persistence, unconfigured Supabase/Redis, and configured email. Gmail SMTP connectivity and real inbox OTP verification are now complete.
- **Authorization:** message history, creation, lifecycle mutation, reactions, receipts, forwarding, search, and unread clearing all require a valid session and conversation membership. Sender-only edit/delete checks remain enforced.
- **Real-time:** authenticated Socket.IO clients join authorized conversation rooms. `message:new`, `message:updated`, `message:receipt`, and typing events are covered by the integration workflow.
- **Deleted messages:** history and real-time clients retain the message record with `deletedAt` and render `Message deleted`; search excludes deleted content.

## Explicitly pending external integrations

These are not claimed as active until providers and credentials are configured:

- Supabase production data access and row-level security deployment
- Email verification and recovery delivery (Gmail SMTP operationally verified)
- Redis presence/rate limiting
- Object storage and media processing
- Push notifications
- WebRTC calling
- Signal-compatible end-to-end encryption key management
- Android camera, microphone, file picker, and production signing

## Validation

Validated:

```powershell
npm run typecheck       # passed
npm run build           # passed
npm run test:api        # passed
```

The API integration test also asserts the no-credential integration-health response.

Exact next task: add group management controls to the web/Expo clients and expand group authorization coverage before marking groups tested.

The API integration test additionally exercises pending registration, OTP extraction only from the isolated test outbox, verification, and activation.
