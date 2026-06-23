-- ══════════════════════════════════════════════════════════════
-- Migration: allow multiple contacts per (list, email)
-- ══════════════════════════════════════════════════════════════
-- The ERP exports legitimately contain two siblings sharing a parent's
-- email — they're distinct customers and must both receive the campaign.
-- The original `(list_id, email)` UNIQUE blocked that case.
--
-- We now keep a softer guard via `group_key` ONLY for kinds that grow it
-- from a stable client_id (housing_confirmation merges siblings). For
-- everything else (ATS, payment_reminder, …) the parser assigns a per-row
-- group_key, so duplicate emails sail through.

ALTER TABLE public.campaign_contacts
  DROP CONSTRAINT IF EXISTS campaign_contacts_list_id_email_key;

-- Same reasoning for recipients: `(campaign_id, contact_id)` UNIQUE already
-- prevents true row-level duplicates within a send. The email-only UNIQUE
-- was making "same parent, two kids" impossible.
ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_campaign_id_email_key;
