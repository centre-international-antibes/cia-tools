import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

/**
 * Manual "retry pending sends" trigger for a single campaign.
 *
 * Reuses `runCampaignSend`, which only acts on rows in
 * (pending, queued, failed) with attempts < MAX_ATTEMPTS. Safe to call
 * repeatedly; idempotent against already-sent recipients.
 *
 * If recipients are stuck in `failed` (3 attempts exhausted), call
 * `/api/campaigns/:id/requeue` first to reset them.
 */
export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'id');
  if (!campaignId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: campaign } = await client
    .from('campaigns')
    .select('id, kind, status, template_version_id, total_recipients')
    .eq('id', campaignId)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });
  if (profile.role !== 'admin' && !profile.scopes.includes(scopeForKind(campaign.kind))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }
  if (!campaign.template_version_id) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a template version first.' });
  }
  if (!['queued', 'sending', 'partially_failed'].includes(campaign.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Nothing to process for status "${campaign.status}".`,
    });
  }

  await logAudit(client, user.sub, 'campaign.process', 'campaigns', campaignId, {});

  const config = useRuntimeConfig();
  const serviceClient = serverSupabaseServiceRole<Database>(event);
  void runCampaignSend(
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
    campaignId,
    { deadlineMs: Date.now() + 50_000 },
  ).catch((err) => {
    console.error('[campaign-process] failed', { campaignId, err });
  });

  return { success: true, campaignId };
});
