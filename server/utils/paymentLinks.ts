import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import { createPaymentLink, getOrderStatus, type PayzenConfig } from './payzen';

/**
 * Ensures a usable Payzen payment link exists for a given contact + campaign.
 * Reuses an existing `created` (non-expired) link rather than spawning a new
 * order — important for the "second relance" case where customers should see
 * the same URL twice.
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
  },
): Promise<{ paymentUrl: string; orderId: string; status: string }> {
  // Lookup priority:
  //   1) any open link tagged with the same proforma (cross-campaign reuse)
  //   2) latest open link for this contact (legacy / no-proforma case)
  let existing: Database['public']['Tables']['payment_links']['Row'] | null = null;
  if (args.proforma) {
    const { data } = await client
      .from('payment_links')
      .select('*')
      .in('status', ['created', 'pending'])
      .eq('raw->>proforma', args.proforma)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = data ?? null;
  }
  if (!existing) {
    const { data } = await client
      .from('payment_links')
      .select('*')
      .eq('contact_id', args.contactId)
      .in('status', ['created', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = data ?? null;
  }

  if (
    existing
    && existing.payzen_payment_url
    && (!existing.expires_at || new Date(existing.expires_at) > new Date())
    && existing.amount_cents === args.amountCents
  ) {
    return {
      paymentUrl: existing.payzen_payment_url,
      orderId: existing.payzen_order_id,
      status: existing.status,
    };
  }

  const orderId = `CIA-${args.contactId.slice(0, 8)}-${Date.now()}`;
  const result = await createPaymentLink(cfg, {
    orderId,
    amountCents: args.amountCents,
    currency: args.currency,
    customer: {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      reference: args.contactId,
    },
    expiresAt: args.expiresAt,
    language: args.language,
  });

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

/** Polls Payzen for an order's status and updates the row. Used before a 2nd relance. */
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
