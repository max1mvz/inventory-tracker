-- ============================================================================
-- Migration 0002 — user profiles & roles (enables the in-app admin panel and
-- real names in the audit trail).
--
-- Run in Supabase → SQL Editor after the first migration.
-- ============================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user can READ profiles (so the app can show who did what).
-- Writes happen only via the trigger below and the admin Edge Function (which
-- uses the service role and bypasses RLS) — so there is no client write policy.
grant select on public.profiles to authenticated;

create policy "profiles: readable by team"
  on public.profiles for select
  to authenticated
  using (true);

-- Auto-create a profile whenever an auth user is created. The very first user
-- in the system becomes the owner; everyone else starts as a member.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when is_first then 'owner' else 'member' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who already existed before this migration.
insert into public.profiles (id, email, role)
select u.id, u.email, 'member'
from auth.users u
on conflict (id) do nothing;

-- Make sure there is at least one owner: promote the earliest account.
update public.profiles
set role = 'owner'
where id = (select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role in ('owner', 'admin'));
