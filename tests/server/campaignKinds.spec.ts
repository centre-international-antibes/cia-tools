import { describe, it, expect } from 'vitest';
import { getKindConfig, listKindConfigs } from '~/server/utils/campaignKinds';
import { buildRowMapper } from '~/server/utils/headerMap';

describe('campaignKinds registry', () => {
  it('exposes one entry per kind', () => {
    const all = listKindConfigs();
    expect(all.length).toBe(8);
  });

  it('ATS picks the light variant when there is no housing', () => {
    const cfg = getKindConfig('ats');
    const parsed = cfg.parseRow(
      { email: 'a@x.com', first_name: 'A', last_name: 'A', no_flight_info: 'true' },
      0,
    );
    expect(parsed).not.toBeNull();
    expect(cfg.resolveVariant(parsed!)).toBe('light');
    const params = cfg.buildParams(parsed!);
    expect(params.no_flight_info).toBe(true);
  });

  it('ATS picks the full variant when housing is present', () => {
    const cfg = getKindConfig('ats');
    const parsed = cfg.parseRow(
      { email: 'a@x.com', first_name: 'A', last_name: 'A', housing_residence: 'Garrett' },
      0,
    );
    expect(cfg.resolveVariant(parsed!)).toBe('full');
  });

  it('ATS suppresses rows where every paperwork item is n/a', () => {
    const cfg = getKindConfig('ats');
    const mapped = buildRowMapper('ats')({
      email: 'a@x.com',
      Nom: 'CLARK Beau',
      'Règle Ats': 'n/a',
      Ats: 'n/a',
      'Fiche San.': 'n/a',
      Passeport: 'n/a',
      Type: 'A',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.first_name).toBe('Beau');
    expect(parsed.last_name).toBe('CLARK');
    expect(parsed.eligibility.suppressed).toBe(true);
    expect(parsed.eligibility.suppression_reasons).toContain('ats_not_required');
    expect(parsed.eligibility.audience).toBe('adult');
  });

  it('ATS classifies a numeric Règle Ats as "required"', () => {
    const cfg = getKindConfig('ats');
    const mapped = buildRowMapper('ats')({
      email: 'a@x.com',
      Nom: 'EDSTROM Arvid',
      'Règle Ats': '255',
      Type: 'J',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.ats_rule).toBe('required');
    expect(parsed.eligibility.audience).toBe('junior');
  });

  it('course_location computes start_time per course type', () => {
    const cfg = getKindConfig('course_location');
    const group = cfg.parseRow(
      { email: 'a@x.com', first_name: 'A', last_name: 'A', course_type: 'group' },
      0,
    );
    const priv = cfg.parseRow(
      { email: 'b@x.com', first_name: 'B', last_name: 'B', course_type: 'private' },
      0,
    );
    expect(cfg.buildParams(group!).start_time).toBe('08:30');
    expect(cfg.buildParams(priv!).start_time).toBe('12:30');
  });

  it('payment_reminder formats amount in EUR by language', () => {
    const cfg = getKindConfig('payment_reminder');
    const parsed = cfg.parseRow(
      {
        email: 'p@x.com',
        first_name: 'P',
        last_name: 'P',
        client_id: '1',
        amount_due: '1234,56',
      },
      0,
    );
    expect(parsed!.eligibility.amount_cents).toBe(123456);
    const params = cfg.buildParams(parsed!);
    expect(typeof params.amount).toBe('string');
    expect(String(params.amount)).toMatch(/1.?234[,.]56/);
  });

  it('payment_reminder parses anglo "1,050.00" format', () => {
    const cfg = getKindConfig('payment_reminder');
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com',
      Nom: 'HSU Hung Hsuan',
      Id: '31485',
      Solde: '1,050.00',
      NomTo: 'DIRECT 2',
      Type: 'A',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.amount_cents).toBe(105000);
    expect(parsed.eligibility.suppressed).toBeFalsy();
    expect(parsed.eligibility.client_type).toBe('DIRECT');
  });

  it('payment_reminder suppresses rows whose notes contain "ne pas relancer"', () => {
    const cfg = getKindConfig('payment_reminder');
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com',
      Nom: 'STANGE Grethe',
      Id: '28475',
      Solde: '153.00',
      NomTo: 'DIRECT 2',
      Notes: 'Avoir n°103 - ne pas relancer',
      Type: 'A',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.suppressed).toBe(true);
    expect(parsed.eligibility.suppression_reasons).toEqual(
      expect.arrayContaining(['do_not_contact', 'credit_note']),
    );
  });

  it('payment_reminder picks "second" variant after one prior reminder', () => {
    const cfg = getKindConfig('payment_reminder');
    const mapped = buildRowMapper('payment_reminder')({
      Email: 'p@x.com',
      Nom: 'HSU Hung Hsuan',
      Id: '31485',
      Solde: '1,050.00',
      'Relance 1': '5/18/26',
      NomTo: 'DIRECT 2',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.eligibility.reminder_count).toBe(1);
    expect(cfg.resolveVariant(parsed)).toBe('second');
    const params = cfg.buildParams(parsed);
    expect(params.relance_count).toBe(2);
  });

  it('housing_confirmation merges rows sharing the same client_id', () => {
    const cfg = getKindConfig('housing_confirmation');
    const a = cfg.parseRow(
      { email: 'x@y.com', first_name: 'X', last_name: 'Y', client_id: '7', housing_residence: 'Garrett', package_code: 'ESSENTIAL' },
      0,
    )!;
    const b = cfg.parseRow(
      { email: 'x@y.com', first_name: 'X', last_name: 'Y', client_id: '7', housing_residence: 'Garrett', package_code: 'PRESTIGE' },
      1,
    )!;
    const grouped = cfg.groupRows!([a, b]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].eligibility.package_codes).toEqual(
      expect.arrayContaining(['ESSENTIAL', 'PRESTIGE']),
    );
  });

  it('welcome_pack suppresses non-DIRECT customers instead of dropping them', () => {
    const cfg = getKindConfig('welcome_pack');
    const direct = cfg.parseRow(
      { email: 'a@x.com', first_name: 'A', last_name: 'A', client_type: 'DIRECT' },
      0,
    )!;
    const group = cfg.parseRow(
      { email: 'b@x.com', first_name: 'B', last_name: 'B', client_type: 'GROUP' },
      0,
    )!;
    expect(direct.eligibility.suppressed).toBeFalsy();
    expect(group.eligibility.suppressed).toBe(true);
    expect(group.eligibility.suppression_reasons).toContain('wrong_client_type');
  });

  it('welcome_pack reads ERP "NomTo" tag as DIRECT', () => {
    const cfg = getKindConfig('welcome_pack');
    const mapped = buildRowMapper('welcome_pack')({
      Email: 'a@x.com',
      Nom: 'CLARK Beau',
      NomTo: 'DIRECT 2',
    });
    const parsed = cfg.parseRow(mapped, 0)!;
    expect(parsed.first_name).toBe('Beau');
    expect(parsed.last_name).toBe('CLARK');
    expect(parsed.eligibility.client_type).toBe('DIRECT');
    expect(parsed.eligibility.suppressed).toBeFalsy();
  });
});
