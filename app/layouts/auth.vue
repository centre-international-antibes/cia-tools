<script setup lang="ts">
const { locale } = useI18n();
const localePath = useLocalePath();

useHead({
  htmlAttrs: { lang: locale },
});
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-12">
    <NuxtLink
      :to="localePath('/')"
      class="mb-8 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
      aria-label="CIA Tools"
    >
      <Icon name="cia:logo-sigle" class="h-12 w-auto text-cia-blue" mode="svg" />
    </NuxtLink>

    <div class="w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
