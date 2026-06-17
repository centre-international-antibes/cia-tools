
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  const { data: campaign } = await client
    .from('campaigns')
    .select('id, kind, status, created_by')
    .eq('id', id)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });

  if (campaign.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Only drafts can be deleted.' });
  }
  if (profile.role !== 'admin' && campaign.created_by !== user.sub) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }
  if (profile.role !== 'admin' && !profile.scopes.includes(scopeForKind(campaign.kind))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }

  const { error } = await client.from('campaigns').delete().eq('id', id);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  await logAudit(client, user.sub, 'campaign.delete', 'campaigns', id, {});
  return { success: true };
});
