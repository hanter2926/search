# SEARCH known issues

- Supabase PostgreSQL is not connected at runtime; local JSON persistence is active.
- Email verification, recovery email delivery, Redis, object storage, push notifications, WebRTC, and E2EE require external providers and credentials.
- The web client currently centers on the authenticated chat workspace; public, settings, admin, group, status, media, and calls pages remain to be implemented.
- Android has shared authentication/chat code but has not been tested on a physical device.
- `npm install` reports transitive Expo dependency audit findings that require dependency upgrades and compatibility review.
