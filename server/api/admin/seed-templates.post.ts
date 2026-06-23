/**
 * POST /api/admin/seed-templates
 *
 * Idempotent: safe to call repeatedly. Re-seeds every (kind, variant, lang)
 * combo declared in `DEFAULT_TEMPLATES`. Templates whose description starts
 * with `[custom]` are skipped so operator-edited rows are never overwritten.
 */
export default defineEventHandler(async (event) => {
  const { client, user } = await requireAdmin(event);

  const result = await seedDefaultTemplates(client, { ownerId: user.sub });

  await logAudit(client, user.sub, 'templates.seed', 'email_templates', null, {
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
  });

  return result;
});
