import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import { sendTransacEmail, BrevoError } from './brevo';
import { renderTemplate } from './templateRenderer';

/**
 * Sends a one-off email using a template version + arbitrary params.
 * Records the attempt in test_sends. Never touches campaign statistics.
 */
export async function performTestSend(
  client: SupabaseClient<Database>,
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
    replyTo: string;
  },
  args: {
    templateVersionId: string;
    campaignId: string | null;
    sampleContactId: string | null;
    recipientEmail: string;
    params: Record<string, unknown>;
    sentBy: string;
  },
): Promise<{ id: string; status: 'sent' | 'failed'; messageId: string | null; error: string | null }> {
  const { data: version, error: vErr } = await client
    .from('email_template_versions')
    .select('*')
    .eq('id', args.templateVersionId)
    .single();

  if (vErr || !version) throw new Error('Template version not found.');

  // Merge sample params from the schema as fallback values so previews always render.
  const schemaSamples: Record<string, unknown> = {};
  const schema = Array.isArray(version.variables_schema)
    ? (version.variables_schema as Array<{ key: string; sample?: unknown }>)
    : [];
  for (const v of schema) {
    if (v.sample !== undefined) schemaSamples[v.key] = v.sample;
  }
  const finalParams = { ...schemaSamples, ...args.params };

  const { data: row, error: insertErr } = await client
    .from('test_sends')
    .insert({
      template_version_id: args.templateVersionId,
      campaign_id: args.campaignId,
      sample_contact_id: args.sampleContactId,
      recipient_email: args.recipientEmail,
      params: finalParams,
      status: 'pending',
      sent_by: args.sentBy,
    })
    .select()
    .single();

  if (insertErr || !row) throw new Error(insertErr?.message ?? 'Failed to log test send.');

  try {
    const rendered = renderTemplate(version, finalParams);
    const result = await sendTransacEmail(brevo.apiKey, {
      to: [{ email: args.recipientEmail }],
      subject: `[TEST] ${rendered.subject}`,
      htmlContent: rendered.html,
      textContent: rendered.plaintext,
      sender: { email: brevo.senderEmail, name: brevo.senderName },
      replyTo: brevo.replyTo
        ? { email: brevo.replyTo, name: brevo.senderName }
        : undefined,
      tags: ['test-send', `template_version:${args.templateVersionId}`],
      headers: { 'X-CIA-Test': 'true' },
    });
    await client
      .from('test_sends')
      .update({ status: 'sent', brevo_message_id: result.messageId })
      .eq('id', row.id);
    return { id: row.id, status: 'sent', messageId: result.messageId, error: null };
  } catch (err) {
    const message =
      err instanceof BrevoError
        ? `[Brevo ${err.statusCode}] ${err.message}`
        : (err as Error).message;
    await client.from('test_sends').update({ status: 'failed', error: message }).eq('id', row.id);
    return { id: row.id, status: 'failed', messageId: null, error: message };
  }
}
