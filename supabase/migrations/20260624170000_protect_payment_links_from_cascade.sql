-- ══════════════════════════════════════════════════════════════
-- Migration: protect payment_links from accidental cascade deletes
-- ══════════════════════════════════════════════════════════════
-- payment_links.contact_id was previously ON DELETE CASCADE, which meant
-- deleting a campaign_list (or a single campaign_contact) would silently
-- destroy the local record of a Payzen order. The order itself keeps
-- existing on Lyra's side, but we lose:
--   - the payzen_order_id needed to poll/refund
--   - the payment URL we sent to the customer
--   - the local status (paid/pending/expired)
--   - the audit trail of when the link was created
--
-- Switch to RESTRICT: any attempt to delete a contact that has at least
-- one payment_link must explicitly handle (or delete) the link first.
-- This matches the semantics of campaign_recipients → campaign_contacts
-- (RESTRICT), which already prevents most accidental list deletions.

ALTER TABLE public.payment_links
  DROP CONSTRAINT payment_links_contact_id_fkey,
  ADD CONSTRAINT payment_links_contact_id_fkey
    FOREIGN KEY (contact_id)
    REFERENCES public.campaign_contacts(id)
    ON DELETE RESTRICT;
