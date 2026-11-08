# SEARCH API

The API currently provides the working local messaging vertical slice:

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-email`
- `POST /api/auth/logout`
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

Authentication is passwordless and OTP-only. `POST /api/auth/request-otp` creates or replaces a pending five-minute code; `POST /api/auth/verify-email` signs in an existing normalized email identity or creates a new profile after successful verification. Codes are hashed, one-time, rate-limited, and never returned or logged. Configure `SMTP_URL` and `SMTP_FROM` for delivery. `SEARCH_EMAIL_OUTBOX` is an explicit local/test mail sink. Existing `password_hash` columns are retained only for backward-compatible data preservation and are not used by authentication; the old password routes return `410 Gone`. Sessions expire after 30 days and can be revoked with logout. The runtime detects Supabase, Redis, and SMTP configuration and exposes their actual status through `/health/integrations`. The relational Supabase starting schema is in [schema.sql](./src/schema.sql), with incremental DDL in [migrations/001_message_features.sql](./migrations/001_message_features.sql), [migrations/002_contacts_requests.sql](./migrations/002_contacts_requests.sql), [migrations/003_runtime_integrations.sql](./migrations/003_runtime_integrations.sql), and [migrations/004_email_verification.sql](./migrations/004_email_verification.sql).
