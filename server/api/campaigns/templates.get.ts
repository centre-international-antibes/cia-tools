import { z } from 'zod';
import type { CampaignKind } from '~/types/campaign.types';

const schema = z.object({
  kind: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  const q = schema.parse(getQuery(event));

  let query = client
    .from('email_templates')
    .select('*, current_version:email_template_versions!fk_email_templates_current_version(id, version, subject, created_at)')
    .order('created_at', { ascending: false });
  if (q.kind) query = query.eq('kind', q.kind as CampaignKind);

  const { data, error } = await query;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return data;
});
