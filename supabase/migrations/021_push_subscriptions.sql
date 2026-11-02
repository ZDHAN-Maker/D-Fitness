-- 021_push_subscriptions.sql: Storage for Web Push subscriptions (VAPID)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Policies for authenticated users
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Index on user_id
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

