-- Add publish_credits to profiles: an integer balance of free-publish
-- credits a seller can redeem to publish an advert without paying or using
-- a promo code. Additive only — no application code in this migration.
alter table public.profiles
  add column if not exists publish_credits integer not null default 0;

-- Backstop at the database level so the balance can never go negative,
-- even if application-level guards have a bug.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_publish_credits_non_negative'
  ) then
    alter table public.profiles
    add constraint profiles_publish_credits_non_negative check (publish_credits >= 0);
  end if;
end $$;
