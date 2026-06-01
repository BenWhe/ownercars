-- OC-09b: record that the buyer confirmed genuine intent before sending.

alter table public.messages
add column if not exists genuine_buyer_declared boolean not null default false;
