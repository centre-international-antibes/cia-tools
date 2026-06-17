import { z } from 'zod';
import type { CampaignKind } from '~/types/campaign.types';

const schema = z.object({ kind: z.string() });

export default defineEventHandler(async (event) => {
  const q = schema.parse(getQuery(event));
  const kind = q.kind as CampaignKind;
  const { client } = await requireScope(event, scopeForKind(kind));

  const { data, error } = await client
    .from('campaigns')
    .select('*')
    .eq('kind', kind)
    .order('created_at', { ascending: false });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return data;
});
