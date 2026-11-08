# SEARCH development progress

Last updated: 2026-11-08

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
- Message request creation, listing, acceptance, and rejection
- Server-enforced request gate before direct conversations

## Current phase

Message lifecycle and conversation usability is complete for the active local development store. Contacts and message requests are now implemented in the local development store; the next phase is contact custom names, richer discovery, and account privacy controls.

## Persistence audit

- **Active runtime store:** `apps/api/src/store.ts` persists to `apps/api/data/search.json` (or `SEARCH_DATA_FILE`). The current API does not connect to Supabase PostgreSQL.
- **Lifecycle persistence:** edits, deletions, stars, pins, replies, forwards, reactions, receipt arrays, and unread counters are persisted in the local JSON store.
- **Supabase schema:** [apps/api/src/schema.sql](./apps/api/src/schema.sql) and [apps/api/migrations/001_message_features.sql](./apps/api/migrations/001_message_features.sql) contain executable PostgreSQL DDL, but they have not been applied by this workspace because no Supabase URL, credentials, or PostgreSQL migration runner is configured.
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
