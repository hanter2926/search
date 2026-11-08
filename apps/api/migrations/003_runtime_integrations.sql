alter table profiles add column if not exists password_hash text;
update profiles set password_hash = '' where password_hash is null;
alter table profiles alter column password_hash set not null;

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table conversations add column if not exists unread_counts jsonb not null default '{}'::jsonb;
