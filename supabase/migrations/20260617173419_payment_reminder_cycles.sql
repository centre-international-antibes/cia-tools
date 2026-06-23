-- ══════════════════════════════════════════════════════════════
-- Migration: payment_reminder_cycles
-- ══════════════════════════════════════════════════════════════
-- A "cycle" tracks one outstanding balance across the 3-step
-- payment-reminder workflow. Each reupload of the operator's Payzen
-- export progresses the cycle: same proforma → reuse the existing
-- Payzen payment link, bump `stage`, refresh `last_*_id`.
--
-- One open cycle per proforma at a time. A cycle closes when the
-- balance is settled (status='paid'), or when the operator explicitly
-- cancels it.

CREATE TABLE public.payment_reminder_cycles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma             TEXT NOT NULL,
  client_id            TEXT,
  email                CITEXT NOT NULL,
  stage                SMALLINT NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  status               TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'paid', 'cancelled', 'expired')),
  amount_cents         INTEGER NOT NULL,
  paid_cents           INTEGER NOT NULL DEFAULT 0,
  total_cents          INTEGER,
  currency             TEXT NOT NULL DEFAULT 'EUR',
  payment_link_id      UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  first_list_id        UUID REFERENCES public.campaign_lists(id) ON DELETE SET NULL,
  last_list_id         UUID REFERENCES public.campaign_lists(id) ON DELETE SET NULL,
  last_campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  notes                TEXT NOT NULL DEFAULT '',
  closed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one OPEN cycle per proforma. Once closed, a new cycle is fine.
CREATE UNIQUE INDEX uq_payment_reminder_cycles_open_proforma
  ON public.payment_reminder_cycles (proforma)
  WHERE status = 'open';

CREATE INDEX idx_payment_reminder_cycles_email ON public.payment_reminder_cycles (email);
CREATE INDEX idx_payment_reminder_cycles_status ON public.payment_reminder_cycles (status);
CREATE INDEX idx_payment_reminder_cycles_last_list ON public.payment_reminder_cycles (last_list_id);

CREATE TRIGGER on_payment_reminder_cycles_updated
  BEFORE UPDATE ON public.payment_reminder_cycles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.payment_reminder_cycles TO authenticated;
GRANT ALL ON public.payment_reminder_cycles TO service_role;

-- ── RLS: same scope as payment_links ────────────────────────
ALTER TABLE public.payment_reminder_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment scope can read cycles"
  ON public.payment_reminder_cycles FOR SELECT
  TO authenticated
  USING (public.has_scope('campaign:payment_reminder'));

CREATE POLICY "Payment scope can insert cycles"
  ON public.payment_reminder_cycles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_scope('campaign:payment_reminder'));

CREATE POLICY "Payment scope can update cycles"
  ON public.payment_reminder_cycles FOR UPDATE
  TO authenticated
  USING (public.has_scope('campaign:payment_reminder'));
