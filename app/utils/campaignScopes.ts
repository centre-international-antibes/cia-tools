import type { CampaignKind } from '~/types/campaign.types';
import type { CampaignScope } from '~/types/profile.types';

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

export function scopeForKind(kind: CampaignKind): CampaignScope {
  return `campaign:${kind}` as CampaignScope;
}

export const CAMPAIGN_SCOPES: readonly CampaignScope[] = CAMPAIGN_KINDS.map(scopeForKind);
