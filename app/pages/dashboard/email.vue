<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { t } = useI18n();
const localePath = useLocalePath();
const { hasScope, loading } = useUserProfile();

const hasAccess = computed(() => hasScope('campaign:ats'));
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-20">
    <Icon name="lucide:loader-2" class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="!hasAccess" class="flex flex-col items-center gap-4 py-20">
    <Icon name="lucide:lock" class="size-12 text-muted-foreground" />
    <h2 class="text-xl font-semibold">{{ t('email.accessDenied') }}</h2>
    <p class="max-w-md text-center text-muted-foreground">
      {{ t('email.accessDeniedDescription') }}
    </p>
    <Button variant="outline" as="a" :href="localePath('/dashboard')">
      {{ t('email.backToDashboard') }}
    </Button>
  </div>

  <div v-else class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">{{ t('email.title') }}</h1>
      <p class="mt-1 text-muted-foreground">{{ t('email.subtitle') }}</p>
    </div>

    <Card>
      <CardHeader>
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon name="lucide:mail" class="size-5 text-primary" />
          </div>
          <div>
            <CardTitle>{{ t('email.relanceAts') }}</CardTitle>
            <CardDescription>{{ t('email.relanceAtsDescription') }}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          class="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center"
        >
          <Icon name="lucide:send" class="size-10 text-muted-foreground/50" />
          <div>
            <p class="font-medium">{{ t('email.relanceAtsEmpty') }}</p>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('email.relanceAtsEmptyDescription') }}
            </p>
          </div>
          <Button disabled>
            <Icon name="lucide:plus" class="mr-2 size-4" />
            {{ t('email.newRelance') }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
