// Columns of public.messages that buyers and sellers may read. The sender_*
// columns (IP, location, device) are evidence for OwnerCars only and must
// never be returned to the other party, so API routes select this list
// rather than "*" (and signed-in users only have SELECT on these columns).
export const MESSAGE_PUBLIC_COLUMNS =
  "id, advert_id, sender_id, recipient_id, body, read_at, created_at, " +
  "event_type, document_type, signed_url, url_expires_at";
