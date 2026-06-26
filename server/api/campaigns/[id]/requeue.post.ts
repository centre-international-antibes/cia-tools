/**
 * Resets exhausted recipients back to `queued` (attempts = 0) so the next
 * processor tick retries them. Use after fixing the root cause of a batch of
 * failures (e.g. Brevo outage, bad template variable).
 *
 * Does NOT trigger a send by itself \u2014 call `/process` or wait for the next
 * scheduler tick afterward.
 */
export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'id');
  if (!campaignId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: campaign } = await client
    .from('campaigns')
    .select('id, kind, status')
    .eq('id', campaignId)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });
  if (profile.role !== 'admin' && !profile.scopes.includes(scopeForKind(campaign.kind))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }
  if (campaign.status === 'aborted') {
    throw createError({ statusCode: 409, statusMessage: 'Campaign is aborted.' });
  }

  const { data: reset, error } = await client
    .from('campaign_recipients')
    .update({ status: 'queued', attempts: 0, error: null })
    .eq('campaign_id', campaignId)
    .in('status', ['failed'])
    .select('id');
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  // Flip the parent campaign back into a resumable state so the processor
  // picks it up on the next tick.
  if (campaign.status === 'sent' || campaign.status === 'failed' || campaign.status === 'partially_failed') {
    await client.from('campaigns').update({ status: 'queued' }).eq('id', campaignId);
  }

  await logAudit(client, user.sub, 'campaign.requeue', 'campaigns', campaignId, {
    reset_count: reset?.length ?? 0,
  });

  return { success: true, resetCount: reset?.length ?? 0 };
});
