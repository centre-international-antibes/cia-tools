import type {
  CampaignKind,
  CampaignKindConfig,
  EligibilityFlags,
  ParsedContactRow,
  SuppressionReason,
  TemplateVariable,
} from '~/types/campaign.types';

/**
 * Server-side kind registry.
 *
 * Each entry declares:
 *   - which canonical columns the parser must find (after header aliasing
 *     via `server/utils/headerMap.ts`),
 *   - how raw rows are interpreted into `ParsedContactRow` instances,
 *   - which template variant should be selected for a contact,
 *   - which params object to pass to the template renderer.
 *
 * Important: row values are already keyed by canonical names (see
 * `buildRowMapper`). Callers should not branch on aliases here.
 *
 * Eligibility flags also drive suppression: rows we keep on disk but
 * deselect by default in the wizard (credit notes, "ne pas relancer",
 * already-reminded N times, etc.).
 */

const KNOWN_LANGUAGES = ['fr', 'en'] as const;
type Language = (typeof KNOWN_LANGUAGES)[number];

// ── primitives ──────────────────────────────────────────────────

function pickLanguage(raw: Record<string, unknown>): Language {
  const v = asString(raw.language).toLowerCase();
  if (v.startsWith('en')) return 'en';
  if (v.startsWith('fr')) return 'fr';
  // ERP rarely sets language; fall back to FR (operators are French).
  return 'fr';
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'oui' || s === 'x';
}

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[\s,]/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Parse an amount expressed in either French (`1 234,56 €`) or anglo
 * (`1,234.56`) format. Returns cents or `null`.
 *
 *   "1,050.00"  → 105000
 *   "1 234,56"  → 123456
 *   "153.00"    → 15300
 *   "1.234,56"  → 123456 (German/Dutch convention)
 *   "abc"       → null
 */
function asAmountCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  let s = String(value).trim();
  if (!s) return null;
  // Strip currency symbols, NBSPs, plain spaces.
  s = s.replace(/[€$£\s\u00A0]/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator (Excel exports vary).
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Heuristic: "1,050" with 3 digits after the comma is a thousands sep
    // when followed by no decimals; otherwise treat as decimal.
    const tail = s.split(',').pop() ?? '';
    if (tail.length === 3 && !/\.\d/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const PRIVATE_FLATS = ['mona1', 'mona2', 'mona3', 'juliette'];

function isPrivateFlat(residence: string): boolean {
  const r = residence.toLowerCase().trim();
  return PRIVATE_FLATS.some((flat) => r.includes(flat));
}

/**
 * ERP `Nom` column stores "SURNAME Given" (surname is uppercased).
 * Split heuristically: contiguous uppercase tokens form the surname,
 * the rest is the given name. Falls back to a single field if ambiguous.
 */
function splitErpName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: '', last_name: '' };
  const surnameTokens: string[] = [];
  const givenTokens: string[] = [];
  for (const p of parts) {
    if (!givenTokens.length && /^[A-ZÀ-Ý'’\-]{2,}$/.test(p)) surnameTokens.push(p);
    else givenTokens.push(p);
  }
  if (!surnameTokens.length || !givenTokens.length) {
    // Couldn't classify — treat first token as last name (ERP default).
    return { last_name: parts[0], first_name: parts.slice(1).join(' ') };
  }
  return {
    last_name: surnameTokens.join(' '),
    first_name: givenTokens.join(' '),
  };
}

/** Build the base `ParsedContactRow` for every kind. */
function baseRow(raw: Record<string, unknown>): ParsedContactRow {
  const email = asString(raw.email).toLowerCase();
  let first = asString(raw.first_name);
  let last = asString(raw.last_name);
  if (!first && !last && raw.full_name) {
    const split = splitErpName(asString(raw.full_name));
    first = split.first_name;
    last = split.last_name;
  }
  return {
    email,
    first_name: first,
    last_name: last,
    language: pickLanguage(raw),
    group_key: null,
    raw,
    eligibility: {},
  };
}

// ── shared suppression detectors ────────────────────────────────

const DO_NOT_CONTACT_PATTERNS = [
  /ne\s+pas\s+(relancer|contacter|envoyer)/i,
  /do\s+not\s+(contact|email|remind)/i,
  /\bdnc\b/i,
  /unsubscribed?/i,
  /desinscri(t|te|ption)/i,
];

const CREDIT_NOTE_PATTERNS = [/avoir\s*n[°o]?/i, /credit\s*note/i];
const MANUAL_PAYMENT_PATTERNS = [/virement/i, /transfert/i, /wire/i, /bank\s*transfer/i];

interface Suppression {
  reasons: SuppressionReason[];
  /** Verbatim slice of the source notes that triggered the flag. */
  notes: string;
}

function detectSuppressionFromNotes(notes: string): Suppression {
  const reasons: SuppressionReason[] = [];
  if (!notes) return { reasons, notes: '' };
  if (DO_NOT_CONTACT_PATTERNS.some((p) => p.test(notes))) reasons.push('do_not_contact');
  if (CREDIT_NOTE_PATTERNS.some((p) => p.test(notes))) reasons.push('credit_note');
  if (MANUAL_PAYMENT_PATTERNS.some((p) => p.test(notes))) reasons.push('manual_payment');
  return { reasons, notes: reasons.length ? notes : '' };
}

function reminderCount(raw: Record<string, unknown>): number {
  return (
    (asString(raw.reminder_1_at) ? 1 : 0)
    + (asString(raw.reminder_2_at) ? 1 : 0)
    + (asString(raw.reminder_3_at) ? 1 : 0)
  );
}

/**
 * Cycle stage = the next reminder we owe the customer, derived from which
 * `Relance N` columns the ERP already filled in.
 *   - no reminder column set     → stage 1 (first send)
 *   - `Relance 1` set            → stage 2 (urgent send)
 *   - `Relance 2` (or both) set  → stage 3 (final notice)
 *   - all three set              → stage 3 (saturated; sender suppresses)
 */
function latestReminderStage(raw: Record<string, unknown>): 1 | 2 | 3 {
  if (asString(raw.reminder_3_at)) return 3;
  if (asString(raw.reminder_2_at)) return 3;
  if (asString(raw.reminder_1_at)) return 2;
  return 1;
}

/** Map (language, has_housing) → official pre-arrival PDF URL. */
const PRE_ARRIVAL_URLS = {
  fr: {
    withHousing: 'https://www.cia-france.com/media-file/900/documents-avant-arrivee-francais.pdf',
    withoutHousing: 'https://www.cia-france.com/media-file/1748/documents-avant-arrivee-sans-hebergement.pdf',
  },
  en: {
    withHousing: 'https://www.cia-france.com/media-file/901/pre-arrival-documents-english.pdf',
    withoutHousing: 'https://www.cia-france.com/media-file/1749/pre-arrival-documents-without-accommodation.pdf',
  },
} as const;

function preArrivalUrl(language: 'fr' | 'en', hasHousing: boolean): string {
  const set = PRE_ARRIVAL_URLS[language] ?? PRE_ARRIVAL_URLS.fr;
  return hasHousing ? set.withHousing : set.withoutHousing;
}

/**
 * Build the per-recipient ATS checklist, listing only items still missing.
 * Health form + passport apply to juniors only; flight info applies whenever
 * arrival is not yet known.
 */
function missingAtsDocuments(
  e: EligibilityFlags,
  audience: 'junior' | 'adult',
  language: 'fr' | 'en',
): Array<{ code: string; label: string; url: string }> {
  const labels = language === 'fr'
    ? {
      ats: 'Fiche ATS (autorisation de sortie)',
      health: 'Fiche sanitaire',
      passport: 'Copie du passeport',
    }
    : {
      ats: 'ATS form (sortie authorisation)',
      health: 'Health form',
      passport: 'Copy of passport',
    };
  const out: Array<{ code: string; label: string; url: string }> = [];
  if (audience !== 'junior') return out;
  if (e.no_ats_form) out.push({ code: 'ats_form', label: labels.ats, url: '' });
  if (e.no_health_form) out.push({ code: 'health_form', label: labels.health, url: '' });
  if (e.no_passport) out.push({ code: 'passport', label: labels.passport, url: '' });
  return out;
}

/**
 * The ERP `Type` column carries A (Adult) / J (Junior). Falling back
 * to `audience`/`public` keeps the parser usable for hand-built CSVs.
 */
function readAudience(raw: Record<string, unknown>): 'junior' | 'adult' | null {
  const v = asString(raw.audience_tag).toUpperCase();
  if (!v) return null;
  if (v.startsWith('J')) return 'junior';
  if (v.startsWith('A')) return 'adult';
  return null;
}

/** Read ERP's "DIRECT 2" / "DIRECT" / "Groupe …" customer tag → canonical client_type. */
function readClientType(raw: Record<string, unknown>): string {
  const explicit = asString(raw.client_type).toUpperCase();
  if (explicit) return explicit;
  const nomTo = asString(raw.nom_to).toUpperCase();
  if (nomTo.startsWith('DIRECT')) return 'DIRECT';
  if (nomTo.startsWith('GROUP') || nomTo.startsWith('GROUPE')) return 'GROUP';
  return nomTo;
}

// ── kind config interface ───────────────────────────────────────

interface ServerKindConfig extends CampaignKindConfig {
  /**
   * Compute eligibility flags + group key from a (canonicalized) raw row.
   * Returning `null` discards the row. Suppression should NOT return null —
   * mark `eligibility.suppressed = true` instead so the operator sees it.
   */
  parseRow(raw: Record<string, unknown>, index: number): ParsedContactRow | null;
  /** Pick a template variant given a contact. */
  resolveVariant(contact: ParsedContactRow): string;
  /** Build the params bag passed to the template renderer. */
  buildParams(contact: ParsedContactRow): Record<string, unknown>;
  /** Optional grouping step that merges rows with the same group_key. */
  groupRows?(rows: ParsedContactRow[]): ParsedContactRow[];
}

const COMMON_VARS: TemplateVariable[] = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
];

// ── registry ────────────────────────────────────────────────────

const REGISTRY: Record<CampaignKind, ServerKindConfig> = {
  // ── 1. Relance ATS ───────────────────────────────────────
  ats: {
    kind: 'ats',
    labelKey: 'campaigns.kinds.ats.label',
    descriptionKey: 'campaigns.kinds.ats.description',
    icon: 'lucide:plane',
    scope: 'campaign:ats',
    requiredColumns: ['email', 'full_name'],
    optionalColumns: [
      'language',
      'ats_done',
      'health_form_done',
      'passport_done',
      'housing_residence',
      'housing_type',
      'arrival_date',
      'arrival_time',
      'arrival_location',
      'transfer',
      'audience_tag',
      'notes',
      'reminder_1_at',
      'reminder_2_at',
      'reminder_3_at',
    ],
    variants: ['junior', 'adult'],
    defaultVariant: 'junior',
    templateVariables: [
      ...COMMON_VARS,
      { key: 'audience', type: 'string', required: false, sample: 'junior' },
      { key: 'no_ats_form', type: 'boolean', required: false, sample: false },
      { key: 'no_health_form', type: 'boolean', required: false, sample: false },
      { key: 'no_passport', type: 'boolean', required: false, sample: false },
      { key: 'has_housing', type: 'boolean', required: false, sample: true },
      { key: 'housing_residence', type: 'string', required: false, sample: 'Garrett' },
      { key: 'housing_type', type: 'string', required: false, sample: 'F' },
      { key: 'is_family', type: 'boolean', required: false, sample: false },
      { key: 'is_residence', type: 'boolean', required: false, sample: true },
      { key: 'is_aragon', type: 'boolean', required: false, sample: false },
      { key: 'needs_transfer', type: 'boolean', required: false, sample: false },
      { key: 'arrival_at', type: 'string', required: false, sample: '' },
      { key: 'arrival_location', type: 'string', required: false, sample: 'Nice Airport' },
      { key: 'is_late_arrival', type: 'boolean', required: false, sample: false },
      { key: 'pre_arrival_url', type: 'url', required: false, sample: 'https://www.cia-france.com/media-file/900/documents-avant-arrivee-francais.pdf' },
      {
        key: 'missing_documents',
        type: 'array',
        required: false,
        sample: [{ code: 'flight_info', label: 'Flight info', url: '' }],
      },
    ],
    parseRow(raw, index) {
      const row = baseRow(raw);
      if (!row.email) return null;

      const audience = readAudience(raw);
      const residence = asString(raw.housing_residence);
      const housingType = asString(raw.housing_type);
      // Per spec: an empty `Ats` / `Fiche San.` / `Passeport` cell means the
      // document is missing; any non-empty value (OK, a date, etc.) means it's
      // already on file. We ignore `Règle Ats` entirely — it's an internal
      // rule about going-out rights, not an email trigger.
      const noAtsForm = !asString(raw.ats_done);
      const noHealthForm = !asString(raw.health_form_done);
      const noPassport = !asString(raw.passport_done);
      const arrivalTime = asString(raw.arrival_time);
      const isLate = /late|tard/i.test(arrivalTime);
      const housingTypeUpper = housingType.toUpperCase();

      const e: EligibilityFlags = {
        no_ats_form: noAtsForm,
        no_health_form: noHealthForm,
        no_passport: audience === 'junior' && noPassport,
        housing_residence: residence,
        housing_type: housingType,
        has_housing: residence !== '' || housingTypeUpper === 'F' || housingTypeUpper === 'R',
        is_private_flat: residence ? isPrivateFlat(residence) : false,
        is_family: housingTypeUpper === 'F',
        is_residence: housingTypeUpper === 'R',
        is_aragon: /aragon/i.test(residence),
        needs_transfer: asBool(raw.transfer),
        is_late_arrival: isLate,
        arrival_date: asString(raw.arrival_date),
        arrival_time: arrivalTime,
        arrival_location: asString(raw.arrival_location),
        audience: audience ?? undefined,
        audience_tag: asString(raw.audience_tag),
        reminder_count: reminderCount(raw),
      };

      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      if (suppression.reasons.length) {
        e.suppressed = true;
        e.suppression_reasons = suppression.reasons;
        e.suppression_notes = suppression.notes || asString(raw.notes);
      }

      row.eligibility = e;
      // ATS exports have no client_id column — give each row its own group key
      // so siblings sharing a parent's email survive as distinct contacts.
      row.group_key = `ats-${index}`;
      return row;
    },
    resolveVariant(c) {
      return c.eligibility.audience === 'adult' ? 'adult' : 'junior';
    },
    buildParams(c) {
      const audience = c.eligibility.audience ?? 'junior';
      const hasHousing = !!c.eligibility.has_housing;
      return {
        first_name: c.first_name,
        last_name: c.last_name,
        audience,
        no_ats_form: !!c.eligibility.no_ats_form,
        no_health_form: !!c.eligibility.no_health_form,
        no_passport: !!c.eligibility.no_passport,
        has_housing: hasHousing,
        housing_residence: c.eligibility.housing_residence ?? '',
        housing_type: c.eligibility.housing_type ?? '',
        is_family: !!c.eligibility.is_family,
        is_residence: !!c.eligibility.is_residence,
        is_aragon: !!c.eligibility.is_aragon,
        needs_transfer: !!c.eligibility.needs_transfer,
        arrival_at: c.eligibility.arrival_date ?? '',
        arrival_time: c.eligibility.arrival_time ?? '',
        arrival_location: c.eligibility.arrival_location ?? '',
        is_late_arrival: !!c.eligibility.is_late_arrival,
        pre_arrival_url: preArrivalUrl(c.language, hasHousing),
        missing_documents: missingAtsDocuments(c.eligibility, audience, c.language),
      };
    },
  },

  // ── 1b. Relance ATS — instructions arrivée tardive ──────
  ats_late_arrival: {
    kind: 'ats_late_arrival',
    labelKey: 'campaigns.kinds.ats_late_arrival.label',
    descriptionKey: 'campaigns.kinds.ats_late_arrival.description',
    icon: 'lucide:clock-alert',
    scope: 'campaign:ats_late_arrival',
    requiredColumns: ['email', 'full_name'],
    optionalColumns: ['language', 'housing_residence', 'arrival_date', 'arrival_time', 'arrival_location', 'notes'],
    variants: ['default'],
    defaultVariant: 'default',
    templateVariables: [
      ...COMMON_VARS,
      { key: 'housing_residence', type: 'string', required: false, sample: 'Aragon' },
      { key: 'arrival_at', type: 'string', required: false, sample: '23:30' },
    ],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      row.eligibility = {
        housing_residence: asString(raw.housing_residence),
        arrival_date: asString(raw.arrival_date),
        arrival_time: asString(raw.arrival_time),
        arrival_location: asString(raw.arrival_location),
        is_late_arrival: true,
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes,
        }),
      };
      return row;
    },
    resolveVariant: () => 'default',
    buildParams: (c) => ({
      first_name: c.first_name,
      housing_residence: c.eligibility.housing_residence ?? '',
      arrival_at: c.eligibility.arrival_time ?? c.eligibility.arrival_date ?? '',
      arrival_location: c.eligibility.arrival_location ?? '',
    }),
  },

  // ── 2. Remerciement DIRECT ──────────────────────────────
  thanks_direct: {
    kind: 'thanks_direct',
    labelKey: 'campaigns.kinds.thanks_direct.label',
    descriptionKey: 'campaigns.kinds.thanks_direct.description',
    icon: 'lucide:heart',
    scope: 'campaign:thanks_direct',
    requiredColumns: ['email', 'full_name'],
    optionalColumns: ['language', 'audience_tag', 'had_complaint', 'notes'],
    variants: ['junior', 'adult'],
    defaultVariant: 'adult',
    templateVariables: [
      ...COMMON_VARS,
      { key: 'audience', type: 'string', required: true, sample: 'adult' },
    ],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;
      const audience = readAudience(raw) ?? 'adult';
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      row.eligibility = {
        had_complaint: asBool(raw.had_complaint),
        audience,
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes,
        }),
      };
      return row;
    },
    resolveVariant: (c) => c.eligibility.audience ?? 'adult',
    buildParams: (c) => ({
      first_name: c.first_name,
      audience: c.eligibility.audience ?? 'adult',
    }),
  },

  // ── 3. Relance tests FR ─────────────────────────────────
  test_fr: {
    kind: 'test_fr',
    labelKey: 'campaigns.kinds.test_fr.label',
    descriptionKey: 'campaigns.kinds.test_fr.description',
    icon: 'lucide:graduation-cap',
    scope: 'campaign:test_fr',
    requiredColumns: ['email', 'full_name', 'test_link'],
    optionalColumns: ['language', 'test_status', 'notes'],
    variants: ['default'],
    defaultVariant: 'default',
    templateVariables: [
      ...COMMON_VARS,
      { key: 'test_link', type: 'url', required: true, sample: 'https://test.example' },
    ],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;
      const status = asString(raw.test_status, 'pending').toLowerCase();
      const normalizedStatus: EligibilityFlags['test_status'] =
        status === 'done' || status === 'fait' || status === 'completed'
          ? 'done'
          : status === 'excluded' || status === 'exclu' || status === 'na' || status === 'n/a'
            ? 'excluded'
            : 'pending';
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      if (normalizedStatus !== 'pending') suppression.reasons.push('do_not_contact');
      row.eligibility = {
        test_status: normalizedStatus,
        test_link: asString(raw.test_link),
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes,
        }),
      };
      return row;
    },
    resolveVariant: () => 'default',
    buildParams: (c) => ({
      first_name: c.first_name,
      test_link: c.eligibility.test_link ?? '',
    }),
  },

  // ── 4. Confirmation d'hébergement ───────────────────────
  housing_confirmation: {
    kind: 'housing_confirmation',
    labelKey: 'campaigns.kinds.housing_confirmation.label',
    descriptionKey: 'campaigns.kinds.housing_confirmation.description',
    icon: 'lucide:bed',
    scope: 'campaign:housing_confirmation',
    requiredColumns: ['email', 'full_name', 'housing_residence', 'client_id'],
    optionalColumns: ['language', 'package_code', 'start_date', 'end_date', 'notes'],
    variants: ['default'],
    defaultVariant: 'default',
    templateVariables: [
      ...COMMON_VARS,
      { key: 'housing_residence', type: 'string', required: true, sample: 'Garrett' },
      {
        key: 'sections',
        type: 'array',
        required: false,
        sample: [{ package_code: 'ESSENTIAL', start_date: '', end_date: '' }],
      },
    ],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;
      const residence = asString(raw.housing_residence);
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      row.eligibility = {
        housing_residence: residence,
        is_private_flat: residence ? isPrivateFlat(residence) : false,
        package_codes: [asString(raw.package_code)].filter(Boolean),
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes,
        }),
      };
      row.group_key = asString(raw.client_id) || null;
      return row;
    },
    resolveVariant: () => 'default',
    buildParams(c) {
      const sections = Array.isArray(c.raw.sections)
        ? c.raw.sections
        : (c.eligibility.package_codes ?? []).map((code) => ({
            package_code: code,
            start_date: asString(c.raw.start_date),
            end_date: asString(c.raw.end_date),
          }));
      return {
        first_name: c.first_name,
        housing_residence: c.eligibility.housing_residence ?? '',
        sections,
      };
    },
    /** Merge rows with the same client_id into a single contact with N sections. */
    groupRows(rows) {
      const byKey = new Map<string, ParsedContactRow>();
      const ungrouped: ParsedContactRow[] = [];
      for (const r of rows) {
        if (!r.group_key) {
          ungrouped.push(r);
          continue;
        }
        const existing = byKey.get(r.group_key);
        if (!existing) {
          byKey.set(r.group_key, {
            ...r,
            eligibility: { ...r.eligibility },
            raw: {
              ...r.raw,
              sections: [
                {
                  package_code: asString(r.raw.package_code),
                  start_date: asString(r.raw.start_date),
                  end_date: asString(r.raw.end_date),
                },
              ],
            },
          });
          continue;
        }
        const sections = (existing.raw.sections as unknown[]) ?? [];
        sections.push({
          package_code: asString(r.raw.package_code),
          start_date: asString(r.raw.start_date),
          end_date: asString(r.raw.end_date),
        });
        existing.raw.sections = sections;
        const existingCodes = existing.eligibility.package_codes ?? [];
        const newCodes = r.eligibility.package_codes ?? [];
        existing.eligibility.package_codes = Array.from(
          new Set([...existingCodes, ...newCodes]),
        );
      }
      return [...byKey.values(), ...ungrouped];
    },
  },

  // ── 5. Confirmation lieu de cours adultes ───────────────
  course_location: {
    kind: 'course_location',
    labelKey: 'campaigns.kinds.course_location.label',
    descriptionKey: 'campaigns.kinds.course_location.description',
    icon: 'lucide:book-open',
    scope: 'campaign:course_location',
    requiredColumns: ['email', 'full_name', 'course_type'],
    optionalColumns: ['language', 'notes'],
    variants: ['default'],
    defaultVariant: 'default',
    templateVariables: [
      ...COMMON_VARS,
      { key: 'course_type', type: 'string', required: true, sample: 'group' },
      { key: 'start_time', type: 'string', required: true, sample: '08:30' },
    ],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;
      const t = asString(raw.course_type).toLowerCase();
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      row.eligibility = {
        course_type: t === 'private' || t === 'particulier' ? 'private' : 'group',
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes,
        }),
      };
      return row;
    },
    resolveVariant: () => 'default',
    buildParams: (c) => ({
      first_name: c.first_name,
      course_type: c.eligibility.course_type ?? 'group',
      start_time: c.eligibility.course_type === 'private' ? '12:30' : '08:30',
    }),
  },

  // ── 6. Mail Bienvenue — Welcome pack ────────────────────
  welcome_pack: {
    kind: 'welcome_pack',
    labelKey: 'campaigns.kinds.welcome_pack.label',
    descriptionKey: 'campaigns.kinds.welcome_pack.description',
    icon: 'lucide:gift',
    scope: 'campaign:welcome_pack',
    requiredColumns: ['email', 'full_name'],
    optionalColumns: ['language', 'arrival_date', 'client_type', 'nom_to', 'notes'],
    variants: ['default'],
    defaultVariant: 'default',
    templateVariables: [...COMMON_VARS],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;
      const clientType = readClientType(raw);
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      const isDirect = clientType.startsWith('DIRECT');
      if (!isDirect) suppression.reasons.push('wrong_client_type');
      row.eligibility = {
        client_type: clientType,
        arrival_date: asString(raw.arrival_date),
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes,
        }),
      };
      return row;
    },
    resolveVariant: () => 'default',
    buildParams: (c) => ({
      first_name: c.first_name,
      last_name: c.last_name,
    }),
  },

  // ── 7. Relance Solde ───────────────────────────────────
  payment_reminder: {
    kind: 'payment_reminder',
    labelKey: 'campaigns.kinds.payment_reminder.label',
    descriptionKey: 'campaigns.kinds.payment_reminder.description',
    icon: 'lucide:credit-card',
    scope: 'campaign:payment_reminder',
    requiredColumns: ['email', 'full_name', 'client_id', 'amount_due'],
    optionalColumns: [
      'language',
      'due_date',
      'currency',
      'total',
      'paid',
      'weeks_count',
      'proforma',
      'payment_plan',
      'payment_rule',
      'nom_to',
      'audience_tag',
      'reminder_1_at',
      'reminder_2_at',
      'reminder_3_at',
      'notes',
    ],
    variants: ['first', 'second', 'third'],
    defaultVariant: 'first',
    requiresPaymentLink: true,
    templateVariables: [
      ...COMMON_VARS,
      { key: 'amount', type: 'string', required: true, sample: '450,00 €' },
      { key: 'payment_url', type: 'url', required: true, sample: 'https://pay.example' },
      { key: 'due_date', type: 'string', required: false, sample: '2026-07-01' },
      { key: 'relance_count', type: 'number', required: false, sample: 1 },
      { key: 'proforma', type: 'string', required: false, sample: 'P26404-B1E09' },
      { key: 'total', type: 'string', required: false, sample: '1 500,00 €' },
      { key: 'paid', type: 'string', required: false, sample: '450,00 €' },
      { key: 'cycle_stage', type: 'number', required: false, sample: 1 },
    ],
    parseRow(raw) {
      const row = baseRow(raw);
      if (!row.email) return null;

      const cents = asAmountCents(raw.amount_due);
      const totalCents = asAmountCents(raw.total);
      const paidCents = asAmountCents(raw.paid);
      const suppression = detectSuppressionFromNotes(asString(raw.notes));
      const rCount = reminderCount(raw);
      const cycleStage = latestReminderStage(raw);
      const clientType = readClientType(raw);
      const audience = readAudience(raw);

      // Rows without a positive balance are kept for audit but suppressed.
      // Negative balances are explicit credits / refunds — never send.
      if (cents === null) suppression.reasons.push('invalid_amount');
      else if (cents < 0) suppression.reasons.push('do_not_contact');
      else if (cents === 0) suppression.reasons.push('missing_data');
      // GROUP customers get invoiced separately — only DIRECT goes through
      // Payzen reminders.
      if (clientType && !clientType.startsWith('DIRECT')) {
        suppression.reasons.push('wrong_client_type');
      }
      if (rCount >= 3) suppression.reasons.push('already_reminded_max');

      row.eligibility = {
        amount_cents: cents ?? 0,
        total_cents: totalCents ?? undefined,
        paid_cents: paidCents ?? undefined,
        due_date: asString(raw.due_date),
        client_type: clientType,
        audience: audience ?? undefined,
        proforma: asString(raw.proforma),
        weeks_count: asInt(raw.weeks_count) ?? undefined,
        payment_plan: asString(raw.payment_plan),
        reminder_count: rCount,
        cycle_stage: cycleStage,
        ...(suppression.reasons.length && {
          suppressed: true,
          suppression_reasons: suppression.reasons,
          suppression_notes: suppression.notes || asString(raw.notes),
        }),
      };
      row.group_key = asString(raw.client_id) || null;
      return row;
    },
    resolveVariant(c) {
      const stage = (c.eligibility.cycle_stage as number | undefined) ?? 1;
      if (stage >= 3) return 'third';
      if (stage === 2) return 'second';
      return 'first';
    },
    buildParams(c) {
      const cents = c.eligibility.amount_cents ?? 0;
      const currency = asString(c.raw.currency, 'EUR') || 'EUR';
      const locale = c.language === 'en' ? 'en-GB' : 'fr-FR';
      const fmt = (amountCents: number) =>
        new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountCents / 100);
      const stage = (c.eligibility.cycle_stage as number | undefined) ?? 1;
      return {
        first_name: c.first_name,
        last_name: c.last_name,
        amount: fmt(cents),
        amount_cents: cents,
        currency,
        total: c.eligibility.total_cents != null ? fmt(c.eligibility.total_cents) : '',
        paid: c.eligibility.paid_cents != null ? fmt(c.eligibility.paid_cents) : '',
        due_date: c.eligibility.due_date ?? '',
        payment_url: (c.eligibility.payment_url as string) ?? '',
        cycle_stage: stage,
        relance_count: stage,
        proforma: c.eligibility.proforma ?? '',
      };
    },
  },
};

export function getKindConfig(kind: CampaignKind): ServerKindConfig {
  const cfg = REGISTRY[kind];
  if (!cfg) throw new Error(`Unknown campaign kind: ${kind}`);
  return cfg;
}

export function listKindConfigs(): ServerKindConfig[] {
  return Object.values(REGISTRY);
}

export type { ServerKindConfig };
