/**
 * Cookie Consent Type Definitions
 *
 * Defines types for the cookie consent management system integrated with Nuxt Scripts.
 */

/**
 * Available cookie categories for consent management
 */
export type CookieCategory = 'essential' | 'functional' | 'analytics' | 'marketing' | 'preferences';

/**
 * Consent state for a specific cookie category
 */
export interface CategoryConsent {
  /**
   * Unique identifier for the category
   */
  category: CookieCategory;

  /**
   * Whether the user has granted consent for this category
   */
  granted: boolean;

  /**
   * Timestamp when consent was granted/denied
   */
  timestamp: number;
}

/**
 * Complete user consent preferences
 */
export interface ConsentPreferences {
  /**
   * Consent status for each category
   */
  categories: Record<CookieCategory, boolean>;

  /**
   * When the consent was last updated
   */
  lastUpdated: number;

  /**
   * Version of the consent policy (for handling policy updates)
   */
  version: string;

  /**
   * Whether the user has explicitly made a choice (vs. implicit consent)
   */
  explicit: boolean;
}

/**
 * Cookie consent modal state
 */
export interface ConsentModalState {
  /**
   * Whether the modal is currently visible
   */
  isVisible: boolean;

  /**
   * Whether the banner is visible
   */
  isBannerVisible: boolean;

  /**
   * Current view in the modal (banner or detailed preferences)
   */
  view: 'banner' | 'detailed';
}

/**
 * Cookie category information for display in UI
 */
export interface CookieCategoryInfo {
  /**
   * Category identifier
   */
  id: CookieCategory;

  /**
   * Whether this category can be toggled (essential cookies cannot)
   */
  required: boolean;

  /**
   * i18n key for the category title
   */
  titleKey: string;

  /**
   * i18n key for the category description
   */
  descriptionKey: string;

  /**
   * Example cookies that fall under this category
   */
  examplesKey: string;

  /**
   * Icon to display for this category
   */
  icon?: string;
}

/**
 * Options for initializing the cookie consent system
 */
export interface CookieConsentOptions {
  /**
   * Policy version - increment when cookie policy changes
   * @default '1.0.0'
   */
  version?: string;

  /**
   * How long to wait before showing the banner (in ms)
   * @default 1000
   */
  showDelay?: number;

  /**
   * Whether to show the banner automatically on first visit
   * @default true
   */
  autoShow?: boolean;

  /**
   * Cookie expiration in days
   * @default 365
   */
  cookieExpiry?: number;

  /**
   * Cookie domain
   */
  cookieDomain?: string;

  /**
   * Callback when consent is granted
   */
  onConsentGranted?: (preferences: ConsentPreferences) => void;

  /**
   * Callback when consent is denied
   */
  onConsentDenied?: (preferences: ConsentPreferences) => void;

  /**
   * Callback when consent preferences are updated
   */
  onConsentUpdated?: (preferences: ConsentPreferences) => void;
}

/**
 * Return type for the useCookieConsent composable
 */
export interface UseCookieConsentReturn {
  /**
   * Current consent preferences
   */
  preferences: Ref<ConsentPreferences | null>;

  /**
   * Modal visibility state
   */
  modalState: Ref<ConsentModalState>;

  /**
   * Whether consent has been given for a specific category
   */
  hasConsent: (category: CookieCategory) => boolean;

  /**
   * Grant consent for specific categories
   */
  grantConsent: (categories: CookieCategory[]) => void;

  /**
   * Deny consent for specific categories
   */
  denyConsent: (categories: CookieCategory[]) => void;

  /**
   * Accept all non-essential cookies
   */
  acceptAll: () => void;

  /**
   * Reject all non-essential cookies
   */
  rejectAll: () => void;

  /**
   * Save current preferences
   */
  savePreferences: (categories: Record<CookieCategory, boolean>) => void;

  /**
   * Show the consent modal
   */
  showModal: (view?: 'banner' | 'detailed') => void;

  /**
   * Hide the consent modal
   */
  hideModal: () => void;

  /**
   * Reset all consent preferences
   */
  resetConsent: () => void;

  /**
   * Script triggers for Nuxt Scripts integration
   */
  triggers: {
    analytics: ReturnType<typeof useScriptTriggerConsent>;
    marketing: ReturnType<typeof useScriptTriggerConsent>;
    functional: ReturnType<typeof useScriptTriggerConsent>;
    preferences: ReturnType<typeof useScriptTriggerConsent>;
  };
}

/**
 * Storage key for consent preferences in localStorage
 */
export const CONSENT_STORAGE_KEY = 'nuxt_cookie_consent';

/**
 * Current consent policy version
 */
export const CONSENT_VERSION = '1.0.0';

/**
 * Default consent preferences
 */
export const DEFAULT_PREFERENCES: ConsentPreferences = {
  categories: {
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
    preferences: false,
  },
  lastUpdated: Date.now(),
  version: CONSENT_VERSION,
  explicit: false,
};
