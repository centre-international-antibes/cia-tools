/**
 * CLI: seed the default email templates.
 *
 * Usage:
 *   npm run seed:templates
 *
 * Requires SUPABASE_URL + NUXT_SUPABASE_SECRET_KEY in the environment.
 * Picks the oldest admin profile as the seed `created_by`. If no admin exists
 * the script aborts loudly — there's no system user to fall back on.
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/types/database.types';
import { seedDefaultTemplates } from '../server/utils/seedDefaultTemplates';

loadEnv();

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NUXT_SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('[seed-templates] SUPABASE_URL and NUXT_SUPABASE_SECRET_KEY are required.');
    process.exit(1);
  }

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: admin, error } = await client
    .from('profiles')
    .select('id, email')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !admin) {
    console.error('[seed-templates] No admin profile found — create one first.', error);
    process.exit(1);
  }

  console.log(`[seed-templates] Seeding as admin ${admin.email}...`);
  const result = await seedDefaultTemplates(client, { ownerId: admin.id });
  console.log(`[seed-templates] created=${result.created} updated=${result.updated} skipped=${result.skipped}`);
  for (const d of result.details) {
    const tag = d.action === 'created' ? '+' : d.action === 'updated' ? '~' : '·';
    const reason = d.reason ? ` (${d.reason})` : '';
    console.log(`  ${tag} ${d.kind}/${d.variant}/${d.language}${reason}`);
  }
}

main().catch((err) => {
  console.error('[seed-templates] crashed', err);
  process.exit(1);
});
