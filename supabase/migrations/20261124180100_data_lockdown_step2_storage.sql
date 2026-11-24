-- Security PR 6, step 2 (storage). Run after step 1.
--
-- Advert photos are uploaded by the server, so sellers no longer need storage
-- policies on the advert-photos bucket. Without them, nobody can upload
-- straight to the bucket (skipping the photo-type check) or list its files.
-- Photos still load: the bucket is public, and public links don't use these.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%advert-photos%' or coalesce(with_check, '') ilike '%advert-photos%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Only real photo types, up to 20 MB, in the public photos bucket.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    file_size_limit = 20971520
where id = 'advert-photos';

-- Check: expect advert-photos with the list above and 20971520.
select id, public, allowed_mime_types, file_size_limit from storage.buckets order by id;
