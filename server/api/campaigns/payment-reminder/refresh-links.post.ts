import { z } from 'zod';
import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';
import { getOrderStatus, type PayzenConfig } from '#server/utils/payzen';

const schema = z.object({
  listId: z.string().uuid(),
});

/**
 * Refresh Payzen status for every open cycle touching the given list.
 * Closes the cycle if the underlying order is now paid; otherwise updates
 * the persisted `payment_links.status` so the operator sees fresh data.
 */
export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));
  await requireScope(event, 'campaign:payment_reminder');

  const config = useRuntimeConfig();
  const client = serverSupabaseServiceRole<Database>(event);

  const cfg: PayzenConfig = {
    apiUrl: config.payzen.apiUrl,
    username: config.payzen.username,
    password: config.payzen.password,
    hmacKey: config.payzen.hmacKey,
    returnUrl: config.payzen.returnUrl,
    ipnTargetUrl: config.payzen.ipnTargetUrl,
    paymentReceiptEmail: config.payzen.paymentReceiptEmail,
  };

  const { data: cycles, error } = await client
    .from('payment_reminder_cycles')
    .select('id, proforma, payment_link_id, status')
    .or(`last_list_id.eq.${body.listId},first_list_id.eq.${body.listId}`)
    .eq('status', 'open');
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  let refreshed = 0;
  let closed = 0;
  for (const cycle of cycles ?? []) {
    if (!cycle.payment_link_id) continue;
    const { data: link } = await client
      .from('payment_links')
      .select('*')
      .eq('id', cycle.payment_link_id)
      .single();
    if (!link) continue;
    try {
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
        .eq('id', link.id);
      if (status.status === 'paid') {
        await client
          .from('payment_reminder_cycles')
          .update({ status: 'paid', closed_at: new Date().toISOString() })
          .eq('id', cycle.id);
        closed++;
      }
      refreshed++;
    } catch (err) {
      console.error('[refresh-links] payzen fetch failed', { orderId: link.payzen_order_id, err });
    }
  }

  return { refreshed, closed, total: cycles?.length ?? 0 };
});
