import crypto from 'node:crypto';
import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

/**
 * Brevo transactional webhook. Brevo POSTs an event object per delivery
 * milestone. Supported events are mapped to our `email_event_type` enum and
 * dropped into `email_events`; the recipient's status is updated using a
 * fixed precedence ladder so events arriving out-of-order can't downgrade.
 *
 * Authentication: either ?secret=XXX or X-Brevo-Signature: <hmac> header.
 */

const STATUS_PRECEDENCE: Record<string, number> = {
  pending: 0,
  queued: 1,
  sent: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  soft_bounce: 6,
  hard_bounce: 7,
  complained: 7,
  failed: 7,
  skipped: 7,
};

function mapEventType(type: string): Database['public']['Enums']['email_event_type'] | null {
  const key = type.toLowerCase().replace(/[\s-]/g, '_');
  const known: Record<string, Database['public']['Enums']['email_event_type']> = {
    request: 'request',
    delivered: 'delivered',
    opened: 'opened',
    unique_opened: 'opened',
    click: 'click',
    clicks: 'click',
    soft_bounce: 'soft_bounce',
    hard_bounce: 'hard_bounce',
    invalid_email: 'invalid_email',
    deferred: 'deferred',
    complaint: 'complaint',
    spam: 'complaint',
    unsubscribed: 'unsubscribed',
    blocked: 'blocked',
    error: 'error',
  };
  return known[key] ?? null;
}

function eventToRecipientStatus(
  type: Database['public']['Enums']['email_event_type'],
): Database['public']['Enums']['recipient_status'] | null {
  switch (type) {
    case 'request':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'opened':
      return 'opened';
    case 'click':
      return 'clicked';
    case 'soft_bounce':
      return 'soft_bounce';
    case 'hard_bounce':
    case 'invalid_email':
    case 'blocked':
      return 'hard_bounce';
    case 'complaint':
      return 'complained';
    case 'error':
      return 'failed';
    default:
      return null;
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8');
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body.' });
  }

  const config = useRuntimeConfig();
  const headerSig = getHeader(event, 'x-brevo-signature') ?? null;
  const querySecret = (getQuery(event).secret as string | undefined) ?? null;

  const verified = verifyBrevoWebhook(
    rawBody,
    config.brevo.webhookSecret,
    headerSig,
    querySecret,
  );
  if (!verified) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature.' });
  }

  let payload: Record<string, unknown> | Record<string, unknown>[];
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON.' });
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const client = serverSupabaseServiceRole<Database>(event);

  for (const e of events) {
    const eventType = (e.event ?? e['event-name'] ?? '') as string;
    const mapped = mapEventType(eventType);
    if (!mapped) continue;

    const messageId = (e['message-id'] ?? e.message_id ?? e.messageId ?? '') as string;
    const recipientHeader = (e['X-CIA-Recipient'] ?? e.headers?.['X-CIA-Recipient']) as
      | string
      | undefined;

    let recipientId: string | null = recipientHeader ?? null;
    if (!recipientId && messageId) {
      const { data: r } = await client
        .from('campaign_recipients')
        .select('id, status')
        .eq('brevo_message_id', messageId)
        .maybeSingle();
      recipientId = r?.id ?? null;
    }
    if (!recipientId) continue;

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(e))
      .digest('hex');

    const occurredAtRaw = (e.ts_event ?? e.date ?? e.timestamp) as string | number | undefined;
    const occurredAt = occurredAtRaw
      ? new Date(
          typeof occurredAtRaw === 'number' ? occurredAtRaw * 1000 : occurredAtRaw,
        ).toISOString()
      : new Date().toISOString();

    await client
      .from('email_events')
      .insert({
        recipient_id: recipientId,
        type: mapped,
        payload: e as Record<string, unknown>,
        payload_hash: payloadHash,
        occurred_at: occurredAt,
      })
      // Duplicates are silently ignored (idempotent webhook).
      .select()
      .maybeSingle();

    const candidateStatus = eventToRecipientStatus(mapped);
    if (candidateStatus) {
      const { data: current } = await client
        .from('campaign_recipients')
        .select('status')
        .eq('id', recipientId)
        .single();
      const next = candidateStatus;
      const curr = current?.status ?? 'pending';
      if ((STATUS_PRECEDENCE[next] ?? 0) >= (STATUS_PRECEDENCE[curr] ?? 0)) {
        await client
          .from('campaign_recipients')
          .update({
            status: next,
            last_event_at: occurredAt,
          })
          .eq('id', recipientId);
      }
    }

    await logAudit(client, null, `email.event.${mapped}`, 'campaign_recipients', recipientId, {
      messageId,
    });
  }

  return { ok: true, processed: events.length };
});
