# SEARCH architecture

## Current runtime

- `apps/api`: Express and Socket.IO API with server-side authorization.
- `apps/web`: React/Vite browser client.
- `apps/mobile`: Expo React Native client.
- `packages/shared`: shared message, user, contact, and request contracts.
- `apps/api/src/store.ts`: file-backed local development persistence selected by `SEARCH_DATA_FILE`.

## Persistence boundary

The local store is the only active runtime persistence implementation. PostgreSQL DDL is prepared in `apps/api/src/schema.sql` and incremental migrations are in `apps/api/migrations/`, but Supabase is not connected until credentials and a database adapter are configured.

## Realtime

Authenticated Socket.IO connections are authorized by bearer session tokens and joined only to conversation rooms the user belongs to. Message creation, lifecycle changes, and receipts are broadcast to those rooms.

## Security

Passwords use Node `scrypt`; sessions use opaque random bearer tokens; API routes validate session ownership and conversation membership; sender-only operations are enforced server-side.

## Planned production boundaries

Supabase transactions, Redis presence/rate limiting, object storage, email delivery, push notifications, WebRTC signaling, and audited E2EE key management remain explicit integration boundaries rather than mocked implementations.
