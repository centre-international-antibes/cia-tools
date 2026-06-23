<script setup lang="ts">
import type { CampaignKind, CampaignList } from '~/types/campaign.types';

interface Props {
  kind: CampaignKind;
}
const props = defineProps<Props>();
const emit = defineEmits<{ uploaded: [listId: string] }>();

const { t } = useI18n();
const c = useCampaigns();
const toast = useToast();

const previousLists = ref<CampaignList[]>([]);
const previousListId = ref<string | null>(null);
const lastUploadedListId = ref<string | null>(null);
const diff = ref<Awaited<ReturnType<typeof c.paymentReminder.diff>> | null>(null);
const refreshing = ref(false);
const computingDiff = ref(false);

async function loadPrevious() {
  previousLists.value = await c.lists.list(props.kind);
}
onMounted(loadPrevious);

function onUploaded(listId: string) {
  lastUploadedListId.value = listId;
  emit('uploaded', listId);
  if (previousListId.value) void computeDiff();
}

async function computeDiff() {
  if (!previousListId.value || !lastUploadedListId.value) return;
  computingDiff.value = true;
  try {
    diff.value = await c.paymentReminder.diff(previousListId.value, lastUploadedListId.value);
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.paymentReminder.diffError'), { code: e.code, description: e.message });
  } finally {
    computingDiff.value = false;
  }
}

async function refreshPayzen() {
  if (!lastUploadedListId.value) return;
  refreshing.value = true;
  try {
    const result = await c.paymentReminder.refreshLinks(lastUploadedListId.value);
    toast.success(t('campaigns.paymentReminder.refreshSuccess', result));
    // After refresh, paid cycles will be reflected in a re-computed diff.
    if (previousListId.value) void computeDiff();
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.paymentReminder.refreshError'), { code: e.code, description: e.message });
  } finally {
    refreshing.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('campaigns.paymentReminder.previousTitle') }}</CardTitle>
        <CardDescription>{{ t('campaigns.paymentReminder.previousDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2">
        <Label for="prev-list">{{ t('campaigns.paymentReminder.previousList') }}</Label>
        <Select v-model="previousListId">
          <SelectTrigger id="prev-list">
            <SelectValue :placeholder="t('campaigns.paymentReminder.previousPlaceholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="l in previousLists" :key="l.id" :value="l.id">
              {{ l.name }} — {{ new Date(l.created_at).toLocaleDateString() }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          {{ t('campaigns.paymentReminder.previousHelp') }}
        </p>
      </CardContent>
    </Card>

    <ContactListUploader :kind="kind" @uploaded="onUploaded" />

    <Card v-if="diff">
      <CardHeader class="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{{ t('campaigns.paymentReminder.diffTitle') }}</CardTitle>
          <CardDescription>{{ t('campaigns.paymentReminder.diffDescription') }}</CardDescription>
        </div>
        <Button variant="outline" size="sm" :disabled="refreshing" @click="refreshPayzen">
          <Icon
            :name="refreshing ? 'lucide:loader-2' : 'lucide:refresh-cw'"
            class="mr-2 size-4"
            :class="refreshing ? 'animate-spin' : ''"
          />
          {{ t('campaigns.paymentReminder.refreshLinks') }}
        </Button>
      </CardHeader>
      <CardContent class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div class="rounded-md border bg-green-50 p-3">
          <div class="text-2xl font-semibold text-green-700">{{ diff.closed.length }}</div>
          <div class="text-xs text-muted-foreground">{{ t('campaigns.paymentReminder.closed') }}</div>
        </div>
        <div class="rounded-md border bg-amber-50 p-3">
          <div class="text-2xl font-semibold text-amber-700">{{ diff.advanced.length }}</div>
          <div class="text-xs text-muted-foreground">{{ t('campaigns.paymentReminder.advanced') }}</div>
        </div>
        <div class="rounded-md border p-3">
          <div class="text-2xl font-semibold">{{ diff.unchanged.length }}</div>
          <div class="text-xs text-muted-foreground">{{ t('campaigns.paymentReminder.unchanged') }}</div>
        </div>
        <div class="rounded-md border bg-blue-50 p-3">
          <div class="text-2xl font-semibold text-blue-700">{{ diff.new.length }}</div>
          <div class="text-xs text-muted-foreground">{{ t('campaigns.paymentReminder.new') }}</div>
        </div>
        <div class="rounded-md border bg-red-50 p-3">
          <div class="text-2xl font-semibold text-red-700">{{ diff.missing.length }}</div>
          <div class="text-xs text-muted-foreground">{{ t('campaigns.paymentReminder.missing') }}</div>
        </div>
      </CardContent>
    </Card>

    <Alert v-if="computingDiff">
      <Icon name="lucide:loader-2" class="size-4 animate-spin" />
      <AlertTitle>{{ t('campaigns.paymentReminder.diffComputing') }}</AlertTitle>
    </Alert>
  </div>
</template>
