import type { CampaignKind } from '~/types/campaign.types';
import { ATS_TEMPLATES } from './ats';
import { PAYMENT_REMINDER_TEMPLATES } from './paymentReminder';
import { stubTemplate } from './stubs';
import type { DefaultTemplate } from './types';

/**
 * Default MJML templates per (kind, variant, language).
 *
 * - `ats` and `payment_reminder` ship with finalised copy from the operator docs.
 * - Other kinds get a minimal stub so the seeder always produces a complete
 *   `email_templates` matrix; operators clone + edit from the dashboard.
 *
 * Adding a new kind: drop a file under `./<kind>.ts` exporting a
 * `Record<Variant, Record<Lang, DefaultTemplate>>` and wire it in below.
 */
export const DEFAULT_TEMPLATES: Record<
  CampaignKind,
  Record<string, Record<'fr' | 'en', DefaultTemplate>>
> = {
  ats: ATS_TEMPLATES,
  payment_reminder: PAYMENT_REMINDER_TEMPLATES,
  ats_late_arrival: {
    default: {
      fr: stubTemplate('fr', 'CIA - Instructions arriv\u00e9e tardive', 'Instructions pour votre arriv\u00e9e tardive.'),
      en: stubTemplate('en', 'CIA - Late arrival instructions', 'Instructions for your late arrival.'),
    },
  },
  thanks_direct: {
    junior: {
      fr: stubTemplate('fr', 'CIA - Merci pour votre s\u00e9jour', 'Merci d\u2019avoir choisi le CIA.'),
      en: stubTemplate('en', 'CIA - Thank you for your stay', 'Thank you for choosing CIA.'),
    },
    adult: {
      fr: stubTemplate('fr', 'CIA - Merci pour votre s\u00e9jour', 'Merci d\u2019avoir choisi le CIA.'),
      en: stubTemplate('en', 'CIA - Thank you for your stay', 'Thank you for choosing CIA.'),
    },
  },
  test_fr: {
    default: {
      fr: stubTemplate('fr', 'CIA - Test de fran\u00e7ais en ligne', 'Votre test de niveau de fran\u00e7ais.'),
      en: stubTemplate('en', 'CIA - Online French test', 'Your French level test.'),
    },
  },
  housing_confirmation: {
    default: {
      fr: stubTemplate('fr', 'CIA - Confirmation d\u2019h\u00e9bergement', 'D\u00e9tails de votre h\u00e9bergement.'),
      en: stubTemplate('en', 'CIA - Housing confirmation', 'Your housing details.'),
    },
  },
  course_location: {
    default: {
      fr: stubTemplate('fr', 'CIA - Lieu et horaire de vos cours', 'O\u00f9 et quand auront lieu vos cours.'),
      en: stubTemplate('en', 'CIA - Course location and schedule', 'Where and when your courses take place.'),
    },
  },
  welcome_pack: {
    default: {
      fr: stubTemplate('fr', 'CIA - Bienvenue !', 'Bienvenue \u00e0 Antibes !'),
      en: stubTemplate('en', 'CIA - Welcome!', 'Welcome to Antibes!'),
    },
  },
};

