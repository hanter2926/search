# SEARCH test report

Last validated: 2026-11-08

## Passing checks

- `npm run typecheck`
- `npm run build`
- `npm run test:api`
- API health endpoint through the live preview server
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
- Real Android device tests
- Supabase integration tests
- Redis integration tests
- Media, calls, notifications, and E2EE tests
