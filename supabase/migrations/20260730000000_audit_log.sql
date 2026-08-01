-- ============================================================================
-- Inventory Tracker — audit trail for catalog changes
-- Migration 0008 (audit log)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- Stock movements are ALREADY a complete audit trail: `movements` is append-only
-- and every row carries user_id (defaulted from auth.uid() and enforced by RLS,
-- so it can't be forged). What was missing is a record of CATALOG changes — who
-- renamed a product, changed a price or reorder point, or deleted an item.
--
-- This is captured with database TRIGGERS rather than app code, so it records
-- every change no matter where it came from (app, SQL editor, another client)
-- and can never be "forgotten" by a future code path.
-- ============================================================================

create table if not exists public.audit_log (
  id          bigserial primary key,
  table_name  text        not null,
  record_id   text        not null,          -- the product barcode
  action      text        not null check (action in ('insert', 'update', 'delete')),
  actor_id    uuid,                          -- null = changed outside a user session (e.g. SQL editor)
  changed     jsonb,                         -- {field: {from, to}} on update; the row on insert/delete
  created_at  timestamptz not null default now()
);

comment on table public.audit_log is
  'Who changed what in the catalog. Written only by triggers; read-only to clients.';

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_record_idx  on public.audit_log (record_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Trigger: record every products INSERT / UPDATE / DELETE.
-- SECURITY DEFINER so it can write to audit_log even though clients cannot.
-- ----------------------------------------------------------------------------
create or replace function public.audit_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_j jsonb;
  old_j jsonb;
  diff  jsonb := '{}'::jsonb;
  k     text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, actor_id, changed)
    values ('products', new.barcode, 'insert', auth.uid(),
            jsonb_build_object('name', new.name, 'category', new.category));
    return new;

  elsif tg_op = 'UPDATE' then
    new_j := to_jsonb(new);
    old_j := to_jsonb(old);
    -- Record only the fields that actually changed, as {field: {from, to}}.
    for k in select jsonb_object_keys(new_j) loop
      if new_j -> k is distinct from old_j -> k then
        diff := diff || jsonb_build_object(
          k, jsonb_build_object('from', old_j -> k, 'to', new_j -> k)
        );
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;                                   -- a no-op save; nothing to log
    end if;
    insert into public.audit_log (table_name, record_id, action, actor_id, changed)
    values ('products', new.barcode, 'update', auth.uid(), diff);
    return new;

  else -- DELETE
    insert into public.audit_log (table_name, record_id, action, actor_id, changed)
    values ('products', old.barcode, 'delete', auth.uid(),
            jsonb_build_object('name', old.name, 'category', old.category));
    return old;
  end if;
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function public.audit_products();

-- ----------------------------------------------------------------------------
-- RLS: the team can READ the trail. Nobody can write, update, or delete it from
-- a client — only the SECURITY DEFINER trigger above writes here, which keeps
-- the trail trustworthy.
-- ----------------------------------------------------------------------------
alter table public.audit_log enable row level security;

grant select on public.audit_log to authenticated;

drop policy if exists "audit: team can read" on public.audit_log;
create policy "audit: team can read"
  on public.audit_log for select
  to authenticated
  using (true);
