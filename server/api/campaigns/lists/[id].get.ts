
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data, error } = await client
    .from('campaign_lists')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'List not found.' });
  }
  return data;
});
