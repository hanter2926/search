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

create index if not exists message_requests_recipient_idx on message_requests(to_id, status);
