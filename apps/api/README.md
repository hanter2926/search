# SEARCH API

The API currently provides the working local messaging vertical slice:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/users?q=...`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/read`
- `GET /api/contacts`
- `GET /api/message-requests`
- `POST /api/message-requests`
- `POST /api/message-requests/:requestId/accept`
- `POST /api/message-requests/:requestId/reject`
- `GET /api/search/messages?q=...`
- `PATCH /api/messages/:messageId`
- `DELETE /api/messages/:messageId`
- `POST /api/messages/:messageId/star`
- `POST /api/messages/:messageId/pin`
- `POST /api/messages/:messageId/reactions`
- `POST /api/messages/:messageId/delivered`
- `POST /api/messages/:messageId/read`
- `POST /api/messages/:messageId/forward`
- `GET /health`

Authenticated routes use `Authorization: Bearer <token>`. Socket.IO clients authenticate with `{ auth: { token } }`; the server emits `message:new` and relays `conversation:typing`.

Local development uses the file-backed store in `src/store.ts`. The relational Supabase starting schema is in [schema.sql](./src/schema.sql), with incremental DDL in [migrations/001_message_features.sql](./migrations/001_message_features.sql). Apply those SQL files using the Supabase SQL editor or `psql` in deployment; this repository does not claim that Supabase is active until credentials and a PostgreSQL adapter are configured. Before production use, replace the local store with Supabase transactions and configure email delivery, object storage, Redis, push notifications, WebRTC signaling/media infrastructure, and audited Signal-compatible key management.
