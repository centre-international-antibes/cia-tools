import { z } from 'zod';
import { serverSupabaseServiceRole } from '#supabase/server';
import type { Database } from '~/types/database.types';

const schema = z.object({
  client_request_id: z.string().uuid(),
});

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'id');
  if (!campaignId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });
  const body = schema.parse(await readBody(event));

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: campaign } = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });
  if (profile.role !== 'admin' && !profile.scopes.includes(scopeForKind(campaign.kind))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }
  if (!campaign.template_version_id) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a template version first.' });
  }
  if (campaign.total_recipients === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No recipients prepared.' });
  }
  if (!['draft', 'queued', 'partially_failed'].includes(campaign.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot send a campaign in status "${campaign.status}".`,
    });
  }

  // Idempotency: refuse to re-queue with a different client_request_id once one is set.
  if (campaign.client_request_id && campaign.client_request_id !== body.client_request_id) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Campaign already queued with a different request id.',
    });
  }

  const { error } = await client
    .from('campaigns')
    .update({
      status: 'queued',
      client_request_id: body.client_request_id,
      sent_by: user.sub,
    })
    .eq('id', campaignId);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  await logAudit(client, user.sub, 'campaign.queue', 'campaigns', campaignId, {});

  // Fire-and-forget background processing. The handler returns immediately so
  // the UI doesn't block; the sender runs with the service-role client.
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
      },
      brand: getBrand(event),
    },
    campaignId,
  ).catch((err) => {
    console.error('[campaign-send] failed', { campaignId, err });
  });

  return { success: true, campaignId };
});
