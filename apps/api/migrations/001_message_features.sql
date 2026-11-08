alter table messages add column if not exists forwarded_from_id uuid references messages(id);
alter table messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table messages add column if not exists delivered_to uuid[] not null default '{}';
alter table messages add column if not exists read_by uuid[] not null default '{}';
alter table messages add column if not exists edited_at timestamptz;
alter table messages add column if not exists deleted_at timestamptz;
alter table messages add column if not exists starred_by uuid[] not null default '{}';
alter table messages add column if not exists pinned boolean not null default false;
alter table conversations add column if not exists unread_counts jsonb not null default '{}'::jsonb;

create index if not exists messages_search_idx on messages using gin (to_tsvector('simple', body));
