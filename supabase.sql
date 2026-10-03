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

drop policy if exists "allow anonymous deletes" on answers;
create policy "allow anonymous deletes"
  on answers for delete
  to anon
  using (true);

-- ============================================================
--  Invites: only names created in the admin dashboard resolve;
--  hand-edited /i/Name URLs show "not found".
-- ============================================================

create table if not exists invites (
  id bigint generated always as identity primary key,
  name text not null unique,
  idea_labels jsonb,
  created_at timestamptz not null default now()
);

alter table invites add column if not exists idea_labels jsonb;

alter table invites enable row level security;

-- Public may only CHECK a name exists (read), never create or delete.
drop policy if exists "allow anonymous invite reads" on invites;
create policy "allow anonymous invite reads"
  on invites for select
  to anon
  using (true);

drop policy if exists "allow anonymous invite inserts" on invites;
create policy "allow anonymous invite inserts"
  on invites for insert
  to anon
  with check (true);

drop policy if exists "allow anonymous invite deletes" on invites;
create policy "allow anonymous invite deletes"
  on invites for delete
  to anon
  using (true);

-- ============================================================
--  Date ideas: the celebration chips she picks from after a Yes.
--  The five defaults below are seeded automatically on first use;
--  add/remove them any time from the admin dashboard.
-- ============================================================

create table if not exists ideas (
  id bigint generated always as identity primary key,
  label text not null unique,
  created_at timestamptz not null default now()
);

alter table ideas enable row level security;

-- Public only needs to READ the chip labels (served through the API).
drop policy if exists "allow anonymous idea reads" on ideas;
create policy "allow anonymous idea reads"
  on ideas for select
  to anon
  using (true);

drop policy if exists "allow anonymous idea inserts" on ideas;
create policy "allow anonymous idea inserts"
  on ideas for insert
  to anon
  with check (true);

drop policy if exists "allow anonymous idea deletes" on ideas;
create policy "allow anonymous idea deletes"
  on ideas for delete
  to anon
  using (true);
