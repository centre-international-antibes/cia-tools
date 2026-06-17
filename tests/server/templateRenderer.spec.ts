import { describe, it, expect } from 'vitest';
import {
  compileMjml,
  compiledHtmlToPlaintext,
  renderTemplate,
  clearTemplateCache,
} from '~/server/utils/templateRenderer';

describe('templateRenderer', () => {
  it('compiles minimal MJML', () => {
    const result = compileMjml(
      '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>',
    );
    expect(result.errors).toEqual([]);
    expect(result.html).toContain('<html');
  });

  it('renders Handlebars variables in subject and html', () => {
    const mjml = `<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{first_name}}</mj-text></mj-column></mj-section></mj-body></mjml>`;
    const compiled = compileMjml(mjml);
    const version = {
      id: 'test-1',
      subject: 'Hello {{first_name}}',
      compiled_html: compiled.html,
      plaintext: '',
      variables_schema: [{ key: 'first_name', required: true }],
    };
    clearTemplateCache();
    const result = renderTemplate(version, { first_name: 'Marie' });
    expect(result.subject).toBe('Hello Marie');
    expect(result.html).toContain('Hi Marie');
    expect(result.missingVariables).toEqual([]);
  });

  it('reports missing required variables', () => {
    const compiled = compileMjml(
      '<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{first_name}}</mj-text></mj-column></mj-section></mj-body></mjml>',
    );
    const version = {
      id: 'test-2',
      subject: 'Hi {{first_name}}',
      compiled_html: compiled.html,
      plaintext: '',
      variables_schema: [{ key: 'first_name', required: true }],
    };
    clearTemplateCache();
    const result = renderTemplate(version, {});
    expect(result.missingVariables).toContain('first_name');
  });

  it('extracts a plaintext version of compiled HTML', () => {
    const compiled = compileMjml(
      '<mjml><mj-body><mj-section><mj-column><mj-text>Bonjour Marie</mj-text></mj-column></mj-section></mj-body></mjml>',
    );
    const text = compiledHtmlToPlaintext(compiled.html);
    expect(text).toContain('Bonjour Marie');
  });
});
