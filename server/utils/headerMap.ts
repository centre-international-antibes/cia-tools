import type { CampaignKind } from '~/types/campaign.types';

/**
 * Header normalization + alias dictionary.
 *
 * The ERP exports French headers with diacritics, dots and casing
 * (e.g. `Sem. Arr.`, `Hébergement`, `N° Proforma`). The kind registry
 * however speaks canonical snake_case (e.g. `arrival_week`,
 * `housing_residence`, `proforma`). This module is the single bridge.
 *
 *   normalizeHeader('Hébergement')  // → 'hebergement'
 *   normalizeHeader('N° Proforma')  // → 'n_proforma'
 *
 * Then per-kind `ALIASES[kind]` maps any normalized header (or canonical
 * key) to the canonical key used by the registry. Multiple aliases can
 * resolve to the same canonical key.
 *
 * Aliases are matched after normalization, so callers may declare them
 * in their natural French or English form.
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

/** Aliases shared by every kind (identity, contact info, ERP context). */
const COMMON_ALIASES: Record<string, string> = {
  // identity
  email: 'email',
  e_mail: 'email',
  mail: 'email',
  courriel: 'email',
  first_name: 'first_name',
  firstname: 'first_name',
  prenom: 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  nom_de_famille: 'last_name',
  nom: 'full_name', // ERP `Nom` is the surname+given combo (e.g. "CLARK Beau")
  full_name: 'full_name',
  // language
  language: 'language',
  langue: 'language',
  lang: 'language',
  // ERP metadata
  acteur: 'actor',
  actor: 'actor',
  notes: 'notes',
  note: 'notes',
  commentaire: 'notes',
  // payment list
  nomto: 'nom_to', // ERP customer-type tag, e.g. "DIRECT 2"
  nom_to: 'nom_to',
  client_type: 'client_type',
  type_client: 'client_type',
  // adult/junior tag
  type: 'audience_tag', // A | J
  audience: 'audience_tag',
  public: 'audience_tag',
  // dates and weeks
  arrivee: 'arrival_date',
  arrival: 'arrival_date',
  arrival_at: 'arrival_date',
  arrival_date: 'arrival_date',
  depart: 'departure_date',
  departure: 'departure_date',
  departure_date: 'departure_date',
  sem_arr: 'arrival_week',
  arrival_week: 'arrival_week',
  sem_dep: 'departure_week',
  departure_week: 'departure_week',
  // reminders (already-sent counters in the ERP)
  relance_1: 'reminder_1_at',
  relance_2: 'reminder_2_at',
  relance_3: 'reminder_3_at',
  relance_count: 'reminder_count',
};

/** Per-kind alias overrides. Merged on top of `COMMON_ALIASES`. */
const ALIASES: Record<CampaignKind, Record<string, string>> = {
  ats: {
    // ATS-specific
    regle_ats: 'ats_rule',
    ats_rule: 'ats_rule',
    ats: 'ats_done',
    ats_done: 'ats_done',
    fiche_san: 'health_form_done',
    fiche_sanitaire: 'health_form_done',
    health_form_done: 'health_form_done',
    no_health_form: 'no_health_form',
    no_sanitary: 'no_health_form',
    passeport: 'passport_done',
    passport_done: 'passport_done',
    no_passport: 'no_passport',
    missing_passport: 'no_passport',
    no_flight_info: 'no_flight_info',
    no_flight: 'no_flight_info',
    transfert: 'transfer',
    transfer: 'transfer',
    hebergement: 'housing_residence',
    housing_residence: 'housing_residence',
    residence: 'housing_residence',
    type_heb: 'housing_type',
    housing_type: 'housing_type',
    arrivee_lieu: 'arrival_location',
    arrival_location: 'arrival_location',
    arrivee_heure: 'arrival_time',
    arrival_time: 'arrival_time',
    arrival_at: 'arrival_date',
    arrivee_info: 'arrival_info',
    arrival_info: 'arrival_info',
    is_late_arrival: 'is_late_arrival',
    late_arrival: 'is_late_arrival',
    client_id: 'client_id',
    id: 'client_id',
  },
  ats_late_arrival: {
    hebergement: 'housing_residence',
    housing_residence: 'housing_residence',
    residence: 'housing_residence',
    arrivee_lieu: 'arrival_location',
    arrivee_heure: 'arrival_time',
    arrival_time: 'arrival_time',
    arrival_at: 'arrival_date',
    arrivee_info: 'arrival_info',
    arrival_info: 'arrival_info',
    client_id: 'client_id',
    id: 'client_id',
  },
  thanks_direct: {
    had_complaint: 'had_complaint',
    complaint: 'had_complaint',
  },
  test_fr: {
    test_link: 'test_link',
    lien_test: 'test_link',
    test_status: 'test_status',
    statut_test: 'test_status',
  },
  housing_confirmation: {
    hebergement: 'housing_residence',
    housing_residence: 'housing_residence',
    residence: 'housing_residence',
    type_heb: 'housing_type',
    housing_type: 'housing_type',
    package_code: 'package_code',
    package: 'package_code',
    forfait: 'package_code',
    start_date: 'start_date',
    date_debut: 'start_date',
    end_date: 'end_date',
    date_fin: 'end_date',
    client_id: 'client_id',
    id: 'client_id',
  },
  course_location: {
    course_type: 'course_type',
    type_cours: 'course_type',
  },
  welcome_pack: {
    client_type: 'client_type',
    arrival_at: 'arrival_date',
  },
  payment_reminder: {
    // amounts
    total: 'total',
    regle: 'paid', // "Réglé"
    paid: 'paid',
    solde: 'amount_due', // outstanding balance — the dunning target
    amount_due: 'amount_due',
    amount: 'amount_due',
    montant: 'amount_due',
    nb_sem: 'weeks_count',
    weeks_count: 'weeks_count',
    // ids
    n_proforma: 'proforma',
    no_proforma: 'proforma',
    proforma: 'proforma',
    id: 'client_id',
    client_id: 'client_id',
    // payment plan + rule
    paiement: 'payment_plan',
    payment_plan: 'payment_plan',
    regle_paiement: 'payment_rule',
    payment_rule: 'payment_rule',
    // dates
    due_date: 'due_date',
    date_echeance: 'due_date',
    currency: 'currency',
    devise: 'currency',
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
