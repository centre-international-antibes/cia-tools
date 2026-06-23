import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
  template_id: z.string().uuid().nullable().optional(),
  template_version_id: z.string().uuid().nullable().optional(),
  template_overrides: z.record(z.string().uuid()).optional(),
  params_default: z.record(z.unknown()).optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });
  const body = schema.parse(await readBody(event));

  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: campaign } = await client
    .from('campaigns')
    .select('id, kind, status')
    .eq('id', id)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });
  if (campaign.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Campaign is no longer editable.' });
  }
  const requiredScope = scopeForKind(campaign.kind);
  if (profile.role !== 'admin' && !profile.scopes.includes(requiredScope)) {
    throw createError({ statusCode: 403, statusMessage: `Scope ${requiredScope} required.` });
  }

  const { data, error } = await client
    .from('campaigns')
    .update(body)
    .eq('id', id)
    .select()
    .single();
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  await logAudit(client, user.sub, 'campaign.update', 'campaigns', id, body);
  return data;
});
