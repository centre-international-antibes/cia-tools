import type { Database } from '~/types/database.types';

type CampaignKind = Database['public']['Enums']['campaign_kind'];

export const CAMPAIGN_KINDS: readonly CampaignKind[] = [
  'ats',
  'ats_late_arrival',
  'thanks_direct',
  'test_fr',
  'housing_confirmation',
  'course_location',
  'welcome_pack',
  'payment_reminder',
] as const;

export function scopeForKind(kind: CampaignKind): string {
  return `campaign:${kind}`;
}

export const CAMPAIGN_SCOPES: readonly string[] = CAMPAIGN_KINDS.map(scopeForKind);
