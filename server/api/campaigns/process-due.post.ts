import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

/**
 * Drains every campaign with pending work, up to a per-request deadline.
 *
 * Host-agnostic by design: anything that can issue an authenticated POST can
 * drive it \u2014 Vercel Cron, a systemd timer, GitHub Actions, Supabase pg_cron
 * via pg_net, or just a manual `curl` from an operator.
 *
 * Auth: shared secret in `Authorization: Bearer <CAMPAIGN_PROCESSOR_SECRET>`.
 * The secret is read from runtimeConfig so it never leaks to the client.
 * If the env var is unset the endpoint refuses to run (fail-closed).
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const secret = config.campaignProcessorSecret;
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'CAMPAIGN_PROCESSOR_SECRET is not configured.',
    });
  }

  const auth = getRequestHeader(event, 'authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (provided.length !== secret.length
    || !timingSafeEqualString(provided, secret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' });
  }

  // Reserve ~10s headroom under typical 60s function limits so we always
  // finalize counters cleanly between batches.
  const budgetMs = Number(getQuery(event).budgetMs ?? 50_000);
  const deadlineMs = Date.now() + Math.max(5_000, Math.min(budgetMs, 290_000));

  const serviceClient = serverSupabaseServiceRole<Database>(event);
  const result = await runPendingCampaigns(
    {
      client: serviceClient,
      brevo: {
        apiKey: config.brevo.apiKey,
        senderEmail: config.brevo.senderEmail,
        senderName: config.brevo.senderName,
        replyTo: config.brevo.replyTo,
      },
      payzen: {
        apiUrl: config.payzen.apiUrl,
        username: config.payzen.username,
        password: config.payzen.password,
        hmacKey: config.payzen.hmacKey,
        returnUrl: config.payzen.returnUrl,
        ipnTargetUrl: config.payzen.ipnTargetUrl,
        paymentReceiptEmail: config.payzen.paymentReceiptEmail,
      },
      brand: getBrand(event),
    },
    { deadlineMs },
  );

  return {
    success: true,
    deadlineMs,
    ...result,
  };
});

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
