import { z } from 'zod';
import type { CampaignKind } from '~/types/campaign.types';

const querySchema = z.object({
  kind: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const q = querySchema.parse(getQuery(event));
  const kind = q.kind as CampaignKind;
  const { client } = await requireScope(event, scopeForKind(kind));

  const { data, error } = await client
    .from('campaign_lists')
    .select('id, kind, name, source_filename, row_count, uploaded_by, created_at, warnings')
    .eq('kind', kind)
    .order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data;
});
