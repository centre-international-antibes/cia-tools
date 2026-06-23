import { describe, it, expect } from 'vitest';
import { wrapMjmlLayout } from '~/server/utils/mjml/layout';
import { compileMjml, compiledHtmlToPlaintext } from '~/server/utils/templateRenderer';
import { brandToHandlebarsParams, type BrandContext } from '~/server/utils/brand';
import Handlebars from 'handlebars';

const fakeBrand: BrandContext = {
  logoUrl: 'https://example.test/logo.png',
  companyName: 'Test Brand',
  legalName: 'TEST BRAND SAS',
  addressLine1: '1 rue de Test',
  addressLine2: '',
  postalCode: '00000',
  city: 'Testville',
  country: 'Testland',
  phone: '+33 0 00 00 00 00',
  websiteUrl: 'https://example.test',
  websiteLabel: 'example.test',
  supportEmail: 'support@example.test',
  replyToEmail: 'support@example.test',
  termsUrl: 'https://example.test/terms',
  taglineFr: 'Tagline FR',
  taglineEn: 'Tagline EN',
  iban: 'FR00 0000 0000 0000 0000 000',
  bic: 'TESTFRPP',
  bankName: '',
  signatureName: 'Test Team',
};

describe('wrapMjmlLayout', () => {
  it('compiles to HTML with no MJML errors', () => {
    const mjml = wrapMjmlLayout({
      preheader: 'Test preheader',
      bodyMjml: '<mj-section><mj-column><mj-text>Body</mj-text></mj-column></mj-section>',
      language: 'fr',
    });
    const compiled = compileMjml(mjml);
    expect(compiled.errors).toEqual([]);
    expect(compiled.html).toContain('<html');
  });

  it('renders FR signature labels and resolves brand vars via Handlebars', () => {
    const mjml = wrapMjmlLayout({
      preheader: 'FR test',
      bodyMjml: '<mj-section><mj-column><mj-text>Body</mj-text></mj-column></mj-section>',
      language: 'fr',
    });
    const html = compileMjml(mjml).html;
    const rendered = Handlebars.compile(html)(brandToHandlebarsParams(fakeBrand, 'fr'));
    expect(rendered).toContain('Cordialement,');
    expect(rendered).toContain('Test Team');
    expect(rendered).toContain('Tagline FR');
    expect(rendered).toContain('https://example.test/logo.png');
    expect(rendered).toContain('support@example.test');
  });

  it('renders EN signature labels', () => {
    const mjml = wrapMjmlLayout({
      preheader: 'EN test',
      bodyMjml: '<mj-section><mj-column><mj-text>Body</mj-text></mj-column></mj-section>',
      language: 'en',
    });
    const html = compileMjml(mjml).html;
    const rendered = Handlebars.compile(html)(brandToHandlebarsParams(fakeBrand, 'en'));
    expect(rendered).toContain('Best regards,');
    expect(rendered).toContain('Tagline EN');
  });

  it('produces a non-empty plaintext fallback', () => {
    const mjml = wrapMjmlLayout({
      preheader: 'Test',
      bodyMjml: '<mj-section><mj-column><mj-text>Hello world</mj-text></mj-column></mj-section>',
      language: 'fr',
    });
    const html = compileMjml(mjml).html;
    const rendered = Handlebars.compile(html)(brandToHandlebarsParams(fakeBrand, 'fr'));
    const text = compiledHtmlToPlaintext(rendered);
    expect(text).toContain('Hello world');
    expect(text.length).toBeGreaterThan(20);
  });

  it('contains no emoji codepoints', () => {
    const mjml = wrapMjmlLayout({
      preheader: 'No emoji',
      bodyMjml: '<mj-section><mj-column><mj-text>Body</mj-text></mj-column></mj-section>',
      language: 'fr',
    });
    // Emoji ranges (smileys, symbols, transport, flags). Excludes plain text.
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F900}-\u{1F9FF}]/u;
    expect(emojiRe.test(mjml)).toBe(false);
  });

  it('keeps the Brevo {unsubscribe} placeholder intact for substitution', () => {
    const mjml = wrapMjmlLayout({
      preheader: 'Test',
      bodyMjml: '<mj-section><mj-column><mj-text>Body</mj-text></mj-column></mj-section>',
      language: 'fr',
    });
    const html = compileMjml(mjml).html;
    expect(html).toContain('{unsubscribe}');
  });
});
