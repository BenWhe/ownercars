-- OC-09: track when contact details were removed from a message body.

alter table public.messages
add column if not exists contact_details_redacted boolean not null default false;
