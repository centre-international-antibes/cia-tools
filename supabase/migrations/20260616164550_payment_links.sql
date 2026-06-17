-- ══════════════════════════════════════════════════════════════
-- Migration: payment_links (Payzen)
-- ══════════════════════════════════════════════════════════════
-- One row per (contact, campaign) attempt. Existing 'created' links are reused
-- across first and second relances so customers see the same URL.

CREATE TABLE public.payment_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id          UUID NOT NULL REFERENCES public.campaign_contacts(id) ON DELETE CASCADE,
  campaign_id         UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  payzen_order_id     TEXT NOT NULL,
  payzen_payment_url  TEXT,
  amount_cents        INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'EUR',
  status              public.payment_link_status NOT NULL DEFAULT 'pending',
  expires_at          TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  raw                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payzen_order_id)
);

CREATE INDEX idx_payment_links_contact ON public.payment_links (contact_id);
CREATE INDEX idx_payment_links_campaign ON public.payment_links (campaign_id);
CREATE INDEX idx_payment_links_status ON public.payment_links (status);

CREATE TRIGGER on_payment_links_updated
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;
