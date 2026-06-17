<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest', auth: false });

import { until } from '@vueuse/core';

const { t } = useI18n();
const client = useSupabaseClient();
const user = useSupabaseUser();
const localePath = useLocalePath();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;

  const { error: err } = await client.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  if (err) {
    error.value = t('auth.invalidCredentials');
    loading.value = false;
    return;
  }

  // Wait for the Supabase plugin's onAuthStateChange listener to populate
  // user.value (via getClaims) before navigating — otherwise the auth.global
  // middleware will see a null user and bounce back to /login.
  await until(user).toMatch((v) => !!v, { timeout: 5000, throwOnTimeout: false });

  await navigateTo(localePath('/dashboard'));
  loading.value = false;
}
</script>

<template>
  <Card>
    <CardHeader class="space-y-1">
      <CardTitle class="text-2xl">{{ t('auth.loginTitle') }}</CardTitle>
      <CardDescription>{{ t('auth.loginDescription') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="space-y-4" @submit.prevent="handleLogin">
        <Alert v-if="error" variant="destructive">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

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

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="password">{{ t('auth.password') }}</Label>
            <NuxtLink
              :to="localePath('/forgot-password')"
              class="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {{ t('auth.forgotPassword') }}
            </NuxtLink>
          </div>
          <Input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>

        <Button type="submit" class="w-full" :disabled="loading">
          <Icon
            v-if="loading"
            name="lucide:loader-2"
            class="mr-2 size-4 animate-spin"
          />
          {{ t('auth.login') }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
