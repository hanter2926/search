# SEARCH master task list

Status values: `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`, `TESTED`, `VISUALLY VERIFIED`, `BLOCKED BY EXTERNAL REQUIREMENT`.

## Foundation

- [TESTED] TypeScript workspace and shared contracts
- [TESTED] Express API security foundation
- [TESTED] Local persistent development store
- [TESTED] Web and Expo client foundations

## Messaging

- [TESTED] Passwordless OTP authentication and expiring sessions
- [TESTED] Direct conversations and message requests
- [TESTED] Send/receive messages and Socket.IO delivery
- [TESTED] Replies, forwarding, reactions, editing, deletion, star, pin
- [TESTED] Delivery/read receipts and unread counts
- [TESTED] Message and conversation search

## User and communication features

- [IN PROGRESS] Contacts, custom contact names, privacy controls
- [NOT STARTED] Groups and group permissions
- [NOT STARTED] Status/stories
- [NOT STARTED] Media and document sharing
- [IMPLEMENTED] Email OTP verification and account activation; real SMTP delivery remains externally blocked
- [BLOCKED BY EXTERNAL REQUIREMENT] Push notifications
- [BLOCKED BY EXTERNAL REQUIREMENT] WebRTC audio/video calling
- [BLOCKED BY EXTERNAL REQUIREMENT] Audited Signal-compatible E2EE key service

## Product surfaces

- [IN PROGRESS] Responsive authenticated web shell
- [NOT STARTED] Public marketing pages
- [NOT STARTED] Authentication recovery pages
- [NOT STARTED] Settings, devices, privacy, security, notifications
- [NOT STARTED] Admin panel and moderation
- [TESTED] Android OTP authentication bundle and shared chat workflow; physical-device verification pending

## Infrastructure

- [IMPLEMENTED] Supabase-compatible SQL schema and migrations
- [BLOCKED BY EXTERNAL REQUIREMENT] Supabase runtime adapter and credentials
- [BLOCKED BY EXTERNAL REQUIREMENT] Redis runtime and deployment configuration
- [NOT STARTED] Production deployment manifests
