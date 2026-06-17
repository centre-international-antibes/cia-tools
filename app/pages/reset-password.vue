<script setup lang="ts">
definePageMeta({ layout: 'auth', auth: false });

const { t } = useI18n();
const client = useSupabaseClient();
const localePath = useLocalePath();

const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const loading = ref(false);
const success = ref(false);

async function handleReset() {
  error.value = '';

  if (password.value.length < 8) {
    error.value = t('auth.passwordTooShort');
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = t('auth.passwordMismatch');
    return;
  }

  loading.value = true;

  const { error: err } = await client.auth.updateUser({
    password: password.value,
  });

  if (err) {
    error.value = t('auth.resetError');
  } else {
    success.value = true;
    setTimeout(() => navigateTo(localePath('/dashboard')), 2000);
  }

  loading.value = false;
}
</script>

<template>
  <Card>
    <CardHeader class="space-y-1">
      <CardTitle class="text-2xl">{{ t('auth.resetTitle') }}</CardTitle>
      <CardDescription>{{ t('auth.resetDescription') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <template v-if="success">
        <Alert>
          <Icon name="lucide:check" class="size-4" />
          <AlertDescription>{{ t('auth.resetSuccess') }}</AlertDescription>
        </Alert>
      </template>

      <form v-else class="space-y-4" @submit.prevent="handleReset">
        <Alert v-if="error" variant="destructive">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <div class="space-y-2">
          <Label for="password">{{ t('auth.newPassword') }}</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            minlength="8"
          />
        </div>

        <div class="space-y-2">
          <Label for="confirm-password">{{ t('auth.confirmPassword') }}</Label>
          <Input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            required
            autocomplete="new-password"
            minlength="8"
          />
        </div>

        <Button type="submit" class="w-full" :disabled="loading">
          <Icon
            v-if="loading"
            name="lucide:loader-2"
            class="mr-2 size-4 animate-spin"
          />
          {{ t('auth.resetPassword') }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
