import { describe, it, expect } from 'vitest';
import { getKindConfig } from '~/server/utils/campaignKinds';
import { buildRowMapper } from '~/server/utils/headerMap';
import { parseContactsSheet } from '~/server/utils/parseContactsSheet';
import * as XLSX from 'xlsx';

function buildXlsx(headers: string[], rows: Array<Record<string, unknown>>): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('payment_reminder — negative balance', () => {
  it('suppresses with do_not_contact when amount is negative', () => {
    const cfg = getKindConfig('payment_reminder');
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com',
      Nom: 'NEG One',
      Id: '99',
      Solde: '-100,00',
      NomTo: 'DIRECT 2',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.suppressed).toBe(true);
    expect(parsed.eligibility.suppression_reasons).toContain('do_not_contact');
  });
});

describe('payment_reminder — cycle_stage drives variant', () => {
  const cfg = getKindConfig('payment_reminder');

  it('no reminder column → stage 1 → variant first', () => {
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com', Nom: 'A', Id: '1', Solde: '100,00', NomTo: 'DIRECT 2',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.cycle_stage).toBe(1);
    expect(cfg.resolveVariant(parsed)).toBe('first');
    expect(cfg.buildParams(parsed).relance_count).toBe(1);
  });

  it('Relance 1 filled → stage 2 → variant second', () => {
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com', Nom: 'A', Id: '1', Solde: '100,00', 'Relance 1': '5/18/26', NomTo: 'DIRECT 2',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.cycle_stage).toBe(2);
    expect(cfg.resolveVariant(parsed)).toBe('second');
    expect(cfg.buildParams(parsed).relance_count).toBe(2);
  });

  it('Relance 2 filled → stage 3 → variant third', () => {
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com', Nom: 'A', Id: '1', Solde: '100,00',
      'Relance 1': '5/18/26', 'Relance 2': '5/21/26', NomTo: 'DIRECT 2',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.cycle_stage).toBe(3);
    expect(cfg.resolveVariant(parsed)).toBe('third');
  });
});

describe('parseContactsSheet — duplicate emails kept unconditionally', () => {
  it('keeps two rows sharing the same parent email (siblings)', () => {
    const buf = buildXlsx(
      ['Email', 'Nom', 'Id', 'Solde', 'NomTo', 'Type'],
      [
        { Email: 'parent@x.com', Nom: 'KID One', Id: '111', Solde: '500,00', NomTo: 'DIRECT 2', Type: 'J' },
        { Email: 'parent@x.com', Nom: 'KID Two', Id: '222', Solde: '500,00', NomTo: 'DIRECT 2', Type: 'J' },
      ],
    );
    const result = parseContactsSheet(buf, 'payment_reminder');
    expect(result.rows).toHaveLength(2);
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_EMAIL')).toBe(false);
    expect(result.rows.map((r) => r.group_key)).toEqual(['111', '222']);
  });

  it('accepts a file without the optional Id (client_id) column', () => {
    const buf = buildXlsx(
      ['Email', 'Nom', 'Solde', 'NomTo'],
      [{ Email: 'p@x.com', Nom: 'NO ID', Solde: '441,00', NomTo: 'DIRECT 2' }],
    );
    const result = parseContactsSheet(buf, 'payment_reminder');
    expect(result.warnings.some((w) => w.code === 'MISSING_COLUMNS')).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].group_key).toBeNull();
  });

  it('keeps even truly duplicate rows (no parser-side dedup)', () => {
    const buf = buildXlsx(
      ['Email', 'Nom', 'Id', 'Solde', 'NomTo'],
      [
        { Email: 'parent@x.com', Nom: 'KID One', Id: '111', Solde: '500,00', NomTo: 'DIRECT 2' },
        { Email: 'parent@x.com', Nom: 'KID One', Id: '111', Solde: '500,00', NomTo: 'DIRECT 2' },
      ],
    );
    const result = parseContactsSheet(buf, 'payment_reminder');
    expect(result.rows).toHaveLength(2);
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_EMAIL')).toBe(false);
  });
});
