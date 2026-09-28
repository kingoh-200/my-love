-- ============================================================
--  Run this ENTIRE file in: Supabase → SQL Editor → New query
--  (Copy everything in this file — nothing else.)
-- ============================================================

create table if not exists answers (
  id bigint generated always as identity primary key,
  accepted boolean not null,
  reason text not null default '',
  person text not null default '',
  date_text text not null default '',
  time_text text not null default '',
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- For databases created before these columns existed:
alter table answers add column if not exists date_text text not null default '';
alter table answers add column if not exists time_text text not null default '';
alter table answers add column if not exists person text not null default '';

alter table answers enable row level security;

drop policy if exists "allow anonymous inserts" on answers;
create policy "allow anonymous inserts"
  on answers for insert
  to anon
  with check (true);

drop policy if exists "allow anonymous reads" on answers;
create policy "allow anonymous reads"
  on answers for select
  to anon
  using (true);

drop policy if exists "allow anonymous updates" on answers;
create policy "allow anonymous updates"
  on answers for update
  to anon
  using (true)
  with check (true);
