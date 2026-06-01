-- OC-08: on-platform buyer/seller messaging.
-- Messages stay on OwnerCars and are visible only to sender/recipient.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (length(btrim(body)) > 0),
  constraint messages_sender_recipient_different check (sender_id <> recipient_id)
);

-- If an earlier hand-built messages table already exists, bring it into the
-- OC-08 shape instead of assuming the create-table path ran.
alter table public.messages
add column if not exists advert_id uuid references public.adverts(id) on delete cascade,
add column if not exists sender_id uuid references auth.users(id) on delete cascade,
add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
add column if not exists body text,
add column if not exists read_at timestamptz,
add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'message'
  ) then
    update public.messages
    set body = coalesce(body, message)
    where body is null;
  end if;

  if to_regclass('public.conversations') is not null then
    update public.messages m
    set
      advert_id = coalesce(m.advert_id, c.advert_id),
      recipient_id = coalesce(
        m.recipient_id,
        case when m.sender_id = c.buyer_id then c.seller_id else c.buyer_id end
      )
    from public.conversations c
    where m.conversation_id = c.id
      and (m.advert_id is null or m.recipient_id is null);
  end if;
end $$;

alter table public.messages
alter column advert_id set not null,
alter column sender_id set not null,
alter column recipient_id set not null,
alter column body set not null,
alter column created_at set default now(),
alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_body_not_blank'
  ) then
    alter table public.messages
    add constraint messages_body_not_blank check (length(btrim(body)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_sender_recipient_different'
  ) then
    alter table public.messages
    add constraint messages_sender_recipient_different check (sender_id <> recipient_id);
  end if;
end $$;

create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_recipient_id_idx on public.messages(recipient_id);
create index if not exists messages_advert_created_at_idx on public.messages(advert_id, created_at desc);
create index if not exists messages_unread_recipient_idx on public.messages(recipient_id, read_at) where read_at is null;

alter table public.messages enable row level security;
alter table public.messages force row level security;

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
on public.messages
for select
to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Intentionally minimal: only verify the caller is the sender and is not
-- messaging themselves.  Advert-ownership checks (published status, seller
-- identity, no self-messaging as seller) are enforced by the API layer.
-- The previous policy queried public.messages inside its own WITH CHECK,
-- causing infinite recursion in Postgres RLS evaluation.
drop policy if exists "Users can create valid advert messages" on public.messages;
create policy "Users can create valid advert messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and recipient_id <> auth.uid()
);

drop policy if exists "Recipients can mark messages read" on public.messages;
create policy "Recipients can mark messages read"
on public.messages
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());
