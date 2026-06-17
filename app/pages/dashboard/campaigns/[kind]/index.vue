<script setup lang="ts">
import type { Campaign, CampaignKind } from '~/types/campaign.types';

definePageMeta({ layout: 'dashboard' });

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const c = useCampaigns();
const { fetchKinds, getKind } = useCampaigns();

const kind = route.params.kind as CampaignKind;
await fetchKinds();
const kindCfg = getKind(kind);

if (!kindCfg) {
  throw createError({ statusCode: 404, statusMessage: 'Unknown campaign kind.' });
}

const campaigns = ref<Campaign[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    campaigns.value = await c.campaigns.list(kind);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="flex size-12 items-center justify-center rounded-lg bg-primary/10">
          <Icon :name="kindCfg.icon" class="size-6 text-primary" />
        </div>
        <div>
          <h1 class="text-3xl font-bold tracking-tight">{{ t(kindCfg.labelKey) }}</h1>
          <p class="mt-1 text-muted-foreground">{{ t(kindCfg.descriptionKey) }}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" as-child>
          <NuxtLink :to="localePath(`/dashboard/campaigns/${kind}/templates`)">
            <Icon name="lucide:file-text" class="mr-2 size-4" />
            {{ t('campaigns.templates.manage') }}
          </NuxtLink>
        </Button>
        <Button as-child>
          <NuxtLink :to="localePath(`/dashboard/campaigns/${kind}/new`)">
            <Icon name="lucide:plus" class="mr-2 size-4" />
            {{ t('campaigns.newCampaign') }}
          </NuxtLink>
        </Button>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ t('campaigns.history.title') }}</CardTitle>
        <CardDescription>{{ t('campaigns.history.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="p-0">
        <div v-if="loading" class="flex items-center justify-center py-8">
          <Icon name="lucide:loader-2" class="size-5 animate-spin" />
        </div>
        <div
          v-else-if="!campaigns.length"
          class="px-6 py-8 text-center text-sm text-muted-foreground"
        >
          {{ t('campaigns.history.empty') }}
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('campaigns.history.name') }}</TableHead>
              <TableHead>{{ t('campaigns.history.status') }}</TableHead>
              <TableHead>{{ t('campaigns.history.recipients') }}</TableHead>
              <TableHead>{{ t('campaigns.history.sent') }}</TableHead>
              <TableHead>{{ t('campaigns.history.failed') }}</TableHead>
              <TableHead>{{ t('campaigns.history.createdAt') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="c in campaigns"
              :key="c.id"
              class="cursor-pointer"
              @click="$router.push(localePath(`/dashboard/campaigns/${kind}/${c.id}`))"
            >
              <TableCell class="font-medium">{{ c.name }}</TableCell>
              <TableCell><StatusBadges :status="c.status" /></TableCell>
              <TableCell>{{ c.total_recipients }}</TableCell>
              <TableCell>{{ c.sent_count }}</TableCell>
              <TableCell>{{ c.failed_count }}</TableCell>
              <TableCell>{{ formatDate(c.created_at) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
