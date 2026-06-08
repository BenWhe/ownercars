-- Add location fields to adverts (seller location — nearest town shown publicly, postcode never shown)
alter table public.adverts
  add column if not exists postcode text,
  add column if not exists latitude float8,
  add column if not exists longitude float8,
  add column if not exists nearest_town text;

-- Buyer location profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  postcode text,
  latitude float8,
  longitude float8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users manage own profile"
  on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());
