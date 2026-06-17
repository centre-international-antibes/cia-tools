import { z } from 'zod';
import type { CampaignKind } from '~/types/campaign.types';
import { CAMPAIGN_KINDS } from '#server/utils/campaignScopes';

const schema = z.object({
  kind: z.enum(CAMPAIGN_KINDS as unknown as [string, ...string[]]),
  name: z.string().min(1),
  language: z.enum(['fr', 'en']).default('fr'),
  variant: z.string().min(1).default('default'),
  description: z.string().default(''),
});

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));
  const kind = body.kind as CampaignKind;
  const { client, user } = await requireScope(event, scopeForKind(kind));

  const { data, error } = await client
    .from('email_templates')
    .insert({
      kind,
      name: body.name,
      language: body.language,
      variant: body.variant,
      description: body.description,
      created_by: user.sub,
    })
    .select()
    .single();

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  await logAudit(client, user.sub, 'template.create', 'email_templates', data.id, body);
  return data;
});
