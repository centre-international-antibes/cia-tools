import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import type { CampaignKind } from '~/types/campaign.types';
import { DEFAULT_TEMPLATES } from './mjml/templates';
import type { DefaultTemplate } from './mjml/templates/types';
import { compileMjml, compiledHtmlToPlaintext } from './templateRenderer';

/**
 * Marker prefix on `email_templates.description` that tells the seeder to
 * skip an entry. Operators can put `[custom]` at the start of a description
 * to lock the row against future seeding overwrites.
 */
const CUSTOM_MARKER = /^\s*\[custom\]/i;

export interface SeedResult {
  created: number;
  updated: number;
  skipped: number;
  details: Array<{
    kind: CampaignKind;
    language: 'fr' | 'en';
    variant: string;
    action: 'created' | 'updated' | 'skipped';
    reason?: string;
  }>;
}

interface SeederOptions {
  /** Required: `profiles.id` of the user the seeded rows are attributed to. */
  ownerId: string;
}

/**
 * Idempotent seeder. For each `(kind, variant, language)` in `DEFAULT_TEMPLATES`:
 *   - missing → insert email_templates + v1.
 *   - present + MJML matches latest version → no-op.
 *   - present + MJML differs → insert v(N+1) and activate.
 *   - present + description starts with `[custom]` → skip.
 */
export async function seedDefaultTemplates(
  client: SupabaseClient<Database>,
  opts: SeederOptions,
): Promise<SeedResult> {
  const result: SeedResult = { created: 0, updated: 0, skipped: 0, details: [] };

  for (const [kindKey, byVariant] of Object.entries(DEFAULT_TEMPLATES)) {
    const kind = kindKey as CampaignKind;
    for (const [variant, byLang] of Object.entries(byVariant)) {
      for (const [lang, tpl] of Object.entries(byLang) as Array<['fr' | 'en', DefaultTemplate]>) {
        const action = await seedOne(client, opts.ownerId, kind, variant, lang, tpl);
        result.details.push({ kind, variant, language: lang, ...action });
        if (action.action === 'created') result.created++;
        else if (action.action === 'updated') result.updated++;
        else result.skipped++;
      }
    }
  }
  return result;
}

async function seedOne(
  client: SupabaseClient<Database>,
  ownerId: string,
  kind: CampaignKind,
  variant: string,
  language: 'fr' | 'en',
  tpl: DefaultTemplate,
): Promise<{ action: 'created' | 'updated' | 'skipped'; reason?: string }> {
  const compiled = compileMjml(tpl.mjml);
  if (compiled.errors.length) {
    return { action: 'skipped', reason: `MJML errors: ${compiled.errors.join('; ')}` };
  }
  const plaintext = compiledHtmlToPlaintext(compiled.html);

  const { data: existingTpl } = await client
    .from('email_templates')
    .select('id, current_version_id, description')
    .eq('kind', kind)
    .eq('variant', variant)
    .eq('language', language)
    .maybeSingle();

  if (existingTpl && CUSTOM_MARKER.test(existingTpl.description ?? '')) {
    return { action: 'skipped', reason: 'marked [custom]' };
  }

  // ── No template row yet: insert + v1 ──────────────────────
  if (!existingTpl) {
    const { data: inserted, error: tplErr } = await client
      .from('email_templates')
      .insert({
        kind,
        name: defaultName(kind, variant, language),
        language,
        variant,
        description: defaultDescription(kind, variant, language),
        created_by: ownerId,
      })
      .select('id')
      .single();
    if (tplErr || !inserted) {
      return { action: 'skipped', reason: tplErr?.message ?? 'insert failed' };
    }
    const versionId = await insertVersion(client, inserted.id, 1, tpl, compiled.html, plaintext, ownerId);
    if (versionId) {
      await client.from('email_templates').update({ current_version_id: versionId }).eq('id', inserted.id);
    }
    return { action: 'created' };
  }

  // ── Has a row: compare MJML, possibly insert a new version ─
  if (!existingTpl.current_version_id) {
    const versionId = await insertVersion(client, existingTpl.id, 1, tpl, compiled.html, plaintext, ownerId);
    if (versionId) {
      await client.from('email_templates').update({ current_version_id: versionId }).eq('id', existingTpl.id);
    }
    return { action: 'updated', reason: 'no active version' };
  }

  const { data: latest } = await client
    .from('email_template_versions')
    .select('id, version, mjml, subject')
    .eq('id', existingTpl.current_version_id)
    .single();

  if (latest && latest.mjml === tpl.mjml && latest.subject === tpl.subject) {
    return { action: 'skipped', reason: 'up to date' };
  }

  const { data: maxVer } = await client
    .from('email_template_versions')
    .select('version')
    .eq('template_id', existingTpl.id)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  const nextVer = (maxVer?.version ?? 0) + 1;

  const versionId = await insertVersion(client, existingTpl.id, nextVer, tpl, compiled.html, plaintext, ownerId);
  if (versionId) {
    await client.from('email_templates').update({ current_version_id: versionId }).eq('id', existingTpl.id);
  }
  return { action: 'updated' };
}

async function insertVersion(
  client: SupabaseClient<Database>,
  templateId: string,
  version: number,
  tpl: DefaultTemplate,
  compiledHtml: string,
  plaintext: string,
  ownerId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('email_template_versions')
    .insert({
      template_id: templateId,
      version,
      subject: tpl.subject,
      mjml: tpl.mjml,
      compiled_html: compiledHtml,
      plaintext,
      variables_schema: tpl.variables as unknown as Database['public']['Tables']['email_template_versions']['Insert']['variables_schema'],
      created_by: ownerId,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[seed-templates] insert version failed', { templateId, error });
    return null;
  }
  return data?.id ?? null;
}

function defaultName(kind: CampaignKind, variant: string, language: 'fr' | 'en'): string {
  return `${kind} \u00b7 ${variant} \u00b7 ${language.toUpperCase()}`;
}

function defaultDescription(kind: CampaignKind, variant: string, language: 'fr' | 'en'): string {
  return `Default seeded template (${kind} / ${variant} / ${language}). Remove this description or prefix with "[custom]" to prevent seeder overrides.`;
}
