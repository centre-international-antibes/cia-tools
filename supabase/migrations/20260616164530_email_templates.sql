-- ══════════════════════════════════════════════════════════════
-- Migration: email templates with versioning
-- ══════════════════════════════════════════════════════════════
-- Templates are authored as MJML, compiled to HTML server-side.
-- Each save creates a new immutable version. campaigns reference a specific
-- version so the rendered output is forensically traceable.

CREATE TABLE public.email_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 public.campaign_kind NOT NULL,
  name                 TEXT NOT NULL,
  language             TEXT NOT NULL DEFAULT 'fr',   -- 'fr' | 'en'
  variant              TEXT NOT NULL DEFAULT 'default',  -- e.g. 'full', 'light', 'junior', 'adult'
  active               BOOLEAN NOT NULL DEFAULT true,
  current_version_id   UUID,                          -- FK set after first version is created
  description          TEXT NOT NULL DEFAULT '',
  created_by           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_email_templates_kind_language_variant_active
  ON public.email_templates (kind, language, variant)
  WHERE active;

CREATE INDEX idx_email_templates_kind ON public.email_templates (kind);

CREATE TRIGGER on_email_templates_updated
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Immutable snapshots of a template's content.
CREATE TABLE public.email_template_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  subject           TEXT NOT NULL,
  mjml              TEXT NOT NULL,
  compiled_html     TEXT NOT NULL,
  plaintext         TEXT NOT NULL,
  variables_schema  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{key, type, required, sample}]
  created_by        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE INDEX idx_email_template_versions_template ON public.email_template_versions (template_id);

ALTER TABLE public.email_templates
  ADD CONSTRAINT fk_email_templates_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES public.email_template_versions(id)
  ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_versions TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
GRANT ALL ON public.email_template_versions TO service_role;
