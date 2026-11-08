# SEARCH

SEARCH is a cross-platform messaging platform with a TypeScript shared contract, an Express API, a React web client, and an Expo mobile client.

## Development

```powershell
npm install
npm run typecheck
npm run build
```

Run both clients during development with `npm run dev`. The API listens on `http://localhost:4000` by default and the web client uses `VITE_API_URL` when provided.

The current local development backend persists users, sessions, conversations, and messages to `apps/api/data/search.json` (or `SEARCH_DATA_FILE`). Apply [apps/api/src/schema.sql](./apps/api/src/schema.sql) to Supabase PostgreSQL when configuring a hosted environment. The API intentionally does not claim email verification, push notifications, WebRTC calls, or Signal Protocol encryption until their required external providers and key-management infrastructure are configured.

## Implemented vertical slice

- Email/password registration and login with scrypt password hashing
- Opaque bearer sessions persisted server-side
- Authenticated user discovery by email or account ID
- Direct conversation creation and membership checks
- Persistent message history and message sending
- Socket.IO message delivery and typing-event signaling
- Web and Android-ready authentication/chat clients

## Workspace layout

- `apps/api` - REST API and real-time infrastructure boundary
- `apps/web` - responsive React web client
- `apps/mobile` - Expo React Native application foundation
- `packages/shared` - API contracts and shared validation
