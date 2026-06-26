import type { Database } from './database.types';
import type { CampaignScope } from './profile.types';

export type { CampaignScope };

export type CampaignKind = Database['public']['Enums']['campaign_kind'];
export type CampaignStatus = Database['public']['Enums']['campaign_status'];
export type RecipientStatus = Database['public']['Enums']['recipient_status'];
export type EmailEventType = Database['public']['Enums']['email_event_type'];
export type PaymentLinkStatus = Database['public']['Enums']['payment_link_status'];

export type CampaignList = Database['public']['Tables']['campaign_lists']['Row'];
export type CampaignContact = Database['public']['Tables']['campaign_contacts']['Row'];
export type EmailTemplate = Database['public']['Tables']['email_templates']['Row'];
export type EmailTemplateVersion =
  Database['public']['Tables']['email_template_versions']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CampaignRecipient = Database['public']['Tables']['campaign_recipients']['Row'];
export type EmailEvent = Database['public']['Tables']['email_events']['Row'];
export type PaymentLink = Database['public']['Tables']['payment_links']['Row'];
export type TestSend = Database['public']['Tables']['test_sends']['Row'];

/** A variable expected by a template. */
export interface TemplateVariable {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'url' | 'array' | 'object';
  required: boolean;
  sample: unknown;
  description?: string;
}

/**
 * Reason why a parsed row should not be contacted automatically.
 * `do_not_contact` — explicit "ne pas relancer" note or DNC tag from the ERP.
 * `credit_note`    — refund/credit reference ("Avoir n°…") in notes.
 * `manual_payment` — Notes mention "Virement" / "Transfert" => out-of-band paid.
 * `missing_data`   — kind-specific required signal absent (e.g. no amount due).
 */
export type SuppressionReason =
  | 'do_not_contact'
  | 'credit_note'
  | 'manual_payment'
  | 'already_reminded_max'
  | 'missing_data'
  | 'wrong_client_type'
  | 'invalid_amount';

/** Eligibility flags computed by the kind registry from a raw contact row. */
export interface EligibilityFlags {
  /** ATS: information missing flags */
  no_ats_form?: boolean;
  no_health_form?: boolean;
  no_passport?: boolean;
  /** ATS: housing variant */
  has_housing?: boolean;
  housing_residence?: string;
  housing_type?: string;
  is_private_flat?: boolean;
  is_late_arrival?: boolean;
  arrival_date?: string;
  arrival_time?: string;
  arrival_location?: string;
  /** Thanks direct */
  had_complaint?: boolean;
  audience?: 'junior' | 'adult';
  audience_tag?: string;
  /** Test FR */
  test_status?: 'pending' | 'done' | 'excluded';
  test_link?: string;
  /** Housing / multi-package */
  package_codes?: string[];
  /** Course location */
  course_type?: 'group' | 'private';
  /** Payment reminder */
  amount_cents?: number;
  total_cents?: number;
  paid_cents?: number;
  due_date?: string;
  payment_url?: string;
  payment_link_status?: PaymentLinkStatus;
  payment_plan?: string;
  proforma?: string;
  weeks_count?: number;
  reminder_count?: number;
  cycle_stage?: 1 | 2 | 3;
  /** ATS: derived housing / transfer flags surfaced to the renderer. */
  is_family?: boolean;
  is_residence?: boolean;
  is_aragon?: boolean;
  needs_transfer?: boolean;
  /** Direct client filter */
  client_type?: string;
  /** Suppression — row was kept but should not be contacted by default. */
  suppressed?: boolean;
  suppression_reasons?: SuppressionReason[];
  suppression_notes?: string;
  /** Free-form extras */
  [key: string]: unknown;
}

/** A row produced by the sheet parser before being persisted. */
export interface ParsedContactRow {
  email: string;
  first_name: string;
  last_name: string;
  language: 'fr' | 'en';
  group_key: string | null;
  raw: Record<string, unknown>;
  eligibility: EligibilityFlags;
}

export interface ParserWarning {
  row?: number;
  email?: string;
  code: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
}

/** Aggregated counters produced by the parser, surfaced in the upload UI. */
export interface ParseSummary {
  total: number;
  accepted: number;
  suppressed: number;
  skipped: number;
  duplicates: number;
  invalidEmails: number;
}

export interface ParseResult {
  rows: ParsedContactRow[];
  warnings: ParserWarning[];
  summary: ParseSummary;
}

export interface CampaignKindConfig {
  kind: CampaignKind;
  /** i18n key for the human label. */
  labelKey: string;
  /** i18n key for the short description shown on the kind card. */
  descriptionKey: string;
  /** Lucide icon name. */
  icon: string;
  /** RLS scope name. */
  scope: CampaignScope;
  /** Excel/CSV columns required for the parser to accept a file. */
  requiredColumns: string[];
  /** Optional columns; their presence enables additional flags. */
  optionalColumns: string[];
  /** Available template variants (independent of language). */
  variants: string[];
  /** Variables a template renderer expects to receive. */
  templateVariables: TemplateVariable[];
  /** Marks kinds whose params require an external API call (e.g. Payzen). */
  requiresPaymentLink?: boolean;
  /** Default variant resolver; runs in both server registry and UI. */
  defaultVariant?: string;
}

export type ContactWithEligibility = CampaignContact & {
  eligibility: EligibilityFlags;
};
