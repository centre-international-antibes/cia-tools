import mjml2html from 'mjml';
import Handlebars from 'handlebars';
import { htmlToText } from 'html-to-text';

/**
 * MJML + Handlebars renderer.
 *
 * - MJML compiles once per version (store result in DB).
 * - Handlebars compiles lazily per version_id, cached in-process.
 * - Missing required variables surface a render error rather than silently
 *   shipping `{{var}}` placeholders to recipients.
 */

const templateCache = new Map<
  string,
  { subject: HandlebarsTemplateDelegate; html: HandlebarsTemplateDelegate }
>();

export interface MjmlCompileResult {
  html: string;
  errors: string[];
}

export function compileMjml(mjmlSource: string): MjmlCompileResult {
  const result = mjml2html(mjmlSource, {
    validationLevel: 'soft',
    keepComments: false,
  });
  return {
    html: result.html,
    errors: result.errors?.map((e) => e.formattedMessage ?? e.message) ?? [],
  };
}

export function compiledHtmlToPlaintext(html: string): string {
  return htmlToText(html, {
    wordwrap: 100,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
    ],
  });
}

export interface RenderedEmail {
  subject: string;
  html: string;
  plaintext: string;
  missingVariables: string[];
}

export interface TemplateVersionForRender {
  id: string;
  subject: string;
  compiled_html: string;
  plaintext: string;
  variables_schema: unknown;
}

function getDelegates(version: TemplateVersionForRender) {
  let entry = templateCache.get(version.id);
  if (!entry) {
    entry = {
      subject: Handlebars.compile(version.subject, { strict: false, noEscape: false }),
      html: Handlebars.compile(version.compiled_html, { strict: false, noEscape: false }),
    };
    templateCache.set(version.id, entry);
  }
  return entry;
}

/**
 * Renders a template version against a params bag.
 * `missingVariables` lists required vars whose value resolves to undefined/null.
 */
export function renderTemplate(
  version: TemplateVersionForRender,
  params: Record<string, unknown>,
): RenderedEmail {
  const delegates = getDelegates(version);

  const subject = delegates.subject(params);
  const html = delegates.html(params);
  const plaintext = compiledHtmlToPlaintext(html);

  const schema = Array.isArray(version.variables_schema)
    ? (version.variables_schema as Array<{ key: string; required?: boolean }>)
    : [];
  const missing = schema
    .filter((v) => v.required)
    .filter((v) => {
      const value = params[v.key];
      return value === undefined || value === null || value === '';
    })
    .map((v) => v.key);

  return { subject, html, plaintext, missingVariables: missing };
}

export function clearTemplateCache(versionId?: string): void {
  if (versionId) templateCache.delete(versionId);
  else templateCache.clear();
}
