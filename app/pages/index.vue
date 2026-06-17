<script setup lang="ts">
definePageMeta({ auth: false });

const { t } = useI18n();
const user = useSupabaseUser();
const localePath = useLocalePath();

if (user.value) {
  await navigateTo(localePath('/dashboard'), { replace: true });
}
</script>

<template>
  <div class="flex min-h-[80dvh] flex-col items-center justify-center gap-8 px-8">
    <Icon name="cia:logo" class="h-16 w-auto text-cia-blue" mode="svg" />
    <p class="max-w-reading text-center text-lg text-ink-muted">
      {{ t('landing.description') }}
    </p>
    <NuxtLink :to="localePath('/login')">
      <Button size="lg">{{ t('landing.signIn') }}</Button>
    </NuxtLink>
  </div>
</template>
