<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest', auth: false });

const { t } = useI18n();
const client = useSupabaseClient();
const localePath = useLocalePath();

const email = ref('');
const submitted = ref(false);
const loading = ref(false);

async function handleReset() {
  loading.value = true;

  const origin = import.meta.client ? window.location.origin : '';

  await client.auth.resetPasswordForEmail(email.value, {
    redirectTo: `${origin}/confirm`,
  });

  submitted.value = true;
  loading.value = false;
}
</script>

<template>
  <Card>
    <CardHeader class="space-y-1">
      <CardTitle class="text-2xl">{{ t('auth.forgotTitle') }}</CardTitle>
      <CardDescription>{{ t('auth.forgotDescription') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <template v-if="submitted">
        <Alert>
          <Icon name="lucide:mail" class="size-4" />
          <AlertDescription>{{ t('auth.forgotSuccess') }}</AlertDescription>
        </Alert>
        <div class="mt-4 text-center">
          <NuxtLink
            :to="localePath('/login')"
            class="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {{ t('auth.backToLogin') }}
          </NuxtLink>
        </div>
      </template>

      <form v-else class="space-y-4" @submit.prevent="handleReset">
        <div class="space-y-2">
          <Label for="email">{{ t('auth.email') }}</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
            required
            autocomplete="email"
          />
        </div>

        <Button type="submit" class="w-full" :disabled="loading">
          <Icon
            v-if="loading"
            name="lucide:loader-2"
            class="mr-2 size-4 animate-spin"
          />
          {{ t('auth.sendResetLink') }}
        </Button>

        <div class="text-center">
          <NuxtLink
            :to="localePath('/login')"
            class="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {{ t('auth.backToLogin') }}
          </NuxtLink>
        </div>
      </form>
    </CardContent>
  </Card>
</template>
