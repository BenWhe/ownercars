-- OC-02: advert lifecycle states and 30-day availability reconfirmation.

alter table public.adverts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists published_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists sold_at timestamptz,
  add column if not exists seller_email text,
  add column if not exists last_availability_confirmed_at timestamptz,
  add column if not exists next_availability_check_at timestamptz,
  add column if not exists availability_check_sent_at timestamptz,
  add column if not exists availability_reminder_due_at timestamptz,
  add column if not exists availability_reminder_sent_at timestamptz,
  add column if not exists availability_pause_due_at timestamptz,
  add column if not exists availability_confirmation_token text;

update public.adverts
set status = 'published'
where status = 'live';

update public.adverts a
set seller_email = u.email
from auth.users u
where a.seller_id = u.id
  and a.seller_email is null;

update public.adverts
set
  published_at = coalesce(published_at, created_at),
  last_availability_confirmed_at = coalesce(last_availability_confirmed_at, created_at),
  next_availability_check_at = coalesce(next_availability_check_at, created_at + interval '30 days')
where status = 'published';

alter table public.adverts
  drop constraint if exists adverts_status_check;

alter table public.adverts
  add constraint adverts_status_check
  check (status in ('draft', 'pending_payment', 'published', 'paused', 'sold'));

create unique index if not exists adverts_availability_confirmation_token_key
on public.adverts (availability_confirmation_token)
where availability_confirmation_token is not null;

create index if not exists adverts_next_availability_check_idx
on public.adverts (next_availability_check_at)
where status = 'published';

create index if not exists adverts_availability_reminder_due_idx
on public.adverts (availability_reminder_due_at)
where status = 'published' and availability_reminder_sent_at is null;

create index if not exists adverts_availability_pause_due_idx
on public.adverts (availability_pause_due_at)
where status = 'published';

create or replace function public.set_adverts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_adverts_updated_at on public.adverts;
create trigger set_adverts_updated_at
before update on public.adverts
for each row
execute function public.set_adverts_updated_at();

-- Replace older OC-03 public visibility policies that used status='live'.
drop policy if exists "Public can view live adverts" on public.adverts;
create policy "Public can view published adverts"
on public.adverts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Public can view photos for live adverts" on public.advert_photos;
create policy "Public can view photos for published adverts"
on public.advert_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.adverts
    where adverts.id = advert_photos.advert_id
      and adverts.status = 'published'
  )
);
