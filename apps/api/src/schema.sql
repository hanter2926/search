create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  handle text unique not null,
  display_name text not null,
  about text not null default '',
  discoverable_by_email boolean not null default true,
  allow_message_requests boolean not null default true,
  avatar_url text,
  presence text not null default 'offline' check (presence in ('online', 'away', 'offline')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  unread_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  conversation_id uuid unique not null references conversations(id) on delete cascade,
  admins uuid[] not null,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (group_id, user_id)
);

create table if not exists conversation_members (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  unread_count integer not null default 0,
  primary key (conversation_id, user_id)
);

create table if not exists contacts (
  owner_id uuid references profiles(id) on delete cascade,
  contact_id uuid references profiles(id) on delete cascade,
  custom_name text,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);

create table if not exists message_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid references profiles(id) on delete cascade,
  to_id uuid references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

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

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete restrict,
  body text not null check (length(body) between 1 and 10000),
  reply_to_id uuid references messages(id),
  forwarded_from_id uuid references messages(id),
  status text not null default 'sent' check (status in ('sent', 'delivered', 'read')),
  edited_at timestamptz,
  deleted_at timestamptz,
  starred_by uuid[] not null default '{}',
  pinned boolean not null default false,
  reactions jsonb not null default '{}'::jsonb,
  delivered_to uuid[] not null default '{}',
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at);
create index if not exists profiles_email_idx on profiles(lower(email));
