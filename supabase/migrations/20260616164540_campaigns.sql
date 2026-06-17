-- ══════════════════════════════════════════════════════════════
-- Migration: campaigns, recipients, email events
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                  public.campaign_kind NOT NULL,
  name                  TEXT NOT NULL,
  list_id               UUID NOT NULL REFERENCES public.campaign_lists(id) ON DELETE RESTRICT,
  template_id           UUID REFERENCES public.email_templates(id) ON DELETE RESTRICT,
  template_version_id   UUID REFERENCES public.email_template_versions(id) ON DELETE RESTRICT,
  status                public.campaign_status NOT NULL DEFAULT 'draft',
  params_default        JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for         TIMESTAMPTZ,
  client_request_id     UUID UNIQUE,
  notes                 TEXT NOT NULL DEFAULT '',

  created_by            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_by               UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_at               TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,

  total_recipients      INTEGER NOT NULL DEFAULT 0,
  sent_count            INTEGER NOT NULL DEFAULT 0,
  failed_count          INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_kind ON public.campaigns (kind);
CREATE INDEX idx_campaigns_status ON public.campaigns (status);
CREATE INDEX idx_campaigns_created_by ON public.campaigns (created_by);
CREATE INDEX idx_campaigns_list_id ON public.campaigns (list_id);

CREATE TRIGGER on_campaigns_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- One row per contact targeted by the campaign. The rendered params snapshot
-- is stored here so re-renders or audits are reproducible without re-running
-- the kind registry against the (possibly mutated) contact row.
CREATE TABLE public.campaign_recipients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES public.campaign_contacts(id) ON DELETE RESTRICT,
  email                CITEXT NOT NULL,
  params               JSONB NOT NULL DEFAULT '{}'::jsonb,
  status               public.recipient_status NOT NULL DEFAULT 'pending',
  brevo_message_id     TEXT,
  error                TEXT,
  attempts             INTEGER NOT NULL DEFAULT 0,
  sent_at              TIMESTAMPTZ,
  last_event_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id),
  UNIQUE (campaign_id, email)
);

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients (campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients (status);
CREATE INDEX idx_campaign_recipients_message_id ON public.campaign_recipients (brevo_message_id);

CREATE TRIGGER on_campaign_recipients_updated
  BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Append-only event log fed by Brevo webhook.
CREATE TABLE public.email_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  type          public.email_event_type NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_hash  TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, type, payload_hash)
);

CREATE INDEX idx_email_events_recipient ON public.email_events (recipient_id);
CREATE INDEX idx_email_events_type ON public.email_events (type);
CREATE INDEX idx_email_events_occurred_at ON public.email_events (occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
GRANT ALL ON public.campaign_recipients TO service_role;
GRANT ALL ON public.email_events TO service_role;
