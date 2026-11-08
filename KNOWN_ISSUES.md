# SEARCH known issues

- Supabase PostgreSQL is not connected to domain operations at runtime; local JSON persistence is active. The health endpoint intentionally reports configured Supabase credentials as `configured_but_unused` until the repository adapter is wired.
- Passwordless OTP is implemented, but real SMTP/Gmail delivery requires `SMTP_URL` and `SMTP_FROM`; `SEARCH_EMAIL_OUTBOX` is available only as an explicit local/test sink. No password recovery/reset system is provided by design.
- The web client currently centers on the authenticated chat workspace; public, settings, admin, group, status, media, and calls pages remain to be implemented.
- Privacy controls currently cover email discovery and incoming message requests; broader presence/profile visibility controls remain pending.
- Groups currently have a tested API/store slice, but group management UI, removal/role controls, and Android group workflow remain incomplete.
- Android has shared authentication/chat code but has not been tested on a physical device.
- `npm install` reports transitive Expo dependency audit findings that require dependency upgrades and compatibility review.
