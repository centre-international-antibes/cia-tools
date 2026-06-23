import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import { sendTransacEmail, BrevoError } from './brevo';
import { renderTemplate } from './templateRenderer';
import { logAudit } from './audit';
import { ensurePaymentLinkForContact } from './paymentLinks';
import { getKindConfig } from './campaignKinds';
import { brandToHandlebarsParams, type BrandContext } from './brand';
import { PayzenError, type PayzenConfig } from './payzen';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

interface SendCtx {
  client: SupabaseClient<Database>;
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
    replyTo: string;
  };
  payzen: PayzenConfig;
  brand: BrandContext;
}

/**
 * Orchestrates the actual sending of a queued campaign.
 *
 * - Idempotent: only acts on recipients whose status is in ('pending', 'queued', 'failed').
 * - Resumable: if the process dies mid-batch, calling run() again picks up where it left off.
 * - Updates the parent campaign's aggregate counters at the end of each batch.
 */
export async function runCampaignSend(ctx: SendCtx, campaignId: string): Promise<void> {
  const { client } = ctx;

  // Lock the campaign for sending.
  const { data: campaign, error } = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) throw new Error(`Campaign ${campaignId} not found.`);
  if (campaign.status === 'aborted' || campaign.status === 'sent') return;
  if (!campaign.template_version_id) {
    throw new Error('Campaign has no template version assigned.');
  }

  await client
    .from('campaigns')
    .update({ status: 'sending', sent_at: campaign.sent_at ?? new Date().toISOString() })
    .eq('id', campaignId);

  await logAudit(client, campaign.sent_by, 'campaign.send.start', 'campaigns', campaignId, {
    kind: campaign.kind,
  });

  const { data: defaultVersion } = await client
    .from('email_template_versions')
    .select('*')
    .eq('id', campaign.template_version_id)
    .single();

  if (!defaultVersion) throw new Error('Template version vanished mid-send.');

  const kindCfg = getKindConfig(campaign.kind);

  // Resolve per-variant overrides up front. Each unique variant maps to at
  // most one template_version; if absent, recipients fall back to the
  // campaign's default version.
  const overrideMap = (campaign.template_overrides ?? {}) as Record<string, string>;
  const overrideVersionIds = Array.from(
    new Set(Object.values(overrideMap).filter((v): v is string => typeof v === 'string' && v.length > 0)),
  );
  const versionsById = new Map<string, typeof defaultVersion>();
  versionsById.set(defaultVersion.id, defaultVersion);
  if (overrideVersionIds.length) {
    const { data: extraVersions } = await client
      .from('email_template_versions')
      .select('*')
      .in('id', overrideVersionIds);
    for (const v of extraVersions ?? []) versionsById.set(v.id, v);
  }
  function pickVersion(variant: string | null): typeof defaultVersion {
    if (variant && overrideMap[variant]) {
      const v = versionsById.get(overrideMap[variant]);
      if (v) return v;
    }
    return defaultVersion;
  }

  let processed = 0;
  while (true) {
    const { data: batch } = await client
      .from('campaign_recipients')
      .select('id, contact_id, email, params, status, attempts, variant')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'queued', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (!batch || batch.length === 0) break;

    for (const recipient of batch) {
      processed += 1;
      try {
        let params = (recipient.params ?? {}) as Record<string, unknown>;

        if (kindCfg.requiresPaymentLink) {
          const { data: contact } = await client
            .from('campaign_contacts')
            .select('*')
            .eq('id', recipient.contact_id)
            .single();
          if (!contact) throw new Error('Contact missing.');

          const amount = (contact.eligibility as Record<string, unknown>)?.amount_cents;
          if (typeof amount !== 'number') {
            throw new Error('No amount on contact — cannot create payment link.');
          }
          const proforma = String(
            (contact.eligibility as Record<string, unknown>)?.proforma ?? '',
          ) || null;
          const link = await ensurePaymentLinkForContact(client, ctx.payzen, {
            contactId: contact.id,
            campaignId,
            email: recipient.email,
            firstName: contact.first_name,
            lastName: contact.last_name,
            amountCents: amount,
            currency: String((contact.raw as Record<string, unknown>)?.currency ?? 'EUR'),
            language: contact.language === 'en' ? 'en' : 'fr',
            proforma,
          });
          params = { ...params, payment_url: link.paymentUrl };
        }

        const language = (recipient.params as Record<string, unknown>)?.language === 'en' ? 'en' : 'fr';
        params = {
          ...brandToHandlebarsParams(ctx.brand, language),
          ...params,
        };

        const version = pickVersion(recipient.variant);
        const rendered = renderTemplate(version, params);

        if (rendered.missingVariables.length) {
          throw new Error(
            `Missing required variables: ${rendered.missingVariables.join(', ')}`,
          );
        }

        const sendRes = await sendTransacEmail(ctx.brevo.apiKey, {
          to: [{ email: recipient.email }],
          subject: rendered.subject,
          htmlContent: rendered.html,
          textContent: rendered.plaintext,
          sender: { email: ctx.brevo.senderEmail, name: ctx.brevo.senderName },
          replyTo: ctx.brevo.replyTo
            ? { email: ctx.brevo.replyTo, name: ctx.brevo.senderName }
            : undefined,
          tags: [`campaign:${campaign.kind}`, `campaign_id:${campaignId}`],
          headers: { 'X-CIA-Campaign': campaignId, 'X-CIA-Recipient': recipient.id },
        });

        await client
          .from('campaign_recipients')
          .update({
            status: 'sent',
            brevo_message_id: sendRes.messageId,
            attempts: recipient.attempts + 1,
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', recipient.id);
      } catch (err) {
        const message =
          err instanceof BrevoError
            ? `[Brevo ${err.statusCode}] ${err.message}`
            : err instanceof PayzenError
              ? err.toDisplayString()
              : (err as Error).message;
        if (err instanceof PayzenError) {
          console.error('[campaignSender] payzen error', {
            campaignId,
            recipientId: recipient.id,
            statusCode: err.statusCode,
            code: err.code,
            detailedCode: err.detailedCode,
            detailedMessage: err.detailedMessage,
            endpoint: err.endpoint,
            payload: err.payload,
          });
        }
        const attempts = recipient.attempts + 1;
        await client
          .from('campaign_recipients')
          .update({
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
            attempts,
            error: message,
          })
          .eq('id', recipient.id);
      }
    }

    // Refresh aggregate counters.
    await refreshCampaignCounters(client, campaignId);
  }

  // Finalize.
  const { data: counters } = await client
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaignId);

  const total = counters?.length ?? 0;
  const sent = counters?.filter((r) => ['sent', 'delivered', 'opened', 'clicked'].includes(r.status)).length ?? 0;
  const failed = counters?.filter((r) => ['failed', 'hard_bounce'].includes(r.status)).length ?? 0;

  const finalStatus: Database['public']['Enums']['campaign_status'] =
    failed === 0
      ? 'sent'
      : sent === 0
        ? 'failed'
        : 'partially_failed';

  await client
    .from('campaigns')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      total_recipients: total,
      sent_count: sent,
      failed_count: failed,
    })
    .eq('id', campaignId);

  await logAudit(client, campaign.sent_by, 'campaign.send.complete', 'campaigns', campaignId, {
    status: finalStatus,
    sent,
    failed,
    total,
  });

  processed; // silence unused
}

async function refreshCampaignCounters(
  client: SupabaseClient<Database>,
  campaignId: string,
): Promise<void> {
  const { data } = await client
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaignId);
  if (!data) return;
  const total = data.length;
  const sent = data.filter((r) =>
    ['sent', 'delivered', 'opened', 'clicked'].includes(r.status),
  ).length;
  const failed = data.filter((r) => ['failed', 'hard_bounce'].includes(r.status)).length;
  await client
    .from('campaigns')
    .update({ total_recipients: total, sent_count: sent, failed_count: failed })
    .eq('id', campaignId);
}
