import crypto from 'node:crypto';
import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

/**
 * Payzen IPN handler — supports **both** notification formats:
 *
 * 1. **Form API (V2)** — `CreatePaymentOrder` / hosted payment pages
 *    POST application/x-www-form-urlencoded with `vads_*` fields + `signature`.
 *    Signature = HMAC-SHA-256 over sorted vads_* values joined by `+`.
 *
 * 2. **REST API (V4)** — `Charge/CreatePayment` / embedded form
 *    POST application/x-www-form-urlencoded with `kr-answer` (JSON) + `kr-hash`.
 *    Signature = HMAC-SHA-256 over kr-answer string.
 *
 * We detect the format by checking for `vads_trans_status` (Form) vs
 * `kr-answer` (REST), then dispatch to the appropriate verification and
 * extraction logic.
 */
export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8');
  if (!rawBody) throw createError({ statusCode: 400, statusMessage: 'Empty body.' });

  const params = new URLSearchParams(rawBody);
  const config = useRuntimeConfig();

  // ── Detect format ────────────────────────────────────────────────────────
  const isFormApi = params.has('vads_trans_status');

  if (isFormApi) {
    return await handleFormApi(event, params, config);
  }
  return await handleRestApi(event, params, rawBody, config);
});

// ═══════════════════════════════════════════════════════════════════════════
// Form API (V2) — vads_* fields
// ═══════════════════════════════════════════════════════════════════════════

async function handleFormApi(
  event: Parameters<Parameters<typeof defineEventHandler>[0]>[0],
  params: URLSearchParams,
  config: ReturnType<typeof useRuntimeConfig>,
) {
  const signature = params.get('signature');
  const vadsHash = params.get('vads_hash');

  // Verify with HMAC-SHA-256 (vads_hash) — preferred.
  // Fall back to SHA-1 (signature) for legacy back-office configs.
  const hmacKey = config.payzen.hmacKey;
  const expectedHmac = computeFormApiHmac(params, hmacKey);

  let verified = false;
  if (vadsHash && expectedHmac === vadsHash) {
    verified = true;
  } else if (signature) {
    // SHA-1 legacy: sorted values + certificate key
    const expectedSha1 = computeFormApiSha1(params, hmacKey);
    verified = expectedSha1 === signature;
  }

  if (!verified) {
    console.error('[payzen-webhook] Form API signature mismatch', {
      vadsHashReceived: vadsHash,
      vadsHashExpected: expectedHmac,
      signatureReceived: signature,
      keyPrefix: hmacKey.slice(0, 8) + '...',
    });
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature.' });
  }

  // ── Extract payment data ───────────────────────────────────────────────
  const orderId = params.get('vads_order_id');
  if (!orderId) return { ok: true, ignored: true };

  const transStatus = (params.get('vads_trans_status') ?? '').toUpperCase();
  const status: Database['public']['Enums']['payment_link_status'] =
    transStatus === 'AUTHORISED' || transStatus === 'CAPTURED'
      ? 'paid'
      : transStatus === 'EXPIRED'
        ? 'expired'
        : transStatus === 'CANCELLED' || transStatus === 'REFUSED' || transStatus === 'ABANDONED'
          ? 'failed'
          : 'created';

  const paidAt =
    status === 'paid'
      ? parseVadsDate(params.get('vads_effective_creation_date') ?? params.get('vads_trans_date'))
      : null;

  // Store all vads_* fields as raw for audit
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    raw[key] = value;
  }

  const client = serverSupabaseServiceRole<Database>(event);
  const { data: updated, error: updateErr } = await client
    .from('payment_links')
    .update({
      status,
      paid_at: paidAt,
      raw: raw as unknown as Database['public']['Tables']['payment_links']['Update']['raw'],
    })
    .eq('payzen_order_id', orderId)
    .select('id');

  if (updateErr) {
    console.error('[payzen-webhook] update failed', { orderId, error: updateErr });
  } else if (!updated?.length) {
    console.warn('[payzen-webhook] no payment_link matched orderId', { orderId, status });
  } else {
    console.info('[payzen-webhook] updated', { orderId, status, matched: updated.length });
  }

  await logAudit(client, null, `payment.${status}`, 'payment_links', null, {
    orderId,
    transStatus,
    matched: updated?.length ?? 0,
  });
  return { ok: true };
}

/**
 * HMAC-SHA-256 over sorted vads_* values joined by `+`.
 * Lyra docs: collect all vads_* fields, sort by key name, join values with `+`,
 * HMAC-SHA-256 with the HMAC key.
 */
function computeFormApiHmac(params: URLSearchParams, hmacKey: string): string {
  const vadsFields: [string, string][] = [];
  for (const [key, value] of params.entries()) {
    if (key.startsWith('vads_')) vadsFields.push([key, value]);
  }
  vadsFields.sort(([a], [b]) => a.localeCompare(b));
  const payload = vadsFields.map(([, v]) => v).join('+');
  return crypto.createHmac('sha256', hmacKey).update(payload).digest('hex');
}

/**
 * SHA-1 legacy signature: sorted vads_* values joined by `+`, then `+key`.
 */
function computeFormApiSha1(params: URLSearchParams, certKey: string): string {
  const vadsFields: [string, string][] = [];
  for (const [key, value] of params.entries()) {
    if (key.startsWith('vads_')) vadsFields.push([key, value]);
  }
  vadsFields.sort(([a], [b]) => a.localeCompare(b));
  const payload = vadsFields.map(([, v]) => v).join('+') + '+' + certKey;
  return crypto.createHash('sha1').update(payload).digest('hex');
}

/** Parse `vads_trans_date` format: `YYYYMMDDHHmmss` → ISO string. */
function parseVadsDate(raw: string | null): string | null {
  if (!raw || raw.length < 14) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════
// REST API (V4) — kr-answer / kr-hash
// ═══════════════════════════════════════════════════════════════════════════

async function handleRestApi(
  event: Parameters<Parameters<typeof defineEventHandler>[0]>[0],
  params: URLSearchParams,
  rawBody: string,
  config: ReturnType<typeof useRuntimeConfig>,
) {
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
}
