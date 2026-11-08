# SEARCH test report

Last validated: 2026-11-08

## SMTP verification

- `apps/api/.env` was present and contained the required SMTP keys; its contents were not displayed.
- Git confirmed `apps/api/.env` is ignored.
- The API was restarted and loaded the local environment successfully.
- `/health/integrations` reported `email: "configured"`. This is configuration detection only.
- After network connectivity was restored, Nodemailer `verify()` succeeded using the configured Gmail STARTTLS transport.
- `POST /api/auth/request-otp` returned HTTP `202` for the configured Gmail address.
- The OTP was received in the real Gmail inbox and verified through `POST /api/auth/verify-email`.
- OTP verification returned HTTP `201` with `existingAccount: false`; a new account was created for the previously unregistered normalized email.
- No SMTP credentials, OTP, or session token were logged or returned in the test output.
- Gmail SMTP delivery is operational for this environment. The earlier port 587 timeout was a network egress restriction, not an authentication failure.

## Passing checks

- `npm run typecheck`
- `npm run build`
- `npm run test:api`
- API health endpoint through the live preview server
- `/health/integrations` reports local persistence and unconfigured external providers
- Supabase configuration cannot be mistaken for active domain persistence (`configured_but_unused` is reserved for the adapter gap)
- Pending registration, OTP verification, resend-capable workflow, and post-verification activation
- Passwordless OTP: new account, same-email account reuse, wrong-code rejection, resend cooldown, deprecated password-route rejection, and separate-account isolation
- Web production build includes the refreshed responsive theme
- Android Expo export produced an Android Hermes bundle after adding the mobile entrypoint
- Landing/auth page rendering through the integrated browser
- Mobile viewport rendering through Playwright viewport inspection
- Two authenticated Socket.IO clients receiving a message event
- Registration, message requests, accepted contacts, direct conversation creation
- Message edit/delete/star/pin
- Replies and forwarding
- Reaction add/remove
- Delivery and read receipts
- Unread clearing
- Authenticated message search
- API authorization regression cases
- Contact privacy controls: persisted settings, hidden email discovery, and blocked message requests
- Group API slice: persisted group creation/listing and member message access

## Not yet run

- Browser end-to-end automation
- Live SMTP delivery to Gmail (SMTP credentials are configured, but outbound port 587 currently times out)
- Physical Android device workflow
- Real Android device tests
- Supabase integration tests
- Group management UI and physical Android group workflow
- Redis integration tests
- Media, calls, notifications, and E2EE tests
