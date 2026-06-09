-- Secure Vault: document storage and sharing via message thread
-- MANUAL STEP: Create a private storage bucket named 'vault-documents' in Supabase dashboard
-- Storage > New bucket > Name: vault-documents > Public: OFF

-- Vault documents (one row per document type per advert)
create table public.vault_documents (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('mot', 'service_history', 'v5c', 'video_link')),
  file_url text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(advert_id, document_type)
);

alter table public.vault_documents enable row level security;

-- Sellers can manage their own vault documents
create policy "Sellers manage own vault documents"
  on public.vault_documents
  for all
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- Add vault event columns to existing messages table
alter table public.messages
  add column if not exists event_type text check (event_type in ('document_request', 'document_share')),
  add column if not exists document_type text check (document_type in ('mot', 'service_history', 'v5c', 'video_link')),
  add column if not exists signed_url text,
  add column if not exists url_expires_at timestamptz;
