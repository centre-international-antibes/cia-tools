import { z } from 'zod';

const schema = z.object({
  versionId: z.string().uuid().optional(),
  params: z.record(z.unknown()).default({}),
});

/**
 * Renders a template version with the supplied params and returns the result.
 * If versionId is omitted, the template's current_version_id is used.
 */
export default defineEventHandler(async (event) => {
  const templateId = getRouterParam(event, 'id');
  if (!templateId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const body = schema.parse(await readBody(event));
  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  let versionId = body.versionId;
  if (!versionId) {
    const { data: tpl } = await client
      .from('email_templates')
      .select('current_version_id')
      .eq('id', templateId)
      .single();
    versionId = tpl?.current_version_id ?? undefined;
  }
  if (!versionId) {
    throw createError({ statusCode: 400, statusMessage: 'No template version available.' });
  }

  const { data: version, error } = await client
    .from('email_template_versions')
    .select('*')
    .eq('id', versionId)
    .single();
  if (error || !version) throw createError({ statusCode: 404, statusMessage: 'Version not found.' });

  // Hydrate defaults from variable samples so previews never look empty.
  const schemaSamples: Record<string, unknown> = {};
  const vars = Array.isArray(version.variables_schema)
    ? (version.variables_schema as Array<{ key: string; sample?: unknown }>)
    : [];
  for (const v of vars) if (v.sample !== undefined) schemaSamples[v.key] = v.sample;
  const params = { ...schemaSamples, ...body.params };

  return renderTemplate(version, params);
});
