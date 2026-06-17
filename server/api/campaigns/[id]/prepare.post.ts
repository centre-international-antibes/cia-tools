import { z } from 'zod';
import type { EligibilityFlags } from '~/types/campaign.types';

const schema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1),
});

/**
 * Materializes campaign_recipients from a selected subset of the campaign's
 * list. Idempotent — re-running with the same subset is a no-op thanks to the
 * (campaign_id, contact_id) uniqueness.
 */
export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'id');
  if (!campaignId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const body = schema.parse(await readBody(event));
  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);

  const { data: campaign } = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Not found.' });
  if (campaign.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Campaign is no longer editable.' });
  }
  if (profile.role !== 'admin' && !profile.scopes.includes(scopeForKind(campaign.kind))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden.' });
  }

  const cfg = getKindConfig(campaign.kind);

  const { data: contacts } = await client
    .from('campaign_contacts')
    .select('*')
    .eq('list_id', campaign.list_id)
    .in('id', body.contact_ids);
  if (!contacts) throw createError({ statusCode: 500, statusMessage: 'Contact fetch failed.' });

  // Build a ParsedContactRow-shaped object so we can reuse buildParams().
  const rows = contacts.map((c) => ({
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    language: (c.language === 'en' ? 'en' : 'fr') as 'fr' | 'en',
    group_key: c.group_key,
    raw: (c.raw ?? {}) as Record<string, unknown>,
    eligibility: (c.eligibility ?? {}) as EligibilityFlags,
    contactId: c.id,
  }));

  const records = rows.map((r) => ({
    campaign_id: campaignId,
    contact_id: r.contactId,
    email: r.email,
    params: cfg.buildParams(r) as Record<string, unknown>,
    status: 'pending' as const,
  }));

  const { error } = await client
    .from('campaign_recipients')
    .upsert(records, { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  await client
    .from('campaigns')
    .update({ total_recipients: records.length })
    .eq('id', campaignId);

  await logAudit(client, user.sub, 'campaign.prepare', 'campaigns', campaignId, {
    count: records.length,
  });
  return { prepared: records.length };
});
