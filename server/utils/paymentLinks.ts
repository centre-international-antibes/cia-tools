import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import { createPaymentLink, getOrderStatus, type PayzenConfig } from './payzen';

type PaymentLinkRow = Database['public']['Tables']['payment_links']['Row'];
type PaymentLinkStatus = Database['public']['Enums']['payment_link_status'];

/**
 * How long every payment order stays valid. Wide enough to cover the full
 * 3-cycle dunning workflow (relance 1 → 2 → 3 typically spans 4–6 weeks)
 * plus any operator-side delays. Explicit here so we don't rely on the
 * Lyra back-office default — the payment-reminder integration is fully
 * decoupled from the public-website shop config.
 * MAX DURATION = 90 days, enforced by Payzen.
 */
const PAYMENT_LINK_TTL_DAYS = 90;

/**
 * Threshold under which we treat an existing link as "about to expire" and
 * mint a fresh order instead of reusing it. Avoids handing customers a link
 * that may die mid-payment.
 */
const MIN_REMAINING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ensures a usable Payzen payment link exists for a given contact + campaign.
 *
 * Reuse rules (all must hold for the existing link to be returned):
 *   1. Found via proforma (cross-campaign key) or contact_id fallback.
 *   2. Local status is `created` or `pending`.
 *   3. Lyra-side status (re-polled live) is still `pending` — covers cases
 *      where the IPN was missed or Lyra expired the order on its side.
 *   4. `amount_cents` matches the current outstanding balance exactly
 *      (Payzen orders are immutable on amount).
 *   5. At least MIN_REMAINING_TTL_MS left on the local TTL.
 *
 * If any rule fails we mint a new order, persist it, and supersede any
 * stale open rows for the same proforma so future queries pick the fresh
 * one regardless of ordering.
 */
export async function ensurePaymentLinkForContact(
  client: SupabaseClient<Database>,
  cfg: PayzenConfig,
  args: {
    contactId: string;
    campaignId: string;
    email: string;
    firstName: string;
    lastName: string;
    amountCents: number;
    currency?: string;
    language?: 'fr' | 'en';
    expiresAt?: Date;
    /** Reuse keys: same proforma + amount across reminders → same link. */
    proforma?: string | null;
    /** Per-call timeout passed through to every Payzen HTTP request. */
    payzenTimeoutMs?: number;
  },
): Promise<{ paymentUrl: string; orderId: string; status: PaymentLinkStatus }> {
  const existing = await findReusableLink(client, args.proforma ?? null, args.contactId);

  if (existing && (await isReusable(client, cfg, existing, args.amountCents, args.payzenTimeoutMs))) {
    return {
      paymentUrl: existing.payzen_payment_url!,
      orderId: existing.payzen_order_id,
      status: existing.status,
    };
  }

  const orderId = `CIA-${args.contactId.slice(0, 8)}-${Date.now()}`;
  const expiresAt =
    args.expiresAt
    ?? new Date(Date.now() + PAYMENT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  const result = await createPaymentLink(
    cfg,
    {
      orderId,
      amountCents: args.amountCents,
      currency: args.currency,
      customer: {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        reference: args.contactId,
      },
      expiresAt,
      language: args.language,
    },
    { timeoutMs: args.payzenTimeoutMs },
  );

  // Supersede any older open rows that share the same proforma so they can't
  // be returned by a future lookup. We don't touch rows whose Lyra-side
  // status is `paid` — those are valuable audit trails.
  if (args.proforma) {
    await supersedeOpenLinksForProforma(client, args.proforma, result.orderId);
  }

  const rawWithProforma = {
    ...(result.raw as Record<string, unknown>),
    ...(args.proforma ? { proforma: args.proforma } : {}),
  };
  const { error } = await client.from('payment_links').insert({
    contact_id: args.contactId,
    campaign_id: args.campaignId,
    payzen_order_id: result.orderId,
    payzen_payment_url: result.paymentUrl,
    amount_cents: args.amountCents,
    currency: args.currency ?? 'EUR',
    status: 'created',
    expires_at: result.expiresAt,
    raw: rawWithProforma as Database['public']['Tables']['payment_links']['Insert']['raw'],
  });

  if (error) throw new Error(`Failed to persist payment link: ${error.message}`);

  return { paymentUrl: result.paymentUrl, orderId: result.orderId, status: 'created' };
}

/** Find the most recent open link to consider for reuse. */
async function findReusableLink(
  client: SupabaseClient<Database>,
  proforma: string | null,
  contactId: string,
): Promise<PaymentLinkRow | null> {
  if (proforma) {
    const { data } = await client
      .from('payment_links')
      .select('*')
      .in('status', ['created', 'pending'])
      .eq('raw->>proforma', proforma)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await client
    .from('payment_links')
    .select('*')
    .eq('contact_id', contactId)
    .in('status', ['created', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Defends against a missed/dropped IPN: re-polls Lyra before reusing the
 * link, writes back the canonical status, and decides whether the row is
 * still safe to hand to the customer.
 */
async function isReusable(
  client: SupabaseClient<Database>,
  cfg: PayzenConfig,
  link: PaymentLinkRow,
  requestedAmountCents: number,
  timeoutMs?: number,
): Promise<boolean> {
  if (!link.payzen_payment_url) return false;
  if (link.amount_cents !== requestedAmountCents) return false;
  if (link.expires_at) {
    const remaining = new Date(link.expires_at).getTime() - Date.now();
    if (remaining < MIN_REMAINING_TTL_MS) return false;
  }

  // Live status check — source of truth is Lyra, not our cached row.
  // We swallow the Payzen error and fall through to a fresh order: better
  // to mint a new link than to email a stale URL.
  try {
    const live = await getOrderStatus(cfg, link.payzen_order_id, { timeoutMs });
    const mapped: PaymentLinkStatus =
      live.status === 'paid'
        ? 'paid'
        : live.status === 'expired'
          ? 'expired'
          : live.status === 'failed'
            ? 'failed'
            : 'created';

    if (mapped !== link.status) {
      await client
        .from('payment_links')
        .update({ status: mapped, paid_at: live.paidAt })
        .eq('id', link.id);
    }
    return mapped === 'created';
  } catch (err) {
    console.warn('[paymentLinks] live status check failed; creating fresh order', {
      paymentLinkId: link.id,
      error: (err as Error).message,
    });
    return false;
  }
}

/**
 * Marks every open link for `proforma` as `expired` *except* `keepOrderId`.
 * Prevents stale URLs from surfacing in later reuse queries.
 */
async function supersedeOpenLinksForProforma(
  client: SupabaseClient<Database>,
  proforma: string,
  keepOrderId: string,
): Promise<void> {
  await client
    .from('payment_links')
    .update({ status: 'expired' })
    .in('status', ['created', 'pending'])
    .eq('raw->>proforma', proforma)
    .neq('payzen_order_id', keepOrderId);
}

/** Polls Payzen for an order's status and writes it back. */
export async function refreshPaymentLinkStatus(
  client: SupabaseClient<Database>,
  cfg: PayzenConfig,
  paymentLinkId: string,
): Promise<void> {
  const { data: link } = await client
    .from('payment_links')
    .select('*')
    .eq('id', paymentLinkId)
    .single();
  if (!link) return;

  const status = await getOrderStatus(cfg, link.payzen_order_id);
  await client
    .from('payment_links')
    .update({
      status:
        status.status === 'paid'
          ? 'paid'
          : status.status === 'expired'
            ? 'expired'
            : status.status === 'failed'
              ? 'failed'
              : link.status,
      paid_at: status.paidAt,
    })
    .eq('id', paymentLinkId);
}
