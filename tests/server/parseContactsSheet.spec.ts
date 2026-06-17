import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseContactsSheet } from '~/server/utils/parseContactsSheet';

function buildXlsx(headers: string[], rows: Array<Record<string, unknown>>): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseContactsSheet', () => {
  it('parses ATS rows with conditional flags', () => {
    const buf = buildXlsx(
      ['email', 'first_name', 'last_name', 'no_flight_info', 'no_passport', 'housing_residence'],
      [
        {
          email: 'a@example.com',
          first_name: 'Alice',
          last_name: 'A',
          no_flight_info: 'true',
          no_passport: 'false',
          housing_residence: 'Garrett',
        },
        {
          email: 'b@example.com',
          first_name: 'Bob',
          last_name: 'B',
          no_flight_info: 'false',
          no_passport: 'true',
          housing_residence: '',
        },
      ],
    );
    const result = parseContactsSheet(buf, 'ats');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].eligibility.no_flight_info).toBe(true);
    expect(result.rows[0].eligibility.has_housing).toBe(true);
    expect(result.rows[1].eligibility.no_passport).toBe(true);
    expect(result.rows[1].eligibility.has_housing).toBe(false);
    expect(result.summary.accepted).toBe(2);
  });

  it('flags duplicates and invalid emails as warnings', () => {
    const buf = buildXlsx(
      ['email', 'first_name', 'last_name'],
      [
        { email: 'dup@example.com', first_name: 'A', last_name: 'A' },
        { email: 'dup@example.com', first_name: 'B', last_name: 'B' },
        { email: 'not-an-email', first_name: 'C', last_name: 'C' },
      ],
    );
    const result = parseContactsSheet(buf, 'ats');
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_EMAIL')).toBe(true);
    expect(result.warnings.some((w) => w.code === 'INVALID_EMAIL')).toBe(true);
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.invalidEmails).toBe(1);
  });

  it('marks non-DIRECT welcome_pack customers as suppressed', () => {
    const buf = buildXlsx(
      ['email', 'first_name', 'last_name', 'client_type'],
      [
        { email: 'a@x.com', first_name: 'A', last_name: 'A', client_type: 'DIRECT' },
        { email: 'b@x.com', first_name: 'B', last_name: 'B', client_type: 'GROUP' },
      ],
    );
    const result = parseContactsSheet(buf, 'welcome_pack');
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((r) => r.email === 'b@x.com')?.eligibility.suppressed).toBe(true);
    expect(result.summary.suppressed).toBe(1);
    expect(result.summary.accepted).toBe(1);
  });

  it('groups housing_confirmation rows by client_id and aggregates sections', () => {
    const buf = buildXlsx(
      ['email', 'first_name', 'last_name', 'client_id', 'housing_residence', 'package_code'],
      [
        { email: 'c@x.com', first_name: 'C', last_name: 'C', client_id: '42', housing_residence: 'Garrett', package_code: 'ESSENTIAL' },
        { email: 'c@x.com', first_name: 'C', last_name: 'C', client_id: '42', housing_residence: 'Garrett', package_code: 'PRESTIGE' },
      ],
    );
    const result = parseContactsSheet(buf, 'housing_confirmation');
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.eligibility.package_codes).toEqual(['ESSENTIAL']);
    expect(Array.isArray((row.raw as { sections?: unknown }).sections)).toBe(true);
  });

  it('parses payment_reminder amounts in cents', () => {
    const buf = buildXlsx(
      ['email', 'first_name', 'last_name', 'client_id', 'amount_due'],
      [
        { email: 'p@x.com', first_name: 'P', last_name: 'P', client_id: '1', amount_due: '1234,56' },
      ],
    );
    const result = parseContactsSheet(buf, 'payment_reminder');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].eligibility.amount_cents).toBe(123456);
  });

  it('drops totals/counter footer rows silently', () => {
    const buf = buildXlsx(
      ['Email', 'Nom', 'NomTo', 'Id', 'Solde'],
      [
        { Email: 'p@x.com', Nom: 'STANGE Grethe', NomTo: 'DIRECT 2', Id: '28475', Solde: '153.00' },
        { Email: '', Nom: 'Compteur', NomTo: '', Id: '20', Solde: '' },
      ],
    );
    const result = parseContactsSheet(buf, 'payment_reminder');
    expect(result.rows).toHaveLength(1);
    expect(result.summary.total).toBe(1);
    expect(result.warnings.some((w) => w.code === 'INVALID_EMAIL')).toBe(false);
  });
});

describe('parseContactsSheet — real ERP files', () => {
  it('imports the ATS export with French headers', () => {
    const buf = readFileSync(
      resolve(__dirname, '../../example-docs/ATS - liste excel complète.xlsx'),
    );
    const result = parseContactsSheet(buf, 'ats');
    expect(result.warnings.some((w) => w.code === 'MISSING_COLUMNS')).toBe(false);
    expect(result.rows.length).toBeGreaterThan(0);
    // ERP "Nom" column gets split into surname + given name.
    expect(result.rows.every((r) => r.first_name && r.last_name)).toBe(true);
    expect(result.rows.every((r) => /^[a-z0-9.+_-]+@/.test(r.email))).toBe(true);
    // Type A/J → audience adult/junior.
    expect(result.rows.every((r) => r.eligibility.audience === 'adult' || r.eligibility.audience === 'junior')).toBe(true);
    // At least one row is suppressed via "ats_not_required" (n/a everywhere).
    expect(result.rows.some((r) => r.eligibility.suppression_reasons?.includes('ats_not_required'))).toBe(true);
  });

  it('imports the payment reminder export and detects "ne pas relancer"', () => {
    const buf = readFileSync(
      resolve(__dirname, '../../example-docs/Relance solde - liste complète.xlsx'),
    );
    const result = parseContactsSheet(buf, 'payment_reminder');
    expect(result.warnings.some((w) => w.code === 'MISSING_COLUMNS')).toBe(false);
    expect(result.rows.length).toBeGreaterThan(0);

    // Counter row at the end must be silently dropped.
    expect(result.rows.every((r) => r.email !== '' && !/compteur/i.test(r.last_name))).toBe(true);

    // Several "Avoir n°… - ne pas relancer" rows must be suppressed.
    const dnc = result.rows.filter((r) =>
      r.eligibility.suppression_reasons?.includes('do_not_contact'),
    );
    expect(dnc.length).toBeGreaterThanOrEqual(4);
    expect(
      dnc.every((r) => r.eligibility.suppression_reasons?.includes('credit_note')),
    ).toBe(true);

    // Anglo-formatted "1,050.00" must parse to 105000 cents.
    const hsu = result.rows.find((r) => /tyhsu/i.test(r.email));
    expect(hsu?.eligibility.amount_cents).toBe(105000);
    expect(hsu?.eligibility.client_type).toBe('DIRECT');
  });
});
