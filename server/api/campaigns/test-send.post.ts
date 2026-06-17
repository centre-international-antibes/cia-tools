import { z } from 'zod';

const schema = z.object({
  template_version_id: z.string().uuid(),
  recipient_email: z.string().email().optional(),
  sample_contact_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  params: z.record(z.unknown()).default({}),
});

// Simple in-memory per-user rate limit: 10 test sends per minute.
const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 10;
const WINDOW_MS = 60_000;

function rateLimit(userId: string): void {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= LIMIT) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many test sends. Wait a minute and try again.',
    });
  }
  bucket.count += 1;
}

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));
  const { client, user, profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  rateLimit(user.sub);

  const config = useRuntimeConfig();
  if (!config.brevo.apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Brevo is not configured.' });
  }

  const recipient = body.recipient_email ?? profile.email;
  if (!recipient) throw createError({ statusCode: 400, statusMessage: 'No recipient email.' });

  let params = body.params;
  if (body.sample_contact_id) {
    const { data: contact } = await client
      .from('campaign_contacts')
      .select('*')
      .eq('id', body.sample_contact_id)
      .single();
    if (contact) {
      const eligibility = contact.eligibility as Record<string, unknown>;
      params = {
        first_name: contact.first_name,
        last_name: contact.last_name,
        ...eligibility,
        ...params,
      };
    }
  }

  return performTestSend(
    client,
    {
      apiKey: config.brevo.apiKey,
      senderEmail: config.brevo.senderEmail,
      senderName: config.brevo.senderName,
      replyTo: config.brevo.replyTo,
    },
    {
      templateVersionId: body.template_version_id,
      campaignId: body.campaign_id ?? null,
      sampleContactId: body.sample_contact_id ?? null,
      recipientEmail: recipient,
      params,
      sentBy: user.sub,
    },
  );
});
