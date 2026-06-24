import { wrapMjmlLayout } from '../layout';
import { heading, paragraph } from '../partials';
import { EMAIL_TOKENS } from '../tokens';
import type { DefaultTemplate } from './types';

const c = EMAIL_TOKENS.color;
const f = EMAIL_TOKENS.font;

/* ─── Variable schemas ───────────────────────────────────────── */

const JUNIOR_VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
  { key: 'full_name', type: 'string', required: false, sample: 'DUPONT Marie' },
  { key: 'no_ats_form', type: 'boolean', required: false, sample: true },
  { key: 'no_health_form', type: 'boolean', required: false, sample: true },
  { key: 'no_passport', type: 'boolean', required: false, sample: false },
  { key: 'has_missing_docs', type: 'boolean', required: false, sample: true },
  { key: 'has_housing', type: 'boolean', required: false, sample: true },
] as const;

const ADULT_VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
  { key: 'full_name', type: 'string', required: false, sample: 'DUPONT Marie' },
  { key: 'needs_transfer', type: 'boolean', required: false, sample: false },
  { key: 'is_family', type: 'boolean', required: false, sample: false },
  { key: 'is_residence', type: 'boolean', required: false, sample: true },
  { key: 'is_aragon', type: 'boolean', required: false, sample: false },
  { key: 'housing_residence', type: 'string', required: false, sample: 'Aragon' },
  { key: 'arrival_time', type: 'string', required: false, sample: '' },
] as const;

/* ─── Junior body (parents, with/without housing) ────────────── */

function juniorBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Chers parents,',
      intro: 'Nous allons bient\u00f4t accueillir votre enfant.',
      missingIntro: 'Il nous manque encore les documents suivants :',
      fullIntro: 'Voici la check-list compl\u00e8te des documents \u00e0 nous transmettre avant l\u2019arriv\u00e9e :',
      requiredTitle: 'DOCUMENTS \u00c0 NOUS TRANSMETTRE',
      atsForm: 'Fiche ATS (autorisation de sortie)',
      healthForm: 'Fiche sanitaire',
      passport: 'Copie du passeport de votre enfant',
      parentsId: 'Copie de la pi\u00e8ce d\u2019identit\u00e9 / passeport des parents',
      infoTitle: 'POUR VOTRE INFORMATION',
      preArrivalLabel: 'Document d\u2019informations pratiques avant arriv\u00e9e :',
      alreadySent: 'Si vous avez d\u00e9j\u00e0 transmis ces documents, merci de ne pas tenir compte de ce message.',
      closing: 'Nous restons \u00e0 votre disposition pour toute information compl\u00e9mentaire.',
      preArrivalUrlWith: 'https://www.cia-france.com/media-file/900/documents-avant-arrivee-francais.pdf',
      preArrivalUrlWithout: 'https://www.cia-france.com/media-file/1748/documents-avant-arrivee-sans-hebergement.pdf',
    }
    : {
      hello: 'Dear parents,',
      intro: 'We are about to welcome your child shortly.',
      missingIntro: 'We are still missing the following documents:',
      fullIntro: 'Here is the full checklist of documents we need to receive before arrival:',
      requiredTitle: 'DOCUMENTS WE NEED FROM YOU',
      atsForm: 'ATS form (Going out permission form)',
      healthForm: 'Health form',
      passport: 'Copy of your child\u2019s passport',
      parentsId: 'Parents\u2019 copy of ID / passport',
      infoTitle: 'FOR YOUR INFORMATION',
      preArrivalLabel: 'Pre-arrival information document:',
      alreadySent: 'If you have already sent these documents, please disregard this email.',
      closing: 'We remain at your disposal for any further information.',
      preArrivalUrlWith: 'https://www.cia-france.com/media-file/901/pre-arrival-documents-english.pdf',
      preArrivalUrlWithout: 'https://www.cia-france.com/media-file/1749/pre-arrival-documents-without-accommodation.pdf',
    };

  const preArrivalUrl = `{{#if has_housing}}${t.preArrivalUrlWith}{{else}}${t.preArrivalUrlWithout}{{/if}}`;

  // Action-items section: items we need parents to send us. The parents'
  // own ID is always listed (no per-recipient flag tracks it); the other
  // items are conditional on the missing-doc flags.
  const requiredSection = `
    ${heading(t.requiredTitle)}
    ${paragraph('{{#if has_missing_docs}}' + t.missingIntro + '{{else}}' + t.fullIntro + '{{/if}}')}
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeBody}"
      line-height="${f.lineHeight}"
      color="${c.text}"
      padding="0 24px"
    >
      <ul style="padding-left: 18px; margin: 0;">
        {{#if no_ats_form}}<li style="margin-bottom: 6px;">${t.atsForm}</li>{{/if}}
        {{#if no_health_form}}<li style="margin-bottom: 6px;">${t.healthForm}</li>{{/if}}
        {{#if no_passport}}<li style="margin-bottom: 6px;">${t.passport}</li>{{/if}}
        <li style="margin-bottom: 6px;">${t.parentsId}</li>
      </ul>
    </mj-text>
  `;

  // Reference section: information we provide (PDF link). Visually distinct
  // from the action-items section so parents don't mistake the link for
  // something they must send back.
  const infoSection = `
    ${heading(t.infoTitle)}
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeBody}"
      line-height="${f.lineHeight}"
      color="${c.text}"
      padding="6px 24px"
    >
      ${t.preArrivalLabel}<br/>
      <a href="${preArrivalUrl}" style="color: ${c.primary};">${preArrivalUrl}</a>
    </mj-text>
  `;

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${paragraph(t.intro)}
        ${requiredSection}
        ${infoSection}
        ${paragraph(`<em>${t.alreadySent}</em>`)}
        ${paragraph(t.closing)}
      </mj-column>
    </mj-section>
  `;
}

/* ─── Adult body (residence/family × transfer × aragon) ──────── */

function adultBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Cher \u00e9tudiant,',
      intro: 'Nous nous appr\u00eatons \u00e0 vous accueillir et il nous manque encore quelques informations :',
      arrivalDetails: 'Vos d\u00e9tails d\u2019arriv\u00e9e et de d\u00e9part',
      transferYes: 'Un transfert \u00e9tant requis, nous avons besoin de l\u2019organiser. Merci de nous communiquer vos horaires complets.',
      transferNo: 'Aucun transfert n\u2019est demand\u00e9.',
      familyHours: 'Les familles d\u2019accueil sont disponibles \u00e0 partir de 17h00.',
      familyAsk: 'Afin que la famille puisse \u00eatre pr\u00eate \u00e0 vous accueillir, nous avons besoin de vos informations d\u2019arriv\u00e9e.',
      residenceHours: 'Horaires d\u2019ouverture de la r\u00e9ception :',
      sat: 'Arriv\u00e9e samedi : 9h00 \u00e0 12h00',
      sun: 'Arriv\u00e9e dimanche : 14h00 \u00e0 19h30',
      aragonNote: 'Attention, conditions sp\u00e9cifiques pour la R\u00e9sidence Aragon.',
      collectKey: 'Arriv\u00e9e durant les horaires d\u2019ouverture : vous pouvez r\u00e9cup\u00e9rer la cl\u00e9 et le pack d\u2019accueil directement \u00e0 la r\u00e9ception.',
      closing: 'Nous restons \u00e0 votre disposition pour toute information compl\u00e9mentaire.',
    }
    : {
      hello: 'Dear Student,',
      intro: 'We will welcome you soon and we still miss some information:',
      arrivalDetails: 'Your arrival and departure details',
      transferYes: 'As transfer is required, we need to organise it. Please share your complete schedule with us.',
      transferNo: 'As no transfer is requested.',
      familyHours: 'Host families are available from 5pm.',
      familyAsk: 'In order for the family to be ready to welcome you, we need your arrival information.',
      residenceHours: 'Reception opening hours:',
      sat: 'If booked for arrival on Saturday: 9:00am to 12:00pm',
      sun: 'If booked for arrival on Sunday: 2:00pm to 7:30pm',
      aragonNote: 'Please note, specific conditions apply for Residence Aragon.',
      collectKey: 'Arriving during opening hours: you can collect the key and welcome information pack directly at the reception.',
      closing: 'We remain at your disposal for any further information.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${paragraph(t.intro)}
        ${heading(t.arrivalDetails)}
        ${paragraph(`{{#if needs_transfer}}<strong>${t.transferYes}</strong>{{else}}<strong>${t.transferNo}</strong>{{/if}}`)}
        ${paragraph(
          `{{#if is_family}}${t.familyHours}<br/><br/>${t.familyAsk}{{else}}${t.residenceHours}<br/>\u2022 ${t.sat}<br/>\u2022 ${t.sun}{{#if is_aragon}}<br/><br/><em>${t.aragonNote}</em>{{/if}}<br/><br/>${t.collectKey}{{/if}}`,
        )}
        ${paragraph(t.closing)}
      </mj-column>
    </mj-section>
  `;
}

/* ─── Exports ────────────────────────────────────────────────── */

export const ATS_TEMPLATES: Record<'junior' | 'adult', Record<'fr' | 'en', DefaultTemplate>> = {
  junior: {
    fr: {
      subject: 'CIA - Documents avant arriv\u00e9e - {{full_name}}',
      preheader: 'Documents \u00e0 nous transmettre avant l\u2019arriv\u00e9e de votre enfant.',
      mjml: wrapMjmlLayout({
        preheader: 'Documents \u00e0 nous transmettre avant l\u2019arriv\u00e9e de votre enfant.',
        bodyMjml: juniorBody('fr'),
        language: 'fr',
      }),
      variables: [...JUNIOR_VARS],
    },
    en: {
      subject: 'CIA - Pre-arrival documents - {{full_name}}',
      preheader: 'Documents we need before your child\u2019s arrival.',
      mjml: wrapMjmlLayout({
        preheader: 'Documents we need before your child\u2019s arrival.',
        bodyMjml: juniorBody('en'),
        language: 'en',
      }),
      variables: [...JUNIOR_VARS],
    },
  },
  adult: {
    fr: {
      subject: 'CIA - Informations d\u2019arriv\u00e9e - {{full_name}}',
      preheader: 'Quelques informations encore avant votre arriv\u00e9e \u00e0 Antibes.',
      mjml: wrapMjmlLayout({
        preheader: 'Quelques informations encore avant votre arriv\u00e9e \u00e0 Antibes.',
        bodyMjml: adultBody('fr'),
        language: 'fr',
      }),
      variables: [...ADULT_VARS],
    },
    en: {
      subject: 'CIA - Arrival details - {{full_name}}',
      preheader: 'A few details we need before your arrival in Antibes.',
      mjml: wrapMjmlLayout({
        preheader: 'A few details we need before your arrival in Antibes.',
        bodyMjml: adultBody('en'),
        language: 'en',
      }),
      variables: [...ADULT_VARS],
    },
  },
};
