<script setup lang="ts">
definePageMeta({ layout: 'auth', auth: false });

const { t } = useI18n();
const client = useSupabaseClient();
const localePath = useLocalePath();

const error = ref(false);

onMounted(() => {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(async event => {
    subscription.unsubscribe();

    if (event === 'PASSWORD_RECOVERY') {
      await navigateTo(localePath('/reset-password'), { replace: true });
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await navigateTo(localePath('/dashboard'), { replace: true });
    } else {
      error.value = true;
    }
  });

  setTimeout(() => {
    if (!error.value) {
      error.value = true;
    }
  }, 10_000);
});
</script>

<template>
  <div class="flex flex-col items-center gap-6 py-8">
    <template v-if="error">
      <Alert variant="destructive" class="max-w-sm">
        <AlertDescription>{{ t('auth.confirmError') }}</AlertDescription>
      </Alert>
      <NuxtLink
        :to="localePath('/login')"
        class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {{ t('auth.backToLogin') }}
      </NuxtLink>
    </template>
    <template v-else>
      <Icon
        name="lucide:loader-2"
        class="size-8 animate-spin text-muted-foreground"
      />
      <p class="text-sm text-muted-foreground">{{ t('auth.confirming') }}</p>
    </template>
  </div>
</template>
