<script setup lang="ts">
import type { Campaign, CampaignKind, CampaignRecipient } from '~/types/campaign.types';

definePageMeta({ layout: 'dashboard' });

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const c = useCampaigns();
const toast = useToast();

const kind = route.params.kind as CampaignKind;
const id = route.params.id as string;

const campaign = ref<Campaign | null>(null);
const recipients = ref<CampaignRecipient[]>([]);
const loading = ref(true);
const aborting = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function load() {
  campaign.value = await c.campaigns.get(id);
  const page = await c.campaigns.recipients(id, { limit: 500 });
  recipients.value = page.rows;
  loading.value = false;
}

onMounted(() => {
  load();
  pollTimer = setInterval(async () => {
    if (
      campaign.value
      && ['queued', 'sending', 'partially_failed'].includes(campaign.value.status)
    ) {
      await load();
    }
  }, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

async function abort() {
  if (!campaign.value) return;
  aborting.value = true;
  try {
    await c.campaigns.abort(id);
    await load();
    toast.success(t('campaigns.abort.success'));
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.abort.error'), { code: e.code, description: e.message });
  } finally {
    aborting.value = false;
  }
}

const canAbort = computed(() =>
  ['queued', 'sending', 'partially_failed'].includes(campaign.value?.status ?? ''),
);
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex justify-center py-20">
      <Icon name="lucide:loader-2" class="size-6 animate-spin" />
    </div>
    <template v-else-if="campaign">
      <div class="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink :to="localePath(`/dashboard/campaigns/${kind}`)">
              <Icon name="lucide:chevron-left" class="mr-2 size-4" />
              {{ t('campaigns.backToList') }}
            </NuxtLink>
          </Button>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ campaign.name }}</h1>
          <div class="mt-2 flex items-center gap-2">
            <StatusBadges :status="campaign.status" />
            <span class="text-sm text-muted-foreground">
              {{ campaign.sent_count }} / {{ campaign.total_recipients }} {{ t('campaigns.detail.sent') }}
              · {{ campaign.failed_count }} {{ t('campaigns.detail.failed') }}
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            v-if="canAbort"
            variant="destructive"
            :disabled="aborting"
            @click="abort"
          >
            <Icon v-if="aborting" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="lucide:square" class="mr-2 size-4" />
            {{ t('campaigns.abort.button') }}
          </Button>
        </div>
      </div>

      <CampaignRecipientsTable :recipients="recipients" />
    </template>
  </div>
</template>
