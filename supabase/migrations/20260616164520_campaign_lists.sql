-- ══════════════════════════════════════════════════════════════
-- Migration: campaign_lists + campaign_contacts
-- ══════════════════════════════════════════════════════════════
-- A "list" is an uploaded Matrix (or Payzen) export tied to a single kind.
-- Contacts are the parsed rows. Original file is stored in Supabase Storage.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE public.campaign_lists (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 public.campaign_kind NOT NULL,
  name                 TEXT NOT NULL,
  source_filename      TEXT NOT NULL,
  source_file_path     TEXT NOT NULL,         -- path in campaign-imports bucket
  source_file_sha256   TEXT NOT NULL,
  row_count            INTEGER NOT NULL DEFAULT 0,
  warnings             JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_lists_kind ON public.campaign_lists (kind);
CREATE INDEX idx_campaign_lists_uploaded_by ON public.campaign_lists (uploaded_by);

CREATE TRIGGER on_campaign_lists_updated
  BEFORE UPDATE ON public.campaign_lists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- A row imported from the spreadsheet.
-- `raw` keeps the original columns verbatim (audit / re-processing).
-- `eligibility` holds the kind-specific computed flags surfaced in the UI.
-- `group_key` allows grouping multiple rows (e.g. multi-package housing).
CREATE TABLE public.campaign_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID NOT NULL REFERENCES public.campaign_lists(id) ON DELETE CASCADE,
  email         CITEXT NOT NULL,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  language      TEXT NOT NULL DEFAULT 'fr',   -- 'fr' | 'en'
  group_key     TEXT,                          -- e.g. client_id, used for grouping
  raw           JSONB NOT NULL DEFAULT '{}'::jsonb,
  eligibility   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, email)
);

CREATE INDEX idx_campaign_contacts_list_id ON public.campaign_contacts (list_id);
CREATE INDEX idx_campaign_contacts_email ON public.campaign_contacts (email);
CREATE INDEX idx_campaign_contacts_group_key ON public.campaign_contacts (group_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_contacts TO authenticated;
GRANT ALL ON public.campaign_lists TO service_role;
GRANT ALL ON public.campaign_contacts TO service_role;
