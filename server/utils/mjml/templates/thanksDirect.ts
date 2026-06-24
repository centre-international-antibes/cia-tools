import { wrapMjmlLayout } from '../layout';
import { heading, paragraph } from '../partials';
import type { DefaultTemplate } from './types';

const VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
] as const;

/* ─── Junior body (addressed to parents) ─────────────────────── */

function juniorBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Chers parents,',
      title: 'Merci pour votre confiance',
      thanks: 'Nous tenons \u00e0 vous remercier pour la confiance que vous nous avez accord\u00e9e en r\u00e9servant un s\u00e9jour au sein de notre \u00e9cole.',
      hope: 'Nous esp\u00e9rons que votre enfant gardera le souvenir d\u2019une exp\u00e9rience positive et enrichissante.',
      feedback: 'N\u2019h\u00e9sitez pas \u00e0 nous faire part de vos impressions et commentaires.',
      again: 'L\u2019\u00e9quipe du Centre International d\u2019Antibes serait ravie d\u2019accueillir \u00e0 nouveau votre enfant.',
      closing: 'Nous vous souhaitons une belle journ\u00e9e.',
    }
    : {
      hello: 'Dear parents,',
      title: 'Thank you for your trust',
      thanks: 'We would like to thank you for the trust you have placed in our school by booking a stay with us.',
      hope: 'We hope your child will keep the memory of a positive and enriching experience.',
      feedback: 'Please do not hesitate to share your impressions and feedback with us.',
      again: 'The team at Centre International d\u2019Antibes would be delighted to welcome your child again.',
      closing: 'We wish you a lovely day.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${heading(t.title)}
        ${paragraph(t.thanks)}
        ${paragraph(t.hope)}
        ${paragraph(t.feedback)}
        ${paragraph(t.again)}
        ${paragraph(t.closing)}
      </mj-column>
    </mj-section>
  `;
}

/* ─── Adult body (addressed to the student) ──────────────────── */

function adultBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Bonjour {{first_name}},',
      title: 'Merci pour votre s\u00e9jour',
      thanks: 'Nous tenons \u00e0 vous remercier d\u2019avoir choisi le Centre International d\u2019Antibes pour votre s\u00e9jour linguistique.',
      hope: 'Nous esp\u00e9rons que vous avez pass\u00e9 un moment agr\u00e9able \u00e0 Antibes et que vous gardez un excellent souvenir de votre exp\u00e9rience parmi nous.',
      feedback: 'Votre avis nous est pr\u00e9cieux. N\u2019h\u00e9sitez pas \u00e0 nous faire part de vos impressions et commentaires.',
      again: 'Nous serions ravis de vous revoir pour un prochain s\u00e9jour.',
      closing: 'Au plaisir de vous accueillir \u00e0 nouveau.',
    }
    : {
      hello: 'Hello {{first_name}},',
      title: 'Thank you for your stay',
      thanks: 'We would like to thank you for choosing Centre International d\u2019Antibes for your language stay.',
      hope: 'We hope you enjoyed your time in Antibes and that you keep great memories of your experience with us.',
      feedback: 'Your feedback matters to us. Please feel free to share your impressions and comments.',
      again: 'We would be delighted to welcome you back for another stay.',
      closing: 'Looking forward to seeing you again.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${heading(t.title)}
        ${paragraph(t.thanks)}
        ${paragraph(t.hope)}
        ${paragraph(t.feedback)}
        ${paragraph(t.again)}
        ${paragraph(t.closing)}
      </mj-column>
    </mj-section>
  `;
}

/* ─── Exports ────────────────────────────────────────────────── */

export const THANKS_DIRECT_TEMPLATES: Record<
  'junior' | 'adult',
  Record<'fr' | 'en', DefaultTemplate>
> = {
  junior: {
    fr: {
      subject: 'CIA - Merci pour votre confiance',
      preheader: 'Merci d\u2019avoir choisi le CIA pour le s\u00e9jour de votre enfant.',
      mjml: wrapMjmlLayout({
        preheader: 'Merci d\u2019avoir choisi le CIA pour le s\u00e9jour de votre enfant.',
        bodyMjml: juniorBody('fr'),
        language: 'fr',
      }),
      variables: [...VARS],
    },
    en: {
      subject: 'CIA - Thank you for your trust',
      preheader: 'Thank you for choosing CIA for your child\u2019s stay.',
      mjml: wrapMjmlLayout({
        preheader: 'Thank you for choosing CIA for your child\u2019s stay.',
        bodyMjml: juniorBody('en'),
        language: 'en',
      }),
      variables: [...VARS],
    },
  },
  adult: {
    fr: {
      subject: 'CIA - Merci pour votre s\u00e9jour',
      preheader: 'Merci d\u2019avoir choisi le CIA pour votre s\u00e9jour linguistique.',
      mjml: wrapMjmlLayout({
        preheader: 'Merci d\u2019avoir choisi le CIA pour votre s\u00e9jour linguistique.',
        bodyMjml: adultBody('fr'),
        language: 'fr',
      }),
      variables: [...VARS],
    },
    en: {
      subject: 'CIA - Thank you for your stay',
      preheader: 'Thank you for choosing CIA for your language stay.',
      mjml: wrapMjmlLayout({
        preheader: 'Thank you for choosing CIA for your language stay.',
        bodyMjml: adultBody('en'),
        language: 'en',
      }),
      variables: [...VARS],
    },
  },
};
