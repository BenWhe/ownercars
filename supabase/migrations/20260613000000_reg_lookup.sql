-- Reg-lookup: store the seller's registration plus the raw DVSA MOT History
-- response so we can re-derive vehicle details, without ever exposing the
-- registration or raw payload on public pages (handled in the API layer).
--
-- registration  — the entered reg (normalised, uppercase, no spaces). PRIVATE:
--                  never returned by the public browse/advert APIs.
-- engine_size    — seller-confirmed engine size (e.g. "1998 cc"). Displayable.
-- lookup_data    — full raw DVSA API response (jsonb). PRIVATE: contains
--                  motTests history; never returned by public APIs.

alter table public.adverts
  add column if not exists registration text,
  add column if not exists engine_size text,
  add column if not exists lookup_data jsonb;
