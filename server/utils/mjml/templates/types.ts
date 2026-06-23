import type { TemplateVariable } from '~/types/campaign.types';

/** A single default template entry seeded into the database. */
export interface DefaultTemplate {
  subject: string;
  preheader: string;
  mjml: string;
  variables: TemplateVariable[];
}
