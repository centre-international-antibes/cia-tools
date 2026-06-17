<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { t } = useI18n();
const localePath = useLocalePath();
const { hasAnyCampaignScope } = useUserProfile();
const { fetchKinds, kinds, kindsLoading: loading } = useCampaigns();

await fetchKinds();
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-20">
    <Icon name="lucide:loader-2" class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="!hasAnyCampaignScope" class="flex flex-col items-center gap-4 py-20">
    <Icon name="lucide:lock" class="size-12 text-muted-foreground" />
    <h2 class="text-xl font-semibold">{{ t('campaigns.accessDenied') }}</h2>
    <p class="max-w-md text-center text-muted-foreground">
      {{ t('campaigns.accessDeniedDescription') }}
    </p>
    <Button variant="outline" as="a" :href="localePath('/dashboard')">
      {{ t('campaigns.backToDashboard') }}
    </Button>
  </div>

  <div v-else class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">{{ t('campaigns.title') }}</h1>
      <p class="mt-1 text-muted-foreground">{{ t('campaigns.subtitle') }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="k in kinds ?? []"
        :key="k.kind"
        :to="localePath(`/dashboard/campaigns/${k.kind}`)"
        class="block"
      >
        <Card class="h-full transition-colors hover:bg-accent/40">
          <CardHeader>
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon :name="k.icon" class="size-5 text-primary" />
              </div>
              <div>
                <CardTitle class="text-base">{{ t(k.labelKey) }}</CardTitle>
                <CardDescription class="text-xs">{{ t(k.descriptionKey) }}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>
