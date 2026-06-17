
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  const { data: campaign } = await client
    .from('campaigns')
    .select('id, kind, status')
    .eq('id', id)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });
  if (profile.role !== 'admin' && !profile.scopes.includes(scopeForKind(campaign.kind))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }
  if (!['queued', 'sending', 'partially_failed'].includes(campaign.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Nothing to abort.' });
  }

  await client.from('campaigns').update({ status: 'aborted' }).eq('id', id);
  await client
    .from('campaign_recipients')
    .update({ status: 'skipped' })
    .eq('campaign_id', id)
    .in('status', ['pending', 'queued']);

  await logAudit(client, user.sub, 'campaign.abort', 'campaigns', id, {});
  return { success: true };
});
