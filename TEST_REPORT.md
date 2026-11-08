# SEARCH test report

Last validated: 2026-11-08

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

## Not yet run

- Browser end-to-end automation
- Live SMTP delivery to Gmail or another email provider (credentials unavailable)
- Physical Android device workflow
- Real Android device tests
- Supabase integration tests
- Redis integration tests
- Media, calls, notifications, and E2EE tests
