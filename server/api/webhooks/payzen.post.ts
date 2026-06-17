import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

/**
 * Payzen IPN handler. Lyra sends form-encoded fields including `kr-answer`
 * (the canonical JSON answer) and `kr-hash` (HMAC). We verify the signature
 * against `kr-answer` and update the matching payment_link row.
 */
export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8');
  if (!rawBody) throw createError({ statusCode: 400, statusMessage: 'Empty body.' });

  const params = new URLSearchParams(rawBody);
  const krAnswer = params.get('kr-answer');
  const krHash = params.get('kr-hash');
  if (!krAnswer || !krHash) {
    throw createError({ statusCode: 400, statusMessage: 'Missing kr-answer / kr-hash.' });
  }

  const config = useRuntimeConfig();
  if (!verifyPayzenIpn(krAnswer, config.payzen.hmacKey, krHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature.' });
  }

  type Answer = {
    orderStatus?: string;
    orderDetails?: { orderId?: string };
    transactions?: Array<{ status?: string; creationDate?: string }>;
  };
  const parsed = JSON.parse(krAnswer) as Answer;
  const orderId = parsed.orderDetails?.orderId;
  if (!orderId) return { ok: true, ignored: true };

  const tx = parsed.transactions?.[0];
  const upstream = (parsed.orderStatus ?? tx?.status ?? '').toUpperCase();
  const status: Database['public']['Enums']['payment_link_status'] =
    upstream === 'PAID' || upstream === 'AUTHORISED'
      ? 'paid'
      : upstream === 'EXPIRED'
        ? 'expired'
        : upstream === 'CANCELLED' || upstream === 'REFUSED'
          ? 'failed'
          : 'created';

  const client = serverSupabaseServiceRole<Database>(event);
  await client
    .from('payment_links')
    .update({
      status,
      paid_at: status === 'paid' ? (tx?.creationDate ?? new Date().toISOString()) : null,
      raw: parsed as Record<string, unknown>,
    })
    .eq('payzen_order_id', orderId);

  await logAudit(client, null, `payment.${status}`, 'payment_links', null, { orderId });
  return { ok: true };
});
