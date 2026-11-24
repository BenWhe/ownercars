-- Security PR 6, step 1: stop the public and signed-in database roles reading
-- or changing data they shouldn't. Run AFTER the PR 6 code is live: the site
-- now does every write to these tables on the server.
--
-- Found in the 24 Nov 2026 audit (public key, no login):
--   * every advert in every state was readable (an unrecorded policy), with
--     seller email, postcode, coordinates, registration, DVSA record, tokens
--   * all promo codes were readable
--   * signed-in sellers could set their own advert to published/paid, change
--     seller_email, and give themselves unlimited publish credits
--
-- Policies are rebuilt from scratch on each table (whatever their names), so
-- unrecorded policies like the ones found on messages can't survive.

-- ── adverts ────────────────────────────────────────────────────────────────
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'adverts' loop
    execute format('drop policy %I on public.adverts', p.policyname);
  end loop;
end $$;

alter table public.adverts enable row level security;
alter table public.adverts force row level security;

create policy "Public can view published adverts"
  on public.adverts for select to anon, authenticated
  using (status = 'published');

create policy "Sellers can view their own adverts"
  on public.adverts for select to authenticated
  using (seller_id = auth.uid());

-- No insert/update/delete policies: all advert writes go through the server.
revoke all on public.adverts from anon, authenticated;

-- Public columns only. Not granted: seller_email, postcode, latitude,
-- longitude, registration, lookup_data, paid, promo_code, every stripe_*,
-- payment_*, checkout_* and availability_* column.
grant select (
  id, seller_id, title, price, mileage, description, created_at, status,
  make, model, year, gearbox, body_type, colour, doors, seats, fuel_type,
  battery_range, charging_time, engine_size, engine_power, acceleration,
  fuel_consumption, co2_emissions, tax_per_year, insurance_group, drive_type,
  boot_space, previously_written_off, service_history, mot_expiry,
  recent_maintenance, vehicle_condition, known_faults, included_items,
  reason_for_sale, seller_note, generated_description, updated_at,
  published_at, paused_at, sold_at, is_example, nearest_town
) on public.adverts to anon, authenticated;

-- The payment reconciliation view is for the server only.
do $$
begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'admin_payment_reconciliation') then
    execute 'revoke all on public.admin_payment_reconciliation from anon, authenticated';
  end if;
end $$;

-- ── advert_photos ──────────────────────────────────────────────────────────
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'advert_photos' loop
    execute format('drop policy %I on public.advert_photos', p.policyname);
  end loop;
end $$;

alter table public.advert_photos enable row level security;
alter table public.advert_photos force row level security;

create policy "Public can view photos for published adverts"
  on public.advert_photos for select to anon, authenticated
  using (exists (select 1 from public.adverts a where a.id = advert_photos.advert_id and a.status = 'published'));

create policy "Sellers can view photos for their own adverts"
  on public.advert_photos for select to authenticated
  using (exists (select 1 from public.adverts a where a.id = advert_photos.advert_id and a.seller_id = auth.uid()));

-- The edit page reorders photos directly, so sellers keep sort_order only.
create policy "Sellers can reorder photos for their own adverts"
  on public.advert_photos for update to authenticated
  using (exists (select 1 from public.adverts a where a.id = advert_photos.advert_id and a.seller_id = auth.uid()))
  with check (exists (select 1 from public.adverts a where a.id = advert_photos.advert_id and a.seller_id = auth.uid()));

revoke all on public.advert_photos from anon, authenticated;
grant select on public.advert_photos to anon, authenticated;
grant update (sort_order) on public.advert_photos to authenticated;

-- ── profiles ───────────────────────────────────────────────────────────────
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- Profile writes (name, postcode, publish credits) happen on the server only.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- ── promo_codes, search_alerts, vault_documents ────────────────────────────
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'promo_codes' loop
    execute format('drop policy %I on public.promo_codes', p.policyname);
  end loop;
end $$;
alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon, authenticated;

alter table public.search_alerts enable row level security;
revoke all on public.search_alerts from anon, authenticated;

-- Vault documents are written by the server; sellers may still read their own.
revoke insert, update, delete on public.vault_documents from anon, authenticated;

-- ── Checks: run these after, each should say what's in the comment ─────────
-- Policies left (expect 2 on adverts, 3 on advert_photos, 1 on profiles, 0 on promo_codes):
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('adverts', 'advert_photos', 'profiles', 'promo_codes')
order by tablename, policyname;
