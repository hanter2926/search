create table if not exists pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  handle text,
  password_hash text,
  otp_hash text not null,
  otp_expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pending_registrations_expiry_idx
  on pending_registrations(otp_expires_at);

alter table pending_registrations alter column display_name drop not null;
alter table pending_registrations alter column handle drop not null;
alter table pending_registrations alter column password_hash drop not null;
