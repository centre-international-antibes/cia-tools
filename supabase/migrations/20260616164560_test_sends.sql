-- ══════════════════════════════════════════════════════════════
-- Migration: test_sends — single-recipient previews
-- ══════════════════════════════════════════════════════════════
-- Test sends do not affect campaign statistics. They let staff verify
-- rendering and deliverability before launching a real campaign.

CREATE TABLE public.test_sends (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id   UUID NOT NULL REFERENCES public.email_template_versions(id) ON DELETE CASCADE,
  campaign_id           UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sample_contact_id     UUID REFERENCES public.campaign_contacts(id) ON DELETE SET NULL,
  recipient_email       CITEXT NOT NULL,
  params                JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  brevo_message_id      TEXT,
  error                 TEXT,
  sent_by               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_sends_template_version ON public.test_sends (template_version_id);
CREATE INDEX idx_test_sends_sent_by ON public.test_sends (sent_by);
CREATE INDEX idx_test_sends_created_at ON public.test_sends (created_at DESC);

GRANT SELECT, INSERT ON public.test_sends TO authenticated;
GRANT ALL ON public.test_sends TO service_role;
