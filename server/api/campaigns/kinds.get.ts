
/**
 * Returns the kind registry metadata visible to the caller.
 * The client uses this to render the kind grid + per-kind form scaffolding.
 */
export default defineEventHandler(async (event) => {
  const { profile } = await requireAnyScope(event, [...CAMPAIGN_SCOPES]);
  const isAdmin = profile.role === 'admin';

  return listKindConfigs()
    .filter((k) => isAdmin || profile.scopes.includes(k.scope))
    .map((k) => ({
      kind: k.kind,
      labelKey: k.labelKey,
      descriptionKey: k.descriptionKey,
      icon: k.icon,
      scope: k.scope,
      requiredColumns: k.requiredColumns,
      optionalColumns: k.optionalColumns,
      variants: k.variants,
      templateVariables: k.templateVariables,
      requiresPaymentLink: !!k.requiresPaymentLink,
    }));
});
