import type { CampaignKind } from '~/types/campaign.types';
import { ATS_TEMPLATES } from './ats';
import { PAYMENT_REMINDER_TEMPLATES } from './paymentReminder';
import { THANKS_DIRECT_TEMPLATES } from './thanksDirect';
import { WELCOME_PACK_TEMPLATES } from './welcomePack';
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
  thanks_direct: THANKS_DIRECT_TEMPLATES,
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
  welcome_pack: WELCOME_PACK_TEMPLATES,
};

