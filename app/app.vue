<script setup lang="ts">
// Initialize cookie consent system (loads preferences synchronously on client)
const { preferences } = useCookieConsent();

// Initialize tracking scripts reactively based on consent
if (import.meta.client) {
  // Watch for consent changes and initialize scripts when granted
  watchEffect(() => {
    if (preferences.value) {
      // Optional: Initialize other tracking services if configured
      // Uncomment and configure these in your .env file:

      if (preferences.value.categories.analytics) {
        const config = useRuntimeConfig();
        const ga4Id = config.public.ga4Id;
        if (ga4Id) {
          useAnalyticsGA4(ga4Id);
        }
      }

      // if (preferences.value.categories.marketing) {
      //   const config = useRuntimeConfig();
      //   const metaPixelId = config.public.metaPixelId;
      //   if (metaPixelId) {
      //     useMarketingMetaPixel(metaPixelId);
      //   }
      // }
    }
  });
}
</script>
<template>
  <div>
    <TooltipProvider :delay-duration="300">
      <NuxtLoadingIndicator color="#8FE1D8" />
      <NuxtLayout>
        <NuxtPage />
        <LazyCookieConsentBanner />
        <LazyCookieConsentModal />
        <LazyCookieSettingsButton position="bottom-right" />
      </NuxtLayout>
    </TooltipProvider>
  </div>
</template>
