
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });
  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: tpl, error } = await client
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !tpl) throw createError({ statusCode: 404, statusMessage: 'Template not found.' });

  const { data: versions } = await client
    .from('email_template_versions')
    .select('id, version, subject, variables_schema, created_at, created_by')
    .eq('template_id', id)
    .order('version', { ascending: false });

  return { template: tpl, versions: versions ?? [] };
});
