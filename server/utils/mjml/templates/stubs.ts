import { wrapMjmlLayout } from '../layout';
import { paragraph, heading } from '../partials';
import type { DefaultTemplate } from './types';

/**
 * Minimal placeholder body for kinds we haven't yet rolled out a finished
 * template for. Keeps `email_templates` complete after seeding so operators
 * always have a row to clone, instead of facing an empty list.
 */
function stubBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Bonjour {{first_name}},',
      title: 'Mod\u00e8le \u00e0 personnaliser',
      todo: 'Ce mod\u00e8le est un brouillon par d\u00e9faut. Vous pouvez l\u2019\u00e9diter dans l\u2019interface pour le personnaliser.',
    }
    : {
      hello: 'Hello {{first_name}},',
      title: 'Template to customise',
      todo: 'This is a default placeholder. Edit it from the dashboard to customise the content.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${heading(t.title)}
        ${paragraph(t.todo)}
      </mj-column>
    </mj-section>
  `;
}

export function stubTemplate(
  language: 'fr' | 'en',
  subject: string,
  preheader: string,
): DefaultTemplate {
  return {
    subject,
    preheader,
    mjml: wrapMjmlLayout({ preheader, bodyMjml: stubBody(language), language }),
    variables: [
      { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
      { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
    ],
  };
}
