import { describe, it, expect } from 'vitest';
import Handlebars from 'handlebars';
import { ATS_TEMPLATES } from '~/server/utils/mjml/templates/ats';
import { compileMjml } from '~/server/utils/templateRenderer';
import { getKindConfig } from '~/server/utils/campaignKinds';
import { brandToHandlebarsParams, type BrandContext } from '~/server/utils/brand';

const brand: BrandContext = {
  logoUrl: 'https://example.test/logo.png',
  companyName: 'CIA',
  legalName: 'SAS CENTRE INTERNATIONAL ANTIBES',
  addressLine1: "38 Boulevard d'Aguillon",
  addressLine2: '',
  postalCode: '06600',
  city: 'Antibes',
  country: 'France',
  phone: '+33 4 92 90 71 72',
  websiteUrl: 'https://www.cia-france.com',
  websiteLabel: 'www.cia-france.com',
  supportEmail: 'direct5@cia-france.com',
  replyToEmail: 'direct5@cia-france.com',
  termsUrl: 'https://www.cia-france.com/terms-and-conditions',
  taglineFr: 'tagline FR',
  taglineEn: 'tagline EN',
  iban: 'FR63 3000 2032 3100 0007 4097 Y88',
  bic: 'CRLYFRPP',
  bankName: '',
  signatureName: 'Back Office Team',
};

function render(mjml: string, params: Record<string, unknown>, language: 'fr' | 'en'): string {
  const compiled = compileMjml(mjml);
  expect(compiled.errors).toEqual([]);
  return Handlebars.compile(compiled.html)({
    ...brandToHandlebarsParams(brand, language),
    ...params,
  });
}

function buildAtsParams(raw: Record<string, unknown>, language: 'fr' | 'en') {
  const cfg = getKindConfig('ats');
  const parsed = cfg.parseRow(raw, 0);
  if (!parsed) throw new Error('Row was rejected by the parser.');
  parsed.language = language;
  return { variant: cfg.resolveVariant(parsed), params: cfg.buildParams(parsed), parsed };
}

describe('ATS template — junior', () => {
  it('renders the with-housing PDF URL and parent ID line (FR)', () => {
    const { variant, params } = buildAtsParams(
      {
        email: 'parents@example.com',
        full_name: 'CLARK Beau',
        audience_tag: 'J',
        housing_residence: 'Garrett',
        // empty document cells → still missing
        ats_done: '',
        health_form_done: '',
        passport_done: '',
      },
      'fr',
    );
    expect(variant).toBe('junior');
    const html = render(ATS_TEMPLATES.junior.fr.mjml, params, 'fr');
    expect(html).toContain('Chers parents');
    expect(html).toContain('media-file/900/documents-avant-arrivee-francais.pdf');
    expect(html).toContain('Copie de la pi');
    expect(html).toContain('Fiche sanitaire');
    expect(html).toContain('Copie du passeport');
    expect(html).toContain('Fiche ATS');
  });

  it('renders the without-housing PDF URL (EN)', () => {
    const { variant, params } = buildAtsParams(
      {
        email: 'parents@example.com',
        full_name: 'CLARK Beau',
        audience_tag: 'J',
        health_form_done: '',
        ats_done: 'OK',
        passport_done: 'OK',
      },
      'en',
    );
    expect(variant).toBe('junior');
    const html = render(ATS_TEMPLATES.junior.en.mjml, params, 'en');
    expect(html).toContain('Dear parents');
    expect(html).toContain('media-file/1749/pre-arrival-documents-without-accommodation.pdf');
    expect(html).toContain('Health form');
  });

  it('hides missing-doc list when nothing is missing', () => {
    const { params } = buildAtsParams(
      {
        email: 'parents@example.com',
        full_name: 'CLARK Beau',
        audience_tag: 'J',
        ats_done: 'OK',
        health_form_done: 'OK',
        passport_done: 'OK',
        transfer: 'X',
      },
      'fr',
    );
    const html = render(ATS_TEMPLATES.junior.fr.mjml, params, 'fr');
    // No missing documents → no <ul> rendered by the partial.
    expect(html).toContain('Voici la check-list');
    expect(html).not.toContain('<ul');
  });
});

describe('ATS template — adult', () => {
  it('residence + transfer required + Aragon (EN)', () => {
    const { variant, params } = buildAtsParams(
      {
        email: 'student@example.com',
        full_name: 'EDSTROM Arvid',
        audience_tag: 'A',
        housing_type: 'R',
        housing_residence: 'Aragon',
        transfer: 'X',
      },
      'en',
    );
    expect(variant).toBe('adult');
    expect(params.is_aragon).toBe(true);
    expect(params.needs_transfer).toBe(true);
    expect(params.is_residence).toBe(true);
    const html = render(ATS_TEMPLATES.adult.en.mjml, params, 'en');
    expect(html).toContain('Dear Student');
    expect(html).toContain('As transfer is required');
    expect(html).toContain('Reception opening hours');
    expect(html).toContain('Aragon');
  });

  it('family + no transfer (FR)', () => {
    const { variant, params } = buildAtsParams(
      {
        email: 'student@example.com',
        full_name: 'EDSTROM Arvid',
        audience_tag: 'A',
        housing_type: 'F',
        housing_residence: '',
      },
      'fr',
    );
    expect(variant).toBe('adult');
    expect(params.is_family).toBe(true);
    expect(params.needs_transfer).toBe(false);
    const html = render(ATS_TEMPLATES.adult.fr.mjml, params, 'fr');
    expect(html).toContain('Cher');
    expect(html).toContain('Aucun transfert');
    expect(html).toContain("familles d");
    // No residence-specific block when housing_type=F.
    expect(html).not.toContain('Horaires d');
  });
});
