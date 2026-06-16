import type {
  CookieCategory,
  ConsentPreferences,
  ConsentModalState,
  UseCookieConsentReturn,
  CookieConsentOptions,
} from '~/types/cookie-consent';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION, DEFAULT_PREFERENCES } from '~/types/cookie-consent';

/**
 * Cookie Consent Management Composable
 *
 * Provides comprehensive cookie consent management with Nuxt Scripts integration.
 * This composable manages user consent preferences, persists them to localStorage,
 * and provides script triggers for conditional loading based on user consent.
 *
 * @example
 * ```vue
 * <script setup>
 * const { hasConsent, acceptAll, rejectAll, showModal } = useCookieConsent();
 *
 * // Check if analytics consent is granted
 * if (hasConsent('analytics')) {
 *   // Load analytics scripts
 * }
 * </script>
 * ```
 */
export function useCookieConsent(options: CookieConsentOptions = {}): UseCookieConsentReturn {
  const {
    version = CONSENT_VERSION,
    showDelay = 1000,
    autoShow = true,
    cookieExpiry = 365,
    onConsentGranted,
    onConsentDenied,
    onConsentUpdated,
  } = options;

  // State management
  const preferences = useState<ConsentPreferences | null>('cookie-consent-preferences', () => null);

  const modalState = useState<ConsentModalState>('cookie-consent-modal', () => ({
    isVisible: false,
    isBannerVisible: false,
    view: 'banner',
  }));

  // Create consent triggers for Nuxt Scripts
  const analyticsConsent = ref(false);
  const marketingConsent = ref(false);
  const functionalConsent = ref(false);
  const preferencesConsent = ref(false);

  // Nuxt Scripts triggers may rely on client-only Nuxt internals.
  // During SSR/prerender we provide no-op triggers to avoid crashes.
  const createNoopConsentTrigger = (): any => {
    const state = ref('noop');
    const noop = () => { };

    // Use Proxy to intercept all property accesses and return safe values
    return new Proxy(noop, {
      get(_target, prop) {
        if (prop === 'state') return state;
        if (prop === 'accept' || prop === 'reject' || prop === 'reset') return noop;
        // Return noop for any other property access
        return noop;
      },
      apply() {
        return undefined;
      },
    });
  };

  const triggers = import.meta.server
    ? {
      analytics: createNoopConsentTrigger(),
      marketing: createNoopConsentTrigger(),
      functional: createNoopConsentTrigger(),
      preferences: createNoopConsentTrigger(),
    }
    : {
      analytics: useScriptTriggerConsent({ consent: analyticsConsent }),
      marketing: useScriptTriggerConsent({ consent: marketingConsent }),
      functional: useScriptTriggerConsent({ consent: functionalConsent }),
      preferences: useScriptTriggerConsent({ consent: preferencesConsent }),
    };

  /**
   * Load consent preferences from localStorage
   */
  const loadPreferences = (): ConsentPreferences | null => {
    if (import.meta.server) return null;

    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored) as ConsentPreferences;

      // Check if the stored version matches current version
      if (parsed.version !== version) {
        console.info('[Cookie Consent] Version mismatch, resetting preferences');
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('[Cookie Consent] Failed to load preferences:', error);
      return null;
    }
  };

  /**
   * Save consent preferences to localStorage
   */
  const savePreferencesToStorage = (prefs: ConsentPreferences): void => {
    if (import.meta.server) return;

    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));

      // Also set a cookie for server-side detection if needed
      const expires = new Date();
      expires.setDate(expires.getDate() + cookieExpiry);

      document.cookie = `${CONSENT_STORAGE_KEY}=${JSON.stringify(prefs.categories)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {
      console.error('[Cookie Consent] Failed to save preferences:', error);
    }
  };

  /**
   * Update consent triggers based on current preferences
   */
  const updateConsentTriggers = (prefs: ConsentPreferences): void => {
    analyticsConsent.value = prefs.categories.analytics;
    marketingConsent.value = prefs.categories.marketing;
    functionalConsent.value = prefs.categories.functional;
    preferencesConsent.value = prefs.categories.preferences;
  };

  /**
   * Check if consent has been granted for a specific category
   */
  const hasConsent = (category: CookieCategory): boolean => {
    if (!preferences.value) return category === 'essential';
    return preferences.value.categories[category] ?? false;
  };

  /**
   * Grant consent for specific categories
   */
  const grantConsent = (categories: CookieCategory[]): void => {
    const currentPrefs = preferences.value || { ...DEFAULT_PREFERENCES };

    categories.forEach(category => {
      currentPrefs.categories[category] = true;
    });

    currentPrefs.lastUpdated = Date.now();
    currentPrefs.version = version;
    currentPrefs.explicit = true;

    preferences.value = currentPrefs;
    savePreferencesToStorage(currentPrefs);
    updateConsentTriggers(currentPrefs);

    onConsentGranted?.(currentPrefs);
    onConsentUpdated?.(currentPrefs);
  };

  /**
   * Deny consent for specific categories
   */
  const denyConsent = (categories: CookieCategory[]): void => {
    const currentPrefs = preferences.value || { ...DEFAULT_PREFERENCES };

    categories.forEach(category => {
      if (category !== 'essential') {
        currentPrefs.categories[category] = false;
      }
    });

    currentPrefs.lastUpdated = Date.now();
    currentPrefs.version = version;
    currentPrefs.explicit = true;

    preferences.value = currentPrefs;
    savePreferencesToStorage(currentPrefs);
    updateConsentTriggers(currentPrefs);

    onConsentDenied?.(currentPrefs);
    onConsentUpdated?.(currentPrefs);
  };

  /**
   * Accept all non-essential cookies
   */
  const acceptAll = (): void => {
    const allCategories: CookieCategory[] = ['functional', 'analytics', 'marketing', 'preferences'];
    grantConsent(allCategories);
    hideModal();
  };

  /**
   * Reject all non-essential cookies
   */
  const rejectAll = (): void => {
    const nonEssentialCategories: CookieCategory[] = [
      'functional',
      'analytics',
      'marketing',
      'preferences',
    ];
    denyConsent(nonEssentialCategories);
    hideModal();
  };

  /**
   * Save custom preferences
   */
  const savePreferences = (categories: Record<CookieCategory, boolean>): void => {
    const newPrefs: ConsentPreferences = {
      categories,
      lastUpdated: Date.now(),
      version,
      explicit: true,
    };

    preferences.value = newPrefs;
    savePreferencesToStorage(newPrefs);
    updateConsentTriggers(newPrefs);

    onConsentUpdated?.(newPrefs);
    hideModal();
  };

  /**
   * Show the consent modal
   */
  const showModal = (view: 'banner' | 'detailed' = 'banner'): void => {
    modalState.value = {
      isVisible: true,
      isBannerVisible: view === 'banner',
      view,
    };
  };

  /**
   * Hide the consent modal
   */
  const hideModal = (): void => {
    modalState.value = {
      isVisible: false,
      isBannerVisible: false,
      view: 'banner',
    };
  };

  /**
   * Reset all consent preferences
   */
  const resetConsent = (): void => {
    if (import.meta.server) return;

    localStorage.removeItem(CONSENT_STORAGE_KEY);

    // Remove the consent cookie
    document.cookie = `${CONSENT_STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

    preferences.value = null;
    analyticsConsent.value = false;
    marketingConsent.value = false;
    functionalConsent.value = false;
    preferencesConsent.value = false;

    if (autoShow) {
      setTimeout(() => showModal('banner'), showDelay);
    }
  };

  // Initialize immediately on client side to prevent race conditions with script loading
  if (import.meta.client) {
    // Load preferences synchronously before any scripts can initialize
    const stored = loadPreferences();

    if (stored) {
      preferences.value = stored;
      updateConsentTriggers(stored);
    }

    // Show banner after delay if no preferences are stored
    if (!stored && autoShow) {
      onMounted(() => {
        setTimeout(() => {
          showModal('banner');
        }, showDelay);
      });
    }
  }

  return {
    preferences: readonly(preferences) as Ref<ConsentPreferences | null>,
    modalState: readonly(modalState) as Ref<ConsentModalState>,
    hasConsent,
    grantConsent,
    denyConsent,
    acceptAll,
    rejectAll,
    savePreferences,
    showModal,
    hideModal,
    resetConsent,
    triggers,
  };
}
