import { wrapMjmlLayout } from '../layout';
import { heading, paragraph } from '../partials';
import { EMAIL_TOKENS } from '../tokens';
import type { DefaultTemplate } from './types';

const c = EMAIL_TOKENS.color;
const f = EMAIL_TOKENS.font;

const VARS = [
  { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  { key: 'last_name', type: 'string', required: false, sample: 'Dupont' },
  { key: 'is_course_only', type: 'boolean', required: false, sample: false, description: 'Hides program link and WhatsApp group when true.' },
  { key: 'program_url', type: 'url', required: false, sample: 'https://www.cia-france.com/programmes/junior-summer.pdf' },
  { key: 'whatsapp_url', type: 'url', required: false, sample: 'https://chat.whatsapp.com/EXAMPLE' },
  { key: 'whatsapp_label', type: 'string', required: false, sample: '50+ Group', description: 'Display label for the WhatsApp group (e.g. "Wine & Cooking", "50+").' },
  { key: 'hero_image_url', type: 'url', required: false, sample: '' },
  { key: 'secondary_image_url', type: 'url', required: false, sample: '' },
] as const;

function bullet(text: string): string {
  return `
    <mj-text
      font-family="${f.family}"
      font-size="${f.sizeBody}"
      line-height="${f.lineHeight}"
      color="${c.text}"
      padding="4px 24px"
    >\u2022 ${text}</mj-text>
  `;
}

function conditionalImage(varName: string): string {
  return `
    <mj-raw>{{#if ${varName}}}</mj-raw>
    <mj-section padding="12px 0 0">
      <mj-column>
        <mj-image src="{{${varName}}}" alt="" width="540px" padding="0 24px" />
      </mj-column>
    </mj-section>
    <mj-raw>{{/if}}</mj-raw>
  `;
}

function ctaButton(label: string, href: string): string {
  return `
    <mj-button
      href="${href}"
      background-color="${c.primary}"
      color="${c.surface}"
      font-size="${f.sizeBody}"
      font-weight="600"
      padding="12px 24px"
      inner-padding="12px 28px"
      border-radius="6px"
    >${label}</mj-button>
  `;
}

function welcomeBody(language: 'fr' | 'en'): string {
  const t = language === 'fr'
    ? {
      hello: 'Bonjour {{first_name}},',
      intro: 'Nous avons le plaisir de vous accueillir tr\u00e8s prochainement au sein de notre \u00e9cole.',
      scheduleTitle: 'Horaires et lieu de rendez-vous',
      meetingLine: 'Rendez-vous le lundi \u00e0 :',
      address: '38, Boulevard d\u2019Aguillon, 06600 Antibes, France \u2013 1er \u00e9tage.',
      time: 'Entre 8h30 et 8h45.',
      onTime: 'Merci d\u2019arriver \u00e0 l\u2019heure.',
      arrivalTitle: '\u00c0 votre arriv\u00e9e',
      arrivalIntro: 'Pr\u00e9sentez-vous \u00e0 la <strong>R\u00c9CEPTION</strong> au 1er \u00e9tage. Vous y recevrez :',
      a1: 'Votre carte d\u2019\u00e9tudiant',
      a2: 'Votre cahier d\u2019exercices',
      a3: 'Votre affectation de classe',
      programTitle: 'Votre programme',
      programLine: 'Retrouvez le d\u00e9tail de votre programme et des activit\u00e9s pr\u00e9vues :',
      programCta: 'Voir le programme',
      whatsappTitle: 'Rejoignez le groupe WhatsApp',
      whatsappLine: 'Restez en contact avec votre groupe <strong>{{whatsapp_label}}</strong> et recevez les infos pratiques au jour le jour :',
      whatsappCta: 'Rejoindre le groupe',
      infoTitle: 'Informations pratiques',
      emergency: '<strong>Contact d\u2019urgence :</strong> +33 4 92 90 71 72',
      wifi: '<strong>Wi-Fi gratuit</strong> (Le Port School) \u2014 R\u00e9seau : <strong>PORT</strong> \u00b7 Mot de passe : <strong>ciaport</strong>',
      activities: 'Visite gratuite d\u2019Antibes chaque <strong>lundi</strong> et d\u00e9gustation gastronomique chaque <strong>jeudi</strong> (25\u00a0\u20ac).',
      bringTitle: '\u00c0 pr\u00e9voir chaque jour',
      bring: 'V\u00eatements confortables, eau, cr\u00e8me solaire, maillot de bain et serviette (si besoin), argent de poche.',
      closing: 'Nous avons h\u00e2te de partager une belle semaine avec vous sur la C\u00f4te d\u2019Azur.',
      regards: 'Belle journ\u00e9e \u00e0 vous,',
    }
    : {
      hello: 'Dear {{first_name}},',
      intro: 'We are pleased to welcome you at our school very soon.',
      scheduleTitle: 'Schedule & meeting point',
      meetingLine: 'Meeting on Monday at:',
      address: '38, Boulevard d\u2019Aguillon, 06600 Antibes, France \u2013 1st Floor.',
      time: 'Between 8:30 and 8:45 a.m.',
      onTime: 'Please arrive on time.',
      arrivalTitle: 'On arrival',
      arrivalIntro: 'Please register at the <strong>RECEPTION</strong> on the 1st floor. You will receive:',
      a1: 'Your student card',
      a2: 'Your exercise book',
      a3: 'Your class placement',
      programTitle: 'Your programme',
      programLine: 'Find the full details of your programme and planned activities:',
      programCta: 'View the programme',
      whatsappTitle: 'Join the WhatsApp group',
      whatsappLine: 'Stay in touch with your <strong>{{whatsapp_label}}</strong> group and receive day-to-day practical info:',
      whatsappCta: 'Join the group',
      infoTitle: 'Practical information',
      emergency: '<strong>Emergency contact:</strong> +33 4 92 90 71 72',
      wifi: '<strong>Free Wi-Fi</strong> (Le Port School) \u2014 Network: <strong>PORT</strong> \u00b7 Password: <strong>ciaport</strong>',
      activities: 'Free visit of Antibes every <strong>Monday</strong> and food tasting every <strong>Thursday</strong> (25\u00a0\u20ac).',
      bringTitle: 'Bring daily',
      bring: 'Comfortable clothes, water, sunscreen, swimsuit & towel (if needed), pocket money.',
      closing: 'We look forward to a great week with you on the French Riviera.',
      regards: 'Have a lovely day,',
    };

  return `
    <mj-section padding="20px 0 0">
      <mj-column>
        ${paragraph(t.hello)}
        ${paragraph(t.intro)}
      </mj-column>
    </mj-section>
    ${conditionalImage('hero_image_url')}
    <mj-section>
      <mj-column>
        ${heading(t.scheduleTitle)}
        ${paragraph(t.meetingLine)}
        ${paragraph(`<strong>${t.address}</strong><br/>${t.time}<br/><em>${t.onTime}</em>`)}
        ${heading(t.arrivalTitle)}
        ${paragraph(t.arrivalIntro)}
        ${bullet(t.a1)}
        ${bullet(t.a2)}
        ${bullet(t.a3)}
      </mj-column>
    </mj-section>
    <mj-raw>{{#unless is_course_only}}{{#if program_url}}</mj-raw>
    <mj-section>
      <mj-column>
        ${heading(t.programTitle)}
        ${paragraph(t.programLine)}
        ${ctaButton(t.programCta, '{{program_url}}')}
      </mj-column>
    </mj-section>
    <mj-raw>{{/if}}{{#if whatsapp_url}}</mj-raw>
    <mj-section>
      <mj-column>
        ${heading(t.whatsappTitle)}
        ${paragraph(t.whatsappLine)}
        ${ctaButton(t.whatsappCta, '{{whatsapp_url}}')}
      </mj-column>
    </mj-section>
    <mj-raw>{{/if}}{{/unless}}</mj-raw>
    <mj-section>
      <mj-column>
        ${heading(t.infoTitle)}
        ${paragraph(t.emergency)}
        ${paragraph(t.wifi)}
        ${paragraph(t.activities)}
        ${heading(t.bringTitle)}
        ${paragraph(t.bring)}
      </mj-column>
    </mj-section>
    ${conditionalImage('secondary_image_url')}
    <mj-section>
      <mj-column>
        ${paragraph(t.closing)}
        ${paragraph(t.regards)}
      </mj-column>
    </mj-section>
  `;
}

export const WELCOME_PACK_TEMPLATES: Record<'default', Record<'fr' | 'en', DefaultTemplate>> = {
  default: {
    fr: {
      subject: 'Important : \u00e0 lire avant votre arriv\u00e9e',
      preheader: 'Pr\u00e9parez votre semaine sur la C\u00f4te d\u2019Azur \u2014 voici tout ce qu\u2019il faut savoir.',
      mjml: wrapMjmlLayout({
        preheader: 'Pr\u00e9parez votre semaine sur la C\u00f4te d\u2019Azur \u2014 voici tout ce qu\u2019il faut savoir.',
        bodyMjml: welcomeBody('fr'),
        language: 'fr',
      }),
      variables: [...VARS],
    },
    en: {
      subject: 'Important: read before your arrival',
      preheader: 'Get ready for your week on the French Riviera \u2014 here are all the key details you need.',
      mjml: wrapMjmlLayout({
        preheader: 'Get ready for your week on the French Riviera \u2014 here are all the key details you need.',
        bodyMjml: welcomeBody('en'),
        language: 'en',
      }),
      variables: [...VARS],
    },
  },
};
