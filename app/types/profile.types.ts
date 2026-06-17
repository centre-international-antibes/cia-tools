import type { Database } from './database.types';

export type AppRole = Database['public']['Enums']['app_role'];

export type Profile = Omit<Database['public']['Tables']['profiles']['Row'], 'scopes'> & {
  scopes: UserScope[];
};

/**
 * All scopes recognised by the app. Each campaign kind has its own scope so
 * staff can be authorised one feature at a time. Admins implicitly hold all.
 */
export type CampaignScope =
  | 'campaign:ats'
  | 'campaign:ats_late_arrival'
  | 'campaign:thanks_direct'
  | 'campaign:test_fr'
  | 'campaign:housing_confirmation'
  | 'campaign:course_location'
  | 'campaign:welcome_pack'
  | 'campaign:payment_reminder';

export type UserScope = CampaignScope;
