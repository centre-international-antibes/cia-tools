import type { CampaignKind } from '~/types/campaign.types';

/**
 * Header normalization + alias dictionary.
 *
 * The ERP exports French headers with diacritics, dots and casing
 * (e.g. `Sem. Arr.`, `Hébergement`, `N° Proforma`). The kind registry
 * speaks canonical snake_case (e.g. `arrival_week`, `housing_residence`,
 * `proforma`). This module is the single bridge.
 *
 *   normalizeHeader('Hébergement')  // → 'hebergement'
 *   normalizeHeader('N° Proforma')  // → 'n_proforma'
 *
 * Aliases here are strictly the columns the operator actually exports —
 * see `example-docs/` for the canonical reference. Speculative
 * cross-language synonyms are deliberately excluded: every alias maps
 * an ERP header observed in production.
 */

/** Lowercase, strip diacritics, replace non-alphanumerics with `_`. */
export function normalizeHeader(h: string): string {
  return String(h)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Aliases shared by every kind. Limited to headers present in every ERP
 * export (identity, customer tag, audience, notes, reminders).
 */
const COMMON_ALIASES: Record<string, string> = {
  // Identity
  email: 'email',
  nom: 'full_name', // ERP `Nom` is "SURNAME Given"
  // Customer tag ("DIRECT 2", "Groupe …")
  nomto: 'nom_to',
  // ERP operator
  acteur: 'actor',
  // Audience flag (`A` adult / `J` junior)
  type: 'audience_tag',
  // Free-form notes
  notes: 'notes',
  // Past reminder columns ("Relance 1/2/3" — store as date-like strings)
  relance_1: 'reminder_1_at',
  relance_2: 'reminder_2_at',
  relance_3: 'reminder_3_at',
  // Common week columns
  sem_arr: 'arrival_week',
  sem_dep: 'departure_week',
  // Arrival / departure dates
  arrivee: 'arrival_date',
  depart: 'departure_date',
};

/**
 * Per-kind alias overrides.
 *
 * For `ats` and `payment_reminder` the entries are restricted to columns
 * actually present in the example exports (see `example-docs/ATS - liste
 * excel complète.xlsx` and `example-docs/Relance solde - liste complète.xlsx`).
 * Other kinds keep minimal mappings until their real ERP exports land.
 */
const ALIASES: Record<CampaignKind, Record<string, string>> = {
  ats: {
    // Per-document presence: empty cell = missing, anything else = on file.
    ats: 'ats_done',
    fiche_san: 'health_form_done',
    passeport: 'passport_done',
    // Housing
    hebergement: 'housing_residence',
    type_heb: 'housing_type',
    // Transfer (X if requested)
    transfert: 'transfer',
    // Arrival details
    arrivee_lieu: 'arrival_location',
    arrivee_heure: 'arrival_time',
    arrivee_info: 'arrival_info',
  },
  ats_late_arrival: {
    hebergement: 'housing_residence',
    type_heb: 'housing_type',
    arrivee_lieu: 'arrival_location',
    arrivee_heure: 'arrival_time',
    arrivee_info: 'arrival_info',
  },
  thanks_direct: {},
  test_fr: {},
  housing_confirmation: {
    hebergement: 'housing_residence',
    type_heb: 'housing_type',
    id: 'client_id',
  },
  course_location: {},
  welcome_pack: {},
  payment_reminder: {
    // Amounts
    total: 'total',
    regle: 'paid', // "Réglé"
    solde: 'amount_due', // outstanding balance — the dunning target
    nb_sem: 'weeks_count',
    // Identifiers
    n_proforma: 'proforma',
    id: 'client_id',
    // Payment plan
    paiement: 'payment_plan',
    regle_paiement: 'payment_rule',
  },
};

/**
 * Build a header-rewriting function for a given kind. The returned mapper
 * accepts a raw row and yields a new object whose keys are canonical
 * (snake_case) field names declared in the kind registry.
 *
 * The original keys are preserved alongside the canonical ones so that
 * existing template variables (which sometimes reference original column
 * names) keep resolving.
 */
export function buildRowMapper(
  kind: CampaignKind,
): (row: Record<string, unknown>) => Record<string, unknown> {
  const dict = { ...COMMON_ALIASES, ...ALIASES[kind] };
  return (row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const norm = normalizeHeader(k);
      const canonical = dict[norm] ?? norm;
      // Last write wins; the registry should not declare conflicting aliases.
      out[canonical] = v;
      // Keep both the normalized form and the original key for downstream
      // template rendering and audit reads.
      out[norm] = out[norm] ?? v;
      out[k] = v;
    }
    return out;
  };
}

/**
 * Translate a list of canonical column names into the set of normalized
 * headers we accept for them (used to validate required-column presence
 * against the file's headers).
 *
 * Special case: `full_name` is satisfied by EITHER a combined name column
 * (`nom`, `full_name`, …) OR by separate `first_name` + `last_name`
 * columns. The caller of this map should treat the synthetic entry
 * `full_name` as a logical disjunction; we encode that by also listing
 * the split alternatives.
 */
export function canonicalToHeaders(
  kind: CampaignKind,
  canonicalKeys: readonly string[],
): Record<string, string[]> {
  const dict = { ...COMMON_ALIASES, ...ALIASES[kind] };
  const reverse: Record<string, string[]> = {};
  for (const [src, dst] of Object.entries(dict)) {
    if (!canonicalKeys.includes(dst)) continue;
    (reverse[dst] ??= []).push(src);
  }
  for (const key of canonicalKeys) {
    (reverse[key] ??= []).push(key);
  }
  return reverse;
}

/**
 * Returns the list of header sets that satisfy a required canonical key.
 * Each inner array is a conjunction (all must be present); the outer
 * array is a disjunction (at least one set must match).
 *
 *   requirementSatisfiers(kind, 'full_name')
 *   //  → [['nom'], ['full_name'], ['first_name', 'last_name'], …]
 */
export function requirementSatisfiers(
  kind: CampaignKind,
  canonicalKey: string,
): string[][] {
  const headers = canonicalToHeaders(kind, [canonicalKey])[canonicalKey] ?? [canonicalKey];
  const sets: string[][] = headers.map((h) => [h]);
  if (canonicalKey === 'full_name') sets.push(['first_name', 'last_name']);
  return sets;
}

export { ALIASES, COMMON_ALIASES };
