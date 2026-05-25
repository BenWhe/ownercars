-- OC-03: enforce advert ownership at the Supabase data layer.
-- Public users may read live adverts/photos; only the seller who owns an advert
-- may manage drafts, unpublished listings, photos, and lifecycle updates.

alter table public.adverts enable row level security;
alter table public.adverts force row level security;

alter table public.advert_photos enable row level security;
alter table public.advert_photos force row level security;

drop policy if exists "Public can view live adverts" on public.adverts;
create policy "Public can view live adverts"
on public.adverts
for select
to anon, authenticated
using (status = 'live');

drop policy if exists "Sellers can view their own adverts" on public.adverts;
create policy "Sellers can view their own adverts"
on public.adverts
for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "Sellers can create their own adverts" on public.adverts;
create policy "Sellers can create their own adverts"
on public.adverts
for insert
to authenticated
with check (seller_id = auth.uid());

drop policy if exists "Sellers can update their own adverts" on public.adverts;
create policy "Sellers can update their own adverts"
on public.adverts
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "Sellers can delete their own adverts" on public.adverts;
create policy "Sellers can delete their own adverts"
on public.adverts
for delete
to authenticated
using (seller_id = auth.uid());

drop policy if exists "Public can view photos for live adverts" on public.advert_photos;
create policy "Public can view photos for live adverts"
on public.advert_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.status = 'live'
  )
);

drop policy if exists "Sellers can view photos for their own adverts" on public.advert_photos;
create policy "Sellers can view photos for their own adverts"
on public.advert_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.seller_id = auth.uid()
  )
);

drop policy if exists "Sellers can add photos to their own adverts" on public.advert_photos;
create policy "Sellers can add photos to their own adverts"
on public.advert_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.seller_id = auth.uid()
  )
);

drop policy if exists "Sellers can update photos for their own adverts" on public.advert_photos;
create policy "Sellers can update photos for their own adverts"
on public.advert_photos
for update
to authenticated
using (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.seller_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.seller_id = auth.uid()
  )
);

drop policy if exists "Sellers can delete photos for their own adverts" on public.advert_photos;
create policy "Sellers can delete photos for their own adverts"
on public.advert_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.seller_id = auth.uid()
  )
);

-- Storage objects are managed separately from advert_photos rows. Keep photo
-- uploads/removals scoped to the advert owner by requiring the object path to
-- begin with the advert id (the app stores files as <advertId>/<filename>).
alter table storage.objects enable row level security;

drop policy if exists "Public can read advert photo objects" on storage.objects;
create policy "Public can read advert photo objects"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'advert-photos');

drop policy if exists "Sellers can upload photo objects for their own adverts" on storage.objects;
create policy "Sellers can upload photo objects for their own adverts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'advert-photos'
  and exists (
    select 1
    from public.adverts
    where adverts.id::text = (storage.foldername(name))[1]
      and adverts.seller_id = auth.uid()
  )
);

drop policy if exists "Sellers can update photo objects for their own adverts" on storage.objects;
create policy "Sellers can update photo objects for their own adverts"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'advert-photos'
  and exists (
    select 1
    from public.adverts
    where adverts.id::text = (storage.foldername(name))[1]
      and adverts.seller_id = auth.uid()
  )
)
with check (
  bucket_id = 'advert-photos'
  and exists (
    select 1
    from public.adverts
    where adverts.id::text = (storage.foldername(name))[1]
      and adverts.seller_id = auth.uid()
  )
);

drop policy if exists "Sellers can delete photo objects for their own adverts" on storage.objects;
create policy "Sellers can delete photo objects for their own adverts"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'advert-photos'
  and exists (
    select 1
    from public.adverts
    where adverts.id::text = (storage.foldername(name))[1]
      and adverts.seller_id = auth.uid()
  )
);
