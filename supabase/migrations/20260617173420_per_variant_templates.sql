-- ══════════════════════════════════════════════════════════════
-- Migration: per-variant template overrides
-- ══════════════════════════════════════════════════════════════
-- A single campaign list (especially `ats`) frequently mixes juniors and
-- adults, which need different templates. We let the operator map each
-- present variant to its own template_version while keeping the existing
-- `template_version_id` column as the fallback (used when no override
-- matches the recipient's resolved variant).

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS template_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.campaigns.template_overrides IS
  'Map of variant name → template_version uuid. The sender prefers the override matching the recipient''s resolved variant before falling back to template_version_id.';

-- Recipients carry the resolved variant so the sender does not need to
-- re-run the kind registry against (possibly mutated) contact rows.
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS variant TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_variant
  ON public.campaign_recipients (variant);
