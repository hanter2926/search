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
