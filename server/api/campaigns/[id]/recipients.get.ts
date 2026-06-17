import { z } from 'zod';

const schema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'id');
  if (!campaignId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });
  const q = schema.parse(getQuery(event));

  const { client } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  let query = client
    .from('campaign_recipients')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .range(q.offset, q.offset + q.limit - 1);
  if (q.status) {
    query = query.eq(
      'status',
      q.status as 'pending' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'soft_bounce' | 'hard_bounce' | 'complained' | 'failed' | 'skipped',
    );
  }

  const { data, error, count } = await query;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return { rows: data ?? [], total: count ?? 0 };
});
