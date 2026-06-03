alter table public.adverts
add column if not exists is_example boolean not null default false;
