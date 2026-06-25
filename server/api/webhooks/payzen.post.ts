import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

/**
 * Payzen IPN handler.
 *
 * POSTs application/x-www-form-urlencoded fields:
 *   - kr-answer            JSON payload (signed)
 *   - kr-answer-type       e.g. "V4/Payment"
 *   - kr-hash              HMAC over kr-answer
 *   - kr-hash-algorithm    must be "sha256_hmac"
 *   - kr-hash-key          "password" for server-to-server IPN (signed with
 *                          PAYZEN_PASSWORD), "sha256_hmac" for browser-side
 *                          return URL signatures (signed with PAYZEN_HMAC_KEY)
 *
 * We pick the verification key based on kr-hash-key, then update the matching
 * payment_link row. We always respond 200 once the signature is valid so Lyra
 * doesn't keep retrying — even when there's no local row to update (logged for
 * observability).
 */
export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8');
  if (!rawBody) throw createError({ statusCode: 400, statusMessage: 'Empty body.' });

  const params = new URLSearchParams(rawBody);
  const krAnswer = params.get('kr-answer');
  const krHash = params.get('kr-hash');
  const krAlgo = params.get('kr-hash-algorithm');
  const krHashKey = params.get('kr-hash-key');
  if (!krAnswer || !krHash) {
    throw createError({ statusCode: 400, statusMessage: 'Missing kr-answer / kr-hash.' });
  }
  if (krAlgo && krAlgo !== 'sha256_hmac') {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported kr-hash-algorithm: ${krAlgo}`,
    });
  }

  const config = useRuntimeConfig();
  // Server-to-server IPN: Lyra signs with the API password.
  // Browser return URL: signed with the HMAC-SHA256 key.
  // Absent: fall back to HMAC key for legacy/test payloads.
  let verificationKey: string;
  if (krHashKey === 'password') {
    verificationKey = config.payzen.password;
  } else if (krHashKey === 'sha256_hmac' || krHashKey === null) {
    verificationKey = config.payzen.hmacKey;
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported kr-hash-key: ${krHashKey}`,
    });
  }
  if (!verifyPayzenIpn(krAnswer, verificationKey, krHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature.' });
  }

  type Transaction = {
    status?: string;
    detailedStatus?: string;
    creationDate?: string;
  };
  type Answer = {
    orderStatus?: string;
    orderCycle?: string;
    orderDetails?: { orderId?: string; mode?: string };
    transactions?: Transaction[];
  };
  const parsed = JSON.parse(krAnswer) as Answer;
  const orderId = parsed.orderDetails?.orderId;
  if (!orderId) return { ok: true, ignored: true };

  // A single order may carry multiple transaction attempts (3DS retries,
  // partial captures…). Prefer a paid/authorised one if present, else the
  // most recent attempt.
  const txs = parsed.transactions ?? [];
  const txPaid = txs.find((t) => {
    const s = (t.status ?? '').toUpperCase();
    return s === 'PAID' || s === 'AUTHORISED';
  });
  const tx = txPaid ?? txs[txs.length - 1];

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
  const { data: updated, error: updateErr } = await client
    .from('payment_links')
    .update({
      status,
      paid_at: status === 'paid' ? (tx?.creationDate ?? new Date().toISOString()) : null,
      raw: parsed as Record<string, unknown>,
    })
    .eq('payzen_order_id', orderId)
    .select('id');

  if (updateErr) {
    console.error('[payzen-webhook] update failed', { orderId, error: updateErr });
  } else if (!updated?.length) {
    console.warn('[payzen-webhook] no payment_link matched orderId', { orderId, status });
  }

  await logAudit(client, null, `payment.${status}`, 'payment_links', null, {
    orderId,
    matched: updated?.length ?? 0,
  });
  return { ok: true };
});
