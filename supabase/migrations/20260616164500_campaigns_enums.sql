-- ══════════════════════════════════════════════════════════════
-- Migration: enums for campaigns subsystem
-- ══════════════════════════════════════════════════════════════

-- Kind of email campaign. Each kind has its own scope (campaign:<kind>).
CREATE TYPE public.campaign_kind AS ENUM (
  'ats',
  'ats_late_arrival',
  'thanks_direct',
  'test_fr',
  'housing_confirmation',
  'course_location',
  'welcome_pack',
  'payment_reminder'
);

-- Lifecycle of a campaign.
CREATE TYPE public.campaign_status AS ENUM (
  'draft',
  'queued',
  'sending',
  'sent',
  'partially_failed',
  'failed',
  'aborted'
);

-- Per-recipient status; events from Brevo move this forward.
CREATE TYPE public.recipient_status AS ENUM (
  'pending',
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'skipped'
);

-- Raw event type stored in email_events. Mirrors Brevo's webhook vocabulary.
CREATE TYPE public.email_event_type AS ENUM (
  'request',
  'delivered',
  'opened',
  'click',
  'soft_bounce',
  'hard_bounce',
  'invalid_email',
  'deferred',
  'complaint',
  'unsubscribed',
  'blocked',
  'error'
);

-- Payment link lifecycle (Payzen).
CREATE TYPE public.payment_link_status AS ENUM (
  'pending',
  'created',
  'paid',
  'expired',
  'failed'
);
