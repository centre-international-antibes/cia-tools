import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  const listId = getRouterParam(event, 'id');
  if (!listId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  const q = querySchema.parse(getQuery(event));

  const { data, error, count } = await client
    .from('campaign_contacts')
    .select('*', { count: 'exact' })
    .eq('list_id', listId)
    .order('created_at', { ascending: true })
    .range(q.offset, q.offset + q.limit - 1);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return { rows: data ?? [], total: count ?? 0 };
});
