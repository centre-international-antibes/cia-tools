/**
 * Example: Google Analytics Integration with Cookie Consent
 *
 * This composable demonstrates how to integrate Google Analytics 4
 * with the cookie consent system using Nuxt Scripts.
 *
 * @example
 * ```vue
 * <script setup>
 * const { ga, isReady } = useAnalyticsGA4();
 *
 * // Track custom event when GA is loaded
 * onMounted(() => {
 *   if (isReady) {
 *     ga.event('page_view', { page_path: window.location.pathname });
 *   }
 * });
 * </script>
 * ```
 */
export function useAnalyticsGA4(measurementId: string) {
  const { triggers, hasConsent } = useCookieConsent();

  /**
   * Load Google Analytics only when analytics consent is granted
   */
  const { proxy, onLoaded, status } = useScriptGoogleAnalytics({
    id: measurementId,
    scriptOptions: {
      // Use the analytics consent trigger
      trigger: triggers.analytics,
    },
  });

  /**
   * Track whether GA is ready
   */
  const isReady = computed(() => status.value === 'loaded');

  /**
   * Check if analytics tracking is allowed
   */
  const isAllowed = computed(() => hasConsent('analytics'));

  return {
    /**
     * Google Analytics proxy object
     * Safe to call even before script loads
     */
    ga: proxy,

    /**
     * Whether GA has loaded successfully
     */
    isReady,

    /**
     * Whether analytics consent is granted
     */
    isAllowed,

    /**
     * Callback when GA is fully loaded
     */
    onLoaded,
  };
}
