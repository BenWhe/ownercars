-- Add a nullable full_name column to profiles.
-- Additive only: no default, no backfill. Existing rows keep null and fall
-- back to "Hi there" in the publish welcome email until the user sets a name.
alter table public.profiles
  add column if not exists full_name text;
