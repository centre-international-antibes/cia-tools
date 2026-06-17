-- ══════════════════════════════════════════════════════════════
-- Migration: RLS policies for campaigns subsystem
-- ══════════════════════════════════════════════════════════════

-- Helper that resolves the scope name from a campaign kind.
CREATE FUNCTION public.scope_for_kind(k public.campaign_kind)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'campaign:' || k::text;
$$;

GRANT EXECUTE ON FUNCTION public.scope_for_kind(public.campaign_kind) TO authenticated;

-- ── campaign_lists ──────────────────────────────────────────
ALTER TABLE public.campaign_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scope holders can read lists"
  ON public.campaign_lists FOR SELECT
  TO authenticated
  USING (public.has_scope(public.scope_for_kind(kind)));

CREATE POLICY "Scope holders can insert lists"
  ON public.campaign_lists FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_scope(public.scope_for_kind(kind))
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Scope holders can update own lists"
  ON public.campaign_lists FOR UPDATE
  TO authenticated
  USING (
    public.has_scope(public.scope_for_kind(kind))
    AND (uploaded_by = auth.uid() OR public.is_admin())
  )
  WITH CHECK (public.has_scope(public.scope_for_kind(kind)));

CREATE POLICY "Admins can delete lists"
  ON public.campaign_lists FOR DELETE
  TO authenticated
  USING (public.is_admin() OR uploaded_by = auth.uid());

-- ── campaign_contacts ───────────────────────────────────────
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scope holders can read contacts"
  ON public.campaign_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_lists l
      WHERE l.id = list_id
        AND public.has_scope(public.scope_for_kind(l.kind))
    )
  );

CREATE POLICY "Scope holders can insert contacts"
  ON public.campaign_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_lists l
      WHERE l.id = list_id
        AND public.has_scope(public.scope_for_kind(l.kind))
    )
  );

CREATE POLICY "Scope holders can update contacts"
  ON public.campaign_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_lists l
      WHERE l.id = list_id
        AND public.has_scope(public.scope_for_kind(l.kind))
    )
  );

CREATE POLICY "Scope holders can delete contacts"
  ON public.campaign_contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_lists l
      WHERE l.id = list_id
        AND public.has_scope(public.scope_for_kind(l.kind))
    )
  );

-- ── email_templates ─────────────────────────────────────────
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign users can read templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (public.has_any_campaign_scope());

CREATE POLICY "Scope holders can insert templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_scope(public.scope_for_kind(kind))
    AND created_by = auth.uid()
  );

CREATE POLICY "Scope holders can update templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (public.has_scope(public.scope_for_kind(kind)));

CREATE POLICY "Admins can delete templates"
  ON public.email_templates FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── email_template_versions ─────────────────────────────────
ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign users can read template versions"
  ON public.email_template_versions FOR SELECT
  TO authenticated
  USING (public.has_any_campaign_scope());

CREATE POLICY "Scope holders can insert template versions"
  ON public.email_template_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_templates t
      WHERE t.id = template_id
        AND public.has_scope(public.scope_for_kind(t.kind))
    )
    AND created_by = auth.uid()
  );

-- versions are immutable; no UPDATE / DELETE for authenticated.

-- ── campaigns ───────────────────────────────────────────────
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scope holders can read campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (public.has_scope(public.scope_for_kind(kind)));

CREATE POLICY "Scope holders can insert campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_scope(public.scope_for_kind(kind))
    AND created_by = auth.uid()
  );

CREATE POLICY "Scope holders can update campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (public.has_scope(public.scope_for_kind(kind)));

CREATE POLICY "Authors or admins can delete draft campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (
    public.has_scope(public.scope_for_kind(kind))
    AND (created_by = auth.uid() OR public.is_admin())
    AND status = 'draft'
  );

-- ── campaign_recipients ─────────────────────────────────────
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scope holders can read recipients"
  ON public.campaign_recipients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND public.has_scope(public.scope_for_kind(c.kind))
    )
  );

CREATE POLICY "Scope holders can insert recipients"
  ON public.campaign_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND public.has_scope(public.scope_for_kind(c.kind))
    )
  );

CREATE POLICY "Scope holders can update recipients"
  ON public.campaign_recipients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND public.has_scope(public.scope_for_kind(c.kind))
    )
  );

CREATE POLICY "Scope holders can delete pending recipients"
  ON public.campaign_recipients FOR DELETE
  TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND public.has_scope(public.scope_for_kind(c.kind))
    )
  );

-- ── email_events ────────────────────────────────────────────
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scope holders can read events"
  ON public.email_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_recipients r
      JOIN public.campaigns c ON c.id = r.campaign_id
      WHERE r.id = recipient_id
        AND public.has_scope(public.scope_for_kind(c.kind))
    )
  );
-- Inserts go through service role only (webhook).

-- ── payment_links ───────────────────────────────────────────
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment scope can read payment links"
  ON public.payment_links FOR SELECT
  TO authenticated
  USING (public.has_scope('campaign:payment_reminder'));

CREATE POLICY "Payment scope can insert payment links"
  ON public.payment_links FOR INSERT
  TO authenticated
  WITH CHECK (public.has_scope('campaign:payment_reminder'));

CREATE POLICY "Payment scope can update payment links"
  ON public.payment_links FOR UPDATE
  TO authenticated
  USING (public.has_scope('campaign:payment_reminder'));

-- ── test_sends ──────────────────────────────────────────────
ALTER TABLE public.test_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors and admins can read own test sends"
  ON public.test_sends FOR SELECT
  TO authenticated
  USING (sent_by = auth.uid() OR public.is_admin());

CREATE POLICY "Campaign users can insert test sends"
  ON public.test_sends FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_campaign_scope()
    AND sent_by = auth.uid()
  );

-- ── audit_log ───────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());
-- Inserts only through service role.
