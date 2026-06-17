
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: list } = await client
    .from('campaign_lists')
    .select('id, uploaded_by, source_file_path')
    .eq('id', id)
    .single();
  if (!list) throw createError({ statusCode: 404, statusMessage: 'Not found.' });

  if (profile.role !== 'admin' && list.uploaded_by !== user.sub) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }

  const { count } = await client
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', id);
  if ((count ?? 0) > 0 && profile.role !== 'admin') {
    throw createError({
      statusCode: 409,
      statusMessage: 'List is referenced by campaigns. Ask an admin to delete it.',
    });
  }

  await client.storage.from('campaign-imports').remove([list.source_file_path]);
  const { error } = await client.from('campaign_lists').delete().eq('id', id);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  await logAudit(client, user.sub, 'list.delete', 'campaign_lists', id, {});

  return { success: true };
});
