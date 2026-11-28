-- regression-test: supabase/tests/admin_json_content_import.sql
-- 0055: auditable JSON imports for startup and launch records.
create table public.admin_content_import_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('startups','launches','combined')),
  status text not null default 'preview' check (status in ('preview','processing','processed','partial','failed')),
  payload jsonb not null,
  row_count integer not null default 0 check (row_count between 1 and 300),
  imported_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_content_import_batches_created_idx on public.admin_content_import_batches(created_at desc);

create table public.admin_content_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admin_content_import_batches(id) on delete cascade,
  item_type text not null check (item_type in ('startup','launch')),
  import_key text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','imported','failed')),
  entity_id uuid,
  founder_id uuid references public.profiles(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  unique(batch_id,item_type,import_key)
);
create index admin_content_import_items_batch_idx on public.admin_content_import_items(batch_id,created_at);
alter table public.admin_content_import_batches enable row level security;
alter table public.admin_content_import_items enable row level security;
revoke all on public.admin_content_import_batches,public.admin_content_import_items from anon,authenticated;
grant all on public.admin_content_import_batches,public.admin_content_import_items to service_role;
