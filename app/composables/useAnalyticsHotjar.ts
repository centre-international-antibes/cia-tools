/**
 * Example: Hotjar Integration with Cookie Consent
 *
 * This composable demonstrates how to integrate Hotjar
 * with the cookie consent system using Nuxt Scripts.
 *
 * Hotjar is used for analytics/heatmaps, so it requires analytics consent.
 *
 * @example
 * ```vue
 * <script setup>
 * const { identifyUser } = useAnalyticsHotjar();
 *
 * // Identify the current user
 * const { user } = useUser();
 * watch(user, (newUser) => {
 *   if (newUser) {
 *     identifyUser(newUser.id, {
 *       email: newUser.email,
 *       plan: 'premium',
 *     });
 *   }
 * });
 * </script>
 * ```
 */
export function useAnalyticsHotjar(siteId: string) {
  const { triggers, hasConsent } = useCookieConsent();

  /**
   * Load Hotjar only when analytics consent is granted
   */
  const { onLoaded, status } = useScript(
    {
      key: 'hotjar',
      src: `https://t.contentsquare.net/uxa/${siteId}.js`,
    },
    {
      // Use the analytics consent trigger
      trigger: triggers.analytics,
    },
  );

  /**
   * Track whether Hotjar is ready
   */
  const isReady = computed(() => status.value === 'loaded');

  /**
   * Check if analytics tracking is allowed
   */
  const isAllowed = computed(() => hasConsent('analytics'));

  /**
   * Identify a user in Hotjar
   */
  const identifyUser = (userId: string, attributes?: Record<string, any>) => {
    if (isReady.value && isAllowed.value && window.hj) {
      window.hj('identify', userId, attributes);
    }
  };

  /**
   * Trigger a Hotjar event
   */
  const triggerEvent = (eventName: string) => {
    if (isReady.value && isAllowed.value && window.hj) {
      window.hj('event', eventName);
    }
  };

  /**
   * Tag a recording
   */
  const tagRecording = (tags: string[]) => {
    if (isReady.value && isAllowed.value && window.hj) {
      window.hj('tagRecording', tags);
    }
  };

  return {
    /**
     * Whether Hotjar has loaded successfully
     */
    isReady,

    /**
     * Whether analytics consent is granted
     */
    isAllowed,

    /**
     * Identify user in Hotjar
     */
    identifyUser,

    /**
     * Trigger Hotjar event
     */
    triggerEvent,

    /**
     * Tag current recording
     */
    tagRecording,

    /**
     * Callback when Hotjar is fully loaded
     */
    onLoaded,
  };
}

/**
 * Extend Window interface for Hotjar
 */
declare global {
  interface Window {
    hj?: (event: string, ...args: any[]) => void;
  }
}
