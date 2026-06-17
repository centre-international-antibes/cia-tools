<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const { t } = useI18n();
const { profile } = useUserProfile();
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('dashboard.welcome', { name: profile?.full_name || '' }) }}
      </h1>
      <p class="mt-1 text-muted-foreground">
        {{ t('dashboard.subtitle') }}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            {{ t('dashboard.role') }}
          </CardTitle>
          <Icon name="lucide:shield" class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Badge :variant="profile?.role === 'admin' ? 'default' : 'secondary'">
            {{ profile?.role }}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            {{ t('dashboard.scopes') }}
          </CardTitle>
          <Icon name="lucide:key" class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="scope in profile?.scopes"
              :key="scope"
              variant="outline"
            >
              {{ scope }}
            </Badge>
            <span
              v-if="!profile?.scopes?.length"
              class="text-sm text-muted-foreground"
            >
              {{ t('dashboard.noScopes') }}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            {{ t('dashboard.account') }}
          </CardTitle>
          <Icon name="lucide:user" class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">{{ profile?.email }}</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
