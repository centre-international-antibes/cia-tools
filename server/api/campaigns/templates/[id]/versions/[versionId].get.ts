
export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId');
  if (!versionId) throw createError({ statusCode: 400, statusMessage: 'Missing version id.' });

  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  const { data, error } = await client
    .from('email_template_versions')
    .select('*')
    .eq('id', versionId)
    .single();
  if (error || !data) throw createError({ statusCode: 404, statusMessage: 'Version not found.' });
  return data;
});
