# SEARCH development progress

Last updated: 2026-11-08

## Current task

IMPLEMENTED — passwordless OTP authentication, shared light SEARCH workspace theme, and expiring logout-capable sessions; next task is the Supabase repository adapter.

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

## Current phase

Passwordless OTP authentication is implemented and tested with the explicit local test outbox. Production delivery remains dependent on SMTP credentials. Existing profiles are reused by normalized email and legacy profile data is not overwritten. The refreshed theme was visually inspected at 1440px and 390px widths; authenticated workspace visual inspection remains pending a verified account session. Domain operations still use the local store. The next phase is a formal persistence interface with a Supabase implementation selected by environment.

## Persistence audit

- **Active runtime store:** `apps/api/src/store.ts` persists to `apps/api/data/search.json` (or `SEARCH_DATA_FILE`). The current API does not connect to Supabase PostgreSQL.
- **Lifecycle persistence:** edits, deletions, stars, pins, replies, forwards, reactions, receipt arrays, and unread counters are persisted in the local JSON store.
- **Supabase schema:** [apps/api/src/schema.sql](./apps/api/src/schema.sql) and [apps/api/migrations/001_message_features.sql](./apps/api/migrations/001_message_features.sql) contain executable PostgreSQL DDL, but they have not been applied by this workspace because no Supabase URL, credentials, or PostgreSQL migration runner is configured.
- **Integration health:** `/health/integrations` was tested without external credentials and correctly returned `local` / `not_configured` for Supabase, Redis, and email. If Supabase credentials are later supplied before the repository adapter exists, the endpoint reports `configured_but_unused` rather than claiming domain persistence.
- **Authorization:** message history, creation, lifecycle mutation, reactions, receipts, forwarding, search, and unread clearing all require a valid session and conversation membership. Sender-only edit/delete checks remain enforced.
- **Real-time:** authenticated Socket.IO clients join authorized conversation rooms. `message:new`, `message:updated`, `message:receipt`, and typing events are covered by the integration workflow.
- **Deleted messages:** history and real-time clients retain the message record with `deletedAt` and render `Message deleted`; search excludes deleted content.

## Explicitly pending external integrations

These are not claimed as active until providers and credentials are configured:

- Supabase production data access and row-level security deployment
- Email verification and recovery delivery
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

Exact next task: define the persistence repository contract, implement the local adapter behind it, and add a credential-gated Supabase adapter test without changing the active local default.

The API integration test additionally exercises pending registration, OTP extraction only from the isolated test outbox, verification, and activation.
