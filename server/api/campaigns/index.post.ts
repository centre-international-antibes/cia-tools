import { z } from 'zod';
import type { CampaignKind } from '~/types/campaign.types';
import { CAMPAIGN_KINDS } from '#server/utils/campaignScopes';

const schema = z.object({
  kind: z.enum(CAMPAIGN_KINDS as unknown as [string, ...string[]]),
  name: z.string().min(1),
  list_id: z.string().uuid(),
  notes: z.string().default(''),
});

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));
  const kind = body.kind as CampaignKind;
  const { client, user } = await requireScope(event, scopeForKind(kind));

  const { data: list } = await client
    .from('campaign_lists')
    .select('id, kind')
    .eq('id', body.list_id)
    .single();
  if (!list || list.kind !== kind) {
    throw createError({ statusCode: 400, statusMessage: 'List does not match kind.' });
  }

  const { data, error } = await client
    .from('campaigns')
    .insert({
      kind,
      name: body.name,
      list_id: body.list_id,
      notes: body.notes,
      created_by: user.sub,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  await logAudit(client, user.sub, 'campaign.create', 'campaigns', data.id, {
    kind,
    list_id: body.list_id,
  });
  return data;
});
