-- ══════════════════════════════════════════════════════════════
-- Migration: generic audit_log (append-only)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,           -- e.g. campaign.send, list.upload
  entity          TEXT NOT NULL,           -- e.g. campaigns, campaign_lists
  entity_id       UUID,
  diff            JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON public.audit_log (actor_user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log (entity, entity_id);
CREATE INDEX idx_audit_log_occurred_at ON public.audit_log (occurred_at DESC);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
