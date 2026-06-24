import { wrapMjmlLayout } from '../layout';
import {
  bankBlock,
  heading,
  paragraph,
  paymentCtaButton,
  urgentBanner,
} from '../partials';
import { EMAIL_TOKENS } from '../tokens';
import type { DefaultTemplate } from './types';

const c = EMAIL_TOKENS.color;
const f = EMAIL_TOKENS.font;

const VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
  { key: 'full_name', type: 'string', required: false, sample: 'DUPONT Marie' },
  { key: 'amount', type: 'string', required: true, sample: '450,00\u00a0\u20ac' },
  { key: 'payment_url', type: 'url', required: true, sample: 'https://pay.example' },
  { key: 'proforma', type: 'string', required: false, sample: 'P26404-B1E09' },
  { key: 'cycle_stage', type: 'number', required: false, sample: 1 },
  { key: 'relance_count', type: 'number', required: false, sample: 1 },
  { key: 'due_date', type: 'string', required: false, sample: '' },
] as const;

const VARS_BRAND = [
  { key: 'brand_iban', type: 'string', required: false, sample: '' },
  { key: 'brand_bic', type: 'string', required: false, sample: '' },
  { key: 'brand_terms_url', type: 'url', required: false, sample: '' },
] as const;

function amountCard(label: string): string {
  return `
    <mj-section background-color="${c.surfaceMuted}" padding="16px 24px" border-radius="6px">
      <mj-column>
        <mj-text
          font-family="${f.family}"
          font-size="${f.sizeSmall}"
          color="${c.muted}"
          padding="0 0 4px"
        >${label}</mj-text>
        <mj-text
          font-family="${f.family}"
          font-size="28px"
          font-weight="700"
          color="${c.text}"
          padding="0"
        >{{amount}}</mj-text>
        <mj-text
          font-family="${f.family}"
          font-size="${f.sizeSmall}"
          color="${c.muted}"
          padding="6px 0 0"
        >{{#if proforma}}Proforma: <strong>{{proforma}}</strong>{{/if}}</mj-text>
      </mj-column>
    </mj-section>
  `;
}

function firstBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Bonjour {{first_name}},',
      title: 'Solde \u00e0 r\u00e9gler',
      intro: 'Nous esp\u00e9rons que vous allez bien. Vous trouverez ci-dessous le solde restant pour votre s\u00e9jour.',
      cardLabel: 'Montant d\u00fb',
      payLine: 'Vous pouvez r\u00e9gler en ligne via le lien s\u00e9curis\u00e9 ci-dessous, ou par virement bancaire en utilisant les coordonn\u00e9es plus bas.',
      cta: 'Payer en ligne',
      bankTitle: 'Coordonn\u00e9es bancaires',
      bankNote: 'Merci d\u2019indiquer le nom complet de la r\u00e9servation et le num\u00e9ro de proforma sur le virement.',
      closing: 'Nous restons \u00e0 votre disposition pour toute question.',
      welcome: 'Nous nous r\u00e9jouissons de vous accueillir bient\u00f4t.',
    }
    : {
      hello: 'Hello {{first_name}},',
      title: 'Balance due',
      intro: 'We hope you are doing well. Please find below the remaining balance for your stay.',
      cardLabel: 'Amount due',
      payLine: 'You can pay online via the secure link below, or by bank transfer using the details further down.',
      cta: 'Pay online',
      bankTitle: 'Bank details',
      bankNote: 'Please mention the full reservation name and the proforma number on the transfer.',
      closing: 'Please feel free to contact us if you have any questions.',
      welcome: 'We are looking forward to welcoming you.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${heading(t.title)}
        ${paragraph(t.intro)}
      </mj-column>
    </mj-section>
    ${amountCard(t.cardLabel)}
    <mj-section>
      <mj-column>
        ${paragraph(t.payLine)}
        ${paymentCtaButton(t.cta)}
        ${bankBlock(t.bankTitle)}
        ${paragraph(`<em>${t.bankNote}</em>`)}
        ${paragraph(t.closing)}
        ${paragraph(t.welcome)}
      </mj-column>
    </mj-section>
  `;
}

function secondBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Bonjour {{first_name}},',
      title: 'URGENT - Solde \u00e0 r\u00e9gler',
      banner: 'Action requise sous 72 heures',
      intro: 'Suite \u00e0 notre pr\u00e9c\u00e9dent message, nous nous permettons de vous rappeler que le d\u00e9lai de paiement du solde via le lien s\u00e9curis\u00e9 expirera bient\u00f4t.',
      already: 'Si vous avez d\u00e9j\u00e0 effectu\u00e9 le paiement par virement, merci de nous transmettre la confirmation \u00e0 votre meilleure convenance.',
      warning: 'Sans paiement du solde dans les 72 prochaines heures, nous serons malheureusement contraints de ne pas pouvoir maintenir votre r\u00e9servation.',
      cardLabel: 'Montant d\u00fb',
      cta: 'R\u00e9gler maintenant',
      bankTitle: 'Coordonn\u00e9es bancaires',
      bankNote: 'Merci d\u2019indiquer le nom complet de la r\u00e9servation et le num\u00e9ro de proforma sur le virement.',
      closing: 'Nous restons \u00e0 votre disposition. Merci d\u2019avance pour votre retour rapide.',
    }
    : {
      hello: 'Hello {{first_name}},',
      title: 'URGENT - Balance due',
      banner: 'Action required within 72 hours',
      intro: 'Following up on our previous email, we would like to remind you that the deadline for completing the balance payment via our secure link will expire soon.',
      already: 'If you have already made the payment by bank transfer, could you kindly forward us a copy of the transfer confirmation at your earliest convenience?',
      warning: 'Please note that without the balance payment within 72 HOURS, we regret to inform you that we will be unable to maintain your reservation.',
      cardLabel: 'Amount due',
      cta: 'Pay now',
      bankTitle: 'Bank details',
      bankNote: 'Please mention the full reservation name and the proforma number on the transfer.',
      closing: 'Looking forward to your swift reply. We remain at your disposal.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${heading(t.title)}
      </mj-column>
    </mj-section>
    ${urgentBanner(t.banner)}
    <mj-section>
      <mj-column>
        ${paragraph(t.intro)}
        ${paragraph(t.already)}
        ${paragraph(`<strong>${t.warning}</strong>`)}
      </mj-column>
    </mj-section>
    ${amountCard(t.cardLabel)}
    <mj-section>
      <mj-column>
        ${paymentCtaButton(t.cta)}
        ${bankBlock(t.bankTitle)}
        ${paragraph(`<em>${t.bankNote}</em>`)}
        ${paragraph(t.closing)}
      </mj-column>
    </mj-section>
  `;
}

function thirdBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Bonjour {{first_name}},',
      title: 'URGENT - Derni\u00e8re relance avant annulation',
      banner: 'Derni\u00e8re relance \u2013 annulation imminente',
      intro: 'Faisant suite \u00e0 nos pr\u00e9c\u00e9dents messages, sans nouvelles de votre part avant mercredi 9h00 (CET), nous serons contraints d\u2019annuler automatiquement votre r\u00e9servation, avec p\u00e9nalit\u00e9s.',
      penalties: 'P\u00e9nalit\u00e9s : entre 50% et 75% du montant total pour les r\u00e9servations avec h\u00e9bergement, et entre 30% et 40% pour les r\u00e9servations sans h\u00e9bergement, conform\u00e9ment \u00e0 nos conditions g\u00e9n\u00e9rales.',
      termsLink: 'Consulter les conditions g\u00e9n\u00e9rales',
      cardLabel: 'Montant d\u00fb',
      payLine: 'Merci d\u2019utiliser le lien suivant pour proc\u00e9der au paiement imm\u00e9diat :',
      cta: 'Payer imm\u00e9diatement',
      closing: 'Dans l\u2019attente de votre retour, nous restons \u00e0 votre disposition.',
    }
    : {
      hello: 'Hello {{first_name}},',
      title: 'URGENT - Final reminder before cancellation',
      banner: 'Final notice \u2013 cancellation imminent',
      intro: 'Further to our previous emails, if we do not hear from you by Wednesday 9:00am (CET), we regret to inform you that your reservation will be automatically cancelled by our system with penalties.',
      penalties: 'Penalties: between 50% and 75% of the total amount for reservations with accommodation, and between 30% and 40% for reservations without accommodation, as per our general conditions.',
      termsLink: 'See terms and conditions',
      cardLabel: 'Amount due',
      payLine: 'Please use the following link to proceed to the immediate payment:',
      cta: 'Pay immediately',
      closing: 'Looking forward to your return, please feel free to contact us if you have any questions.',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${heading(t.title)}
      </mj-column>
    </mj-section>
    ${urgentBanner(t.banner)}
    <mj-section>
      <mj-column>
        ${paragraph(`<strong>${t.intro}</strong>`)}
        ${paragraph(`<em>${t.penalties}</em> <a href="{{brand_terms_url}}" style="color: ${c.primary};">${t.termsLink}</a>`)}
      </mj-column>
    </mj-section>
    ${amountCard(t.cardLabel)}
    <mj-section>
      <mj-column>
        ${paragraph(t.payLine)}
        ${paymentCtaButton(t.cta)}
        ${paragraph(t.closing)}
      </mj-column>
    </mj-section>
  `;
}

export const PAYMENT_REMINDER_TEMPLATES: Record<
  'first' | 'second' | 'third',
  Record<'fr' | 'en', DefaultTemplate>
> = {
  first: {
    fr: {
      subject: 'CIA - Solde \u00e0 r\u00e9gler - {{full_name}}',
      preheader: 'Solde restant pour votre s\u00e9jour au CIA.',
      mjml: wrapMjmlLayout({
        preheader: 'Solde restant pour votre s\u00e9jour au CIA.',
        bodyMjml: firstBody('fr'),
        language: 'fr',
      }),
      variables: [...VARS, ...VARS_BRAND],
    },
    en: {
      subject: 'CIA - Balance due - {{full_name}}',
      preheader: 'Remaining balance for your CIA stay.',
      mjml: wrapMjmlLayout({
        preheader: 'Remaining balance for your CIA stay.',
        bodyMjml: firstBody('en'),
        language: 'en',
      }),
      variables: [...VARS, ...VARS_BRAND],
    },
  },
  second: {
    fr: {
      subject: 'URGENT - CIA - Solde \u00e0 r\u00e9gler - {{full_name}}',
      preheader: 'Rappel : votre paiement doit \u00eatre finalis\u00e9 sous 72 heures.',
      mjml: wrapMjmlLayout({
        preheader: 'Rappel : votre paiement doit \u00eatre finalis\u00e9 sous 72 heures.',
        bodyMjml: secondBody('fr'),
        language: 'fr',
      }),
      variables: [...VARS, ...VARS_BRAND],
    },
    en: {
      subject: 'URGENT - CIA - Balance due - {{full_name}}',
      preheader: 'Reminder: your payment must be completed within 72 hours.',
      mjml: wrapMjmlLayout({
        preheader: 'Reminder: your payment must be completed within 72 hours.',
        bodyMjml: secondBody('en'),
        language: 'en',
      }),
      variables: [...VARS, ...VARS_BRAND],
    },
  },
  third: {
    fr: {
      subject: 'URGENT - CIA - Derni\u00e8re relance avant annulation - {{full_name}}',
      preheader: 'Derni\u00e8re relance avant annulation automatique de votre r\u00e9servation.',
      mjml: wrapMjmlLayout({
        preheader: 'Derni\u00e8re relance avant annulation automatique de votre r\u00e9servation.',
        bodyMjml: thirdBody('fr'),
        language: 'fr',
      }),
      variables: [...VARS, ...VARS_BRAND],
    },
    en: {
      subject: 'URGENT - CIA - Final reminder before cancellation - {{full_name}}',
      preheader: 'Final reminder before automatic cancellation of your reservation.',
      mjml: wrapMjmlLayout({
        preheader: 'Final reminder before automatic cancellation of your reservation.',
        bodyMjml: thirdBody('en'),
        language: 'en',
      }),
      variables: [...VARS, ...VARS_BRAND],
    },
  },
};
