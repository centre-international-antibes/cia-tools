<script setup lang="ts">
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const requestUrl = useRequestURL()

useHead({
  htmlAttrs: { lang: locale },
  link: [
    { rel: 'icon', type: "image/png", href: "/favicon.png" },
    { rel: 'canonical', href: requestUrl.href },
    ...locales.value.map(l => ({
      rel: 'alternate' as const,
      hreflang: l.code,
      href: requestUrl.origin + switchLocalePath(l.code),
    })),
  ],
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />

    <Transition :css="false">
      <main id="main-content" tabindex="-1" class="grow outline-none">
        <slot />
      </main>
    </Transition>

    <AppFooter />
  </div>
</template>

<style scoped></style>
