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
- `PATCH /api/contacts/:contactId`
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
- `GET /health/integrations`

Authenticated routes use `Authorization: Bearer <token>`. Socket.IO clients authenticate with `{ auth: { token } }`; the server emits `message:new` and relays `conversation:typing`.

Local development uses the file-backed store in `src/store.ts`. The runtime now detects Supabase, Redis, and SMTP configuration and exposes their actual status through `/health/integrations`. The relational Supabase starting schema is in [schema.sql](./src/schema.sql), with incremental DDL in [migrations/001_message_features.sql](./migrations/001_message_features.sql), [migrations/002_contacts_requests.sql](./migrations/002_contacts_requests.sql), and [migrations/003_runtime_integrations.sql](./migrations/003_runtime_integrations.sql). Apply those SQL files using the Supabase SQL editor or `psql` in deployment. The API still uses the local store for domain operations until the Supabase repository adapter is configured and integration-tested; no external service is claimed active from configuration alone.
