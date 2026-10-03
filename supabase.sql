-- Run this entire script in Supabase: SQL Editor -> New query -> Run.
-- Safe to rerun: existing tables, columns, policies, and date ideas are preserved.

-- Answers submitted by visitors.
create table if not exists public.answers (
  id bigint generated always as identity primary key,
  accepted boolean not null,
  reason text not null default '',
  person text not null default '',
  date_text text not null default '',
  time_text text not null default '',
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.answers add column if not exists date_text text not null default '';
alter table public.answers add column if not exists time_text text not null default '';
alter table public.answers add column if not exists person text not null default '';
alter table public.answers enable row level security;
grant usage on schema public to anon;
grant usage, select on all sequences in schema public to anon;
grant select, insert, update, delete on public.answers to anon;

drop policy if exists "allow anonymous inserts" on public.answers;
create policy "allow anonymous inserts" on public.answers
  for insert to anon with check (true);

drop policy if exists "allow anonymous reads" on public.answers;
create policy "allow anonymous reads" on public.answers
  for select to anon using (true);

drop policy if exists "allow anonymous updates" on public.answers;
create policy "allow anonymous updates" on public.answers
  for update to anon using (true) with check (true);

drop policy if exists "allow anonymous deletes" on public.answers;
create policy "allow anonymous deletes" on public.answers
  for delete to anon using (true);

-- Personalized links and their selected date ideas.
create table if not exists public.invites (
  id bigint generated always as identity primary key,
  name text not null unique,
  idea_labels jsonb,
  created_at timestamptz not null default now()
);

alter table public.invites add column if not exists idea_labels jsonb;
alter table public.invites enable row level security;
grant select, insert, delete on public.invites to anon;

drop policy if exists "allow anonymous invite reads" on public.invites;
create policy "allow anonymous invite reads" on public.invites
  for select to anon using (true);

drop policy if exists "allow anonymous invite inserts" on public.invites;
create policy "allow anonymous invite inserts" on public.invites
  for insert to anon with check (true);

drop policy if exists "allow anonymous invite deletes" on public.invites;
create policy "allow anonymous invite deletes" on public.invites
  for delete to anon using (true);

-- Admin-managed date ideas.
create table if not exists public.ideas (
  id bigint generated always as identity primary key,
  label text not null unique,
  created_at timestamptz not null default now()
);

alter table public.ideas enable row level security;
grant select, insert, delete on public.ideas to anon;

drop policy if exists "allow anonymous idea reads" on public.ideas;
create policy "allow anonymous idea reads" on public.ideas
  for select to anon using (true);

drop policy if exists "allow anonymous idea inserts" on public.ideas;
create policy "allow anonymous idea inserts" on public.ideas
  for insert to anon with check (true);

drop policy if exists "allow anonymous idea deletes" on public.ideas;
create policy "allow anonymous idea deletes" on public.ideas
  for delete to anon using (true);

-- Seed defaults only when the ideas table is empty; preserve an existing
-- admin-curated list, including one from which defaults were removed.
insert into public.ideas (label)
select defaults.label
from (values
  ('Coffee ☕'),
  ('Dinner 🍝'),
  ('A movie 🎬'),
  ('Stargazing 🌌'),
  ('Ice cream 🍦')
) as defaults(label)
where not exists (select 1 from public.ideas)
on conflict (label) do nothing;

-- Make newly created/altered tables visible immediately to the REST API.
notify pgrst, 'reload schema';
