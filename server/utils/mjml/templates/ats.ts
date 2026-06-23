import { wrapMjmlLayout } from '../layout';
import { documentChecklist, heading, paragraph } from '../partials';
import { EMAIL_TOKENS } from '../tokens';
import type { DefaultTemplate } from './types';

const c = EMAIL_TOKENS.color;
const f = EMAIL_TOKENS.font;

/* ─── Variable schemas ───────────────────────────────────────── */

const JUNIOR_VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
  {
    key: 'missing_documents',
    type: 'array',
    required: false,
    sample: [
      { code: 'ats_form', label: 'ATS form (sortie authorisation)', url: '' },
      { code: 'health_form', label: 'Health form', url: '' },
      { code: 'passport', label: 'Copy of passport', url: '' },
    ],
  },
  { key: 'pre_arrival_url', type: 'url', required: true, sample: 'https://www.cia-france.com/media-file/900/documents-avant-arrivee-francais.pdf' },
  { key: 'has_housing', type: 'boolean', required: false, sample: true },
] as const;

const ADULT_VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
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
      missing: 'Il nous manque encore les documents suivants :',
      noMissing: 'Voici la check-list des documents \u00e0 nous transmettre avant l\u2019arriv\u00e9e.',
      checklistTitle: 'CHECK-LIST',
      preArrival: 'Documents avant arriv\u00e9e',
      parentsId: 'Copie de la pi\u00e8ce d\u2019identit\u00e9 / passeport des parents',
      closing: 'Nous restons \u00e0 votre disposition pour toute information compl\u00e9mentaire.',
    }
    : {
      hello: 'Dear parents,',
      intro: 'We are about to welcome your child shortly.',
      missing: 'We are still missing the following documents:',
      noMissing: 'Here is the checklist of documents required before arrival.',
      checklistTitle: 'CHECK-LIST',
      preArrival: 'Pre-arrival documents',
      parentsId: 'Parents copy of ID / passport',
      closing: 'We remain at your disposal for any further information.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(`${t.hello}`)}
        ${paragraph(`${t.intro}`)}
        ${paragraph('{{#if missing_documents.length}}' + t.missing + '{{else}}' + t.noMissing + '{{/if}}')}
        ${heading(t.checklistTitle)}
        ${documentChecklist()}
        <mj-text
          font-family="${f.family}"
          font-size="${f.sizeBody}"
          line-height="${f.lineHeight}"
          color="${c.text}"
          padding="10px 24px"
        >
          <strong>${t.preArrival}:</strong> <a href="{{pre_arrival_url}}" style="color: ${c.primary};">{{pre_arrival_url}}</a><br/>
          <strong>${t.parentsId}</strong>
        </mj-text>
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
      subject: 'CIA - Documents avant arriv\u00e9e',
      preheader: 'Documents \u00e0 nous transmettre avant l\u2019arriv\u00e9e de votre enfant.',
      mjml: wrapMjmlLayout({
        preheader: 'Documents \u00e0 nous transmettre avant l\u2019arriv\u00e9e de votre enfant.',
        bodyMjml: juniorBody('fr'),
        language: 'fr',
      }),
      variables: [...JUNIOR_VARS],
    },
    en: {
      subject: 'CIA - Pre-arrival documents',
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
      subject: 'CIA - Informations d\u2019arriv\u00e9e',
      preheader: 'Quelques informations encore avant votre arriv\u00e9e \u00e0 Antibes.',
      mjml: wrapMjmlLayout({
        preheader: 'Quelques informations encore avant votre arriv\u00e9e \u00e0 Antibes.',
        bodyMjml: adultBody('fr'),
        language: 'fr',
      }),
      variables: [...ADULT_VARS],
    },
    en: {
      subject: 'CIA - Arrival details',
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
