alter table profiles
  add column if not exists discoverable_by_email boolean not null default true,
  add column if not exists allow_message_requests boolean not null default true;
