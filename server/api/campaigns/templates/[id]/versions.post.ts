import { z } from 'zod';

const variableSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'url', 'array', 'object']),
  required: z.boolean().default(false),
  sample: z.unknown().optional(),
  description: z.string().optional(),
});

const schema = z.object({
  subject: z.string().min(1),
  mjml: z.string().min(1),
  variables_schema: z.array(variableSchema).default([]),
  activate: z.boolean().default(true),
});

export default defineEventHandler(async (event) => {
  const templateId = getRouterParam(event, 'id');
  if (!templateId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const body = schema.parse(await readBody(event));
  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: tpl, error } = await client
    .from('email_templates')
    .select('id, kind')
    .eq('id', templateId)
    .single();
  if (error || !tpl) throw createError({ statusCode: 404, statusMessage: 'Template not found.' });

  const requiredScope = scopeForKind(tpl.kind);
  if (profile.role !== 'admin' && !profile.scopes.includes(requiredScope)) {
    throw createError({ statusCode: 403, statusMessage: `Scope ${requiredScope} required.` });
  }

  const compiled = compileMjml(body.mjml);
  if (compiled.errors.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MJML compilation failed.',
      data: { errors: compiled.errors },
    });
  }

  const { data: previous } = await client
    .from('email_template_versions')
    .select('version')
    .eq('template_id', templateId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (previous?.version ?? 0) + 1;

  const { data: version, error: insertErr } = await client
    .from('email_template_versions')
    .insert({
      template_id: templateId,
      version: nextVersion,
      subject: body.subject,
      mjml: body.mjml,
      compiled_html: compiled.html,
      plaintext: compiledHtmlToPlaintext(compiled.html),
      variables_schema: body.variables_schema,
      created_by: user.sub,
    })
    .select()
    .single();

  if (insertErr || !version) {
    throw createError({ statusCode: 500, statusMessage: insertErr?.message ?? 'Insert failed.' });
  }

  if (body.activate) {
    await client
      .from('email_templates')
      .update({ current_version_id: version.id })
      .eq('id', templateId);
  }

  clearTemplateCache(version.id);
  await logAudit(client, user.sub, 'template.version.create', 'email_template_versions', version.id, {
    template_id: templateId,
    version: nextVersion,
  });

  return version;
});
