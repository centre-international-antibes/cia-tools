import { createRequire } from 'node:module';
import * as XLSX from 'xlsx';
import { getKindConfig } from './campaignKinds';
import { buildRowMapper, normalizeHeader, requirementSatisfiers } from './headerMap';
import type {
  CampaignKind,
  ParseResult,
  ParsedContactRow,
  ParserWarning,
} from '~/types/campaign.types';

/** Hard limit on number of rows processed per file. Anything beyond is dropped with a warning. */
const MAX_ROWS = 5000;

/**
 * Parse an uploaded XLSX or CSV buffer for a given campaign kind.
 *
 *   1. Reads the first sheet.
 *   2. Validates required columns against the kind registry, accepting
 *      both canonical names and ERP aliases (via `headerMap`).
 *   3. Skips empty rows and trailing totals/counter rows.
 *   4. Delegates row interpretation to the kind registry.
 *   5. Dedupes by email (within a single list).
 *   6. Groups rows if the kind defines a grouping step (e.g. housing).
 *   7. Surfaces row-level warnings without aborting the whole import.
 *
 * Warnings carry a `severity` (info | warning | error) so the UI can
 * highlight blocking issues differently from advisory ones.
 */
export function parseContactsSheet(
  buffer: Buffer,
  kind: CampaignKind,
): ParseResult {
  const cfg = getKindConfig(kind);
  const warnings: ParserWarning[] = [];
  const emptySummary = { total: 0, accepted: 0, suppressed: 0, skipped: 0, duplicates: 0, invalidEmails: 0 };
  // NOTE: duplicates is kept on the ParseSummary shape for backwards
  // compatibility but is no longer incremented — see the dedup section below.

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (err) {
    return {
      rows: [],
      warnings: [
        {
          code: 'PARSE_FAILED',
          severity: 'error',
          message: `Unable to read spreadsheet: ${(err as Error).message}`,
        },
      ],
      summary: emptySummary,
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      warnings: [{ code: 'EMPTY_FILE', severity: 'error', message: 'No sheet found.' }],
      summary: emptySummary,
    };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      rows: [],
      warnings: [{ code: 'EMPTY_FILE', severity: 'error', message: 'Sheet vanished.' }],
      summary: emptySummary,
    };
  }
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (!raw.length) {
    return {
      rows: [],
      warnings: [{ code: 'EMPTY_SHEET', severity: 'error', message: 'Sheet has no data rows.' }],
      summary: emptySummary,
    };
  }

  // ── Header validation ─────────────────────────────────────
  const headerSet = new Set(Object.keys(raw[0] ?? {}).map(normalizeHeader));
  const missing: string[] = [];
  for (const required of cfg.requiredColumns) {
    const sets = requirementSatisfiers(kind, required);
    const satisfied = sets.some((set) => set.every((h) => headerSet.has(h)));
    if (!satisfied) missing.push(required);
  }
  if (missing.length) {
    warnings.push({
      code: 'MISSING_COLUMNS',
      severity: 'error',
      message: `Missing required columns: ${missing.join(', ')}`,
    });
  }

  // ── Row processing ────────────────────────────────────────
  const mapRow = buildRowMapper(kind);
  // Email duplicates are intentionally NOT filtered: two siblings sharing a
  // parent's inbox is a normal case for ATS / payment-reminder lists. The
  // DB enforces uniqueness on (list_id, email, COALESCE(group_key, '')) so
  // true row-level reuploads still collapse at insert time, while distinct
  // children pass through.
  const rows: ParsedContactRow[] = [];
  const summary = { ...emptySummary };

  const work = raw.length > MAX_ROWS ? raw.slice(0, MAX_ROWS) : raw;
  if (raw.length > MAX_ROWS) {
    warnings.push({
      code: 'TRUNCATED',
      severity: 'warning',
      message: `File has ${raw.length} rows; only the first ${MAX_ROWS} were processed.`,
    });
  }

  work.forEach((rawRow, idx) => {
    const mapped = mapRow(rawRow);
    const lineNo = idx + 2; // header is row 1

    if (isBlankRow(mapped)) return; // silent
    if (isTotalsRow(mapped)) return; // silent — ERP footers

    summary.total++;

    let parsed: ParsedContactRow | null = null;
    try {
      parsed = cfg.parseRow(mapped, idx);
    } catch (err) {
      summary.skipped++;
      warnings.push({
        row: lineNo,
        code: 'ROW_PARSE_ERROR',
        severity: 'warning',
        message: (err as Error).message,
      });
      return;
    }

    if (!parsed) {
      summary.skipped++;
      warnings.push({
        row: lineNo,
        code: 'ROW_SKIPPED',
        severity: 'info',
        message: 'Row did not match this campaign kind.',
      });
      return;
    }

    if (!parsed.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) {
      summary.invalidEmails++;
      warnings.push({
        row: lineNo,
        code: 'INVALID_EMAIL',
        severity: 'warning',
        email: parsed.email,
        message: parsed.email ? 'Email is malformed.' : 'Email is missing.',
      });
      return;
    }

    if (parsed.eligibility.suppressed) {
      summary.suppressed++;
      const reasons = parsed.eligibility.suppression_reasons?.join(', ') ?? 'suppressed';
      warnings.push({
        row: lineNo,
        code: 'SUPPRESSED',
        severity: 'info',
        email: parsed.email,
        message: `Row kept but excluded by default (${reasons}).`,
      });
    } else {
      summary.accepted++;
    }

    rows.push(parsed);
  });

  const grouped = cfg.groupRows ? cfg.groupRows(rows) : rows;

  return { rows: grouped, warnings, summary };
}

/** A row is blank when every value is empty after trimming. */
function isBlankRow(row: Record<string, unknown>): boolean {
  for (const v of Object.values(row)) {
    if (v !== null && v !== undefined && String(v).trim() !== '') return false;
  }
  return true;
}

/**
 * Detect ERP totals / footer rows (e.g. last row with `Nom: "Compteur"`).
 * Heuristic: the row carries an aggregate label *and* lacks both email
 * and given/surname structure.
 */
const TOTALS_LABELS = /^(compteur|total|totaux|sous[- ]total|subtotal|grand[- ]?total)$/i;
function isTotalsRow(row: Record<string, unknown>): boolean {
  const email = String(row.email ?? '').trim();
  if (email) return false;
  const candidates = [row.full_name, row.first_name, row.last_name, row.nom];
  return candidates.some((v) => TOTALS_LABELS.test(String(v ?? '').trim()));
}
