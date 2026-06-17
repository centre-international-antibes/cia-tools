<script setup lang="ts">
import type { CampaignKind, ParserWarning, ParseSummary } from '~/types/campaign.types';

interface Props {
  kind: CampaignKind;
}
const props = defineProps<Props>();
const emit = defineEmits<{ uploaded: [listId: string] }>();

const { t } = useI18n();
const c = useCampaigns();
const toast = useToast();

const name = ref('');
const file = ref<File | null>(null);
const uploading = ref(false);
const warnings = ref<ParserWarning[]>([]);
const summary = ref<ParseSummary | null>(null);

function severityClass(w: ParserWarning): string {
  if (w.severity === 'error') return 'text-red-700';
  if (w.severity === 'warning') return 'text-amber-700';
  return 'text-muted-foreground';
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  if (file.value && !name.value) {
    name.value = file.value.name.replace(/\.[^.]+$/, '');
  }
}

async function submit() {
  if (!file.value || !name.value) return;
  uploading.value = true;
  warnings.value = [];
  try {
    const result = await c.lists.upload(props.kind, name.value, file.value);
    warnings.value = result.warnings;
    summary.value = result.summary ?? null;
    toast.success(t('campaigns.upload.success', { count: result.list.row_count }));
    emit('uploaded', result.list.id);
    file.value = null;
    name.value = '';
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.upload.error'), { code: e.code, description: e.message });
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('campaigns.upload.title') }}</CardTitle>
      <CardDescription>{{ t('campaigns.upload.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="list-name">{{ t('campaigns.upload.name') }}</Label>
        <Input id="list-name" v-model="name" :placeholder="t('campaigns.upload.namePlaceholder')" />
      </div>
      <div class="space-y-2">
        <Label for="list-file">{{ t('campaigns.upload.file') }}</Label>
        <Input
          id="list-file"
          type="file"
          accept=".csv,.xlsx,.xls"
          @change="onFileChange"
        />
        <p class="text-xs text-muted-foreground">{{ t('campaigns.upload.fileHelp') }}</p>
      </div>
      <Button :disabled="!file || !name || uploading" @click="submit">
        <Icon v-if="uploading" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
        <Icon v-else name="lucide:upload" class="mr-2 size-4" />
        {{ t('campaigns.upload.submit') }}
      </Button>

      <div v-if="summary" class="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-6">
        <div><div class="font-medium">{{ summary.total }}</div><div class="text-muted-foreground">{{ t('campaigns.upload.summary.total') }}</div></div>
        <div><div class="font-medium text-green-700">{{ summary.accepted }}</div><div class="text-muted-foreground">{{ t('campaigns.upload.summary.accepted') }}</div></div>
        <div><div class="font-medium text-amber-700">{{ summary.suppressed }}</div><div class="text-muted-foreground">{{ t('campaigns.upload.summary.suppressed') }}</div></div>
        <div><div class="font-medium">{{ summary.skipped }}</div><div class="text-muted-foreground">{{ t('campaigns.upload.summary.skipped') }}</div></div>
        <div><div class="font-medium">{{ summary.duplicates }}</div><div class="text-muted-foreground">{{ t('campaigns.upload.summary.duplicates') }}</div></div>
        <div><div class="font-medium">{{ summary.invalidEmails }}</div><div class="text-muted-foreground">{{ t('campaigns.upload.summary.invalid') }}</div></div>
      </div>

      <div v-if="warnings.length" class="space-y-2">
        <p class="text-sm font-medium">{{ t('campaigns.upload.warningsTitle') }}</p>
        <ul class="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
          <li v-for="(w, i) in warnings" :key="i" class="font-mono">
            <span v-if="w.row" class="text-muted-foreground">L{{ w.row }} · </span>
            <span :class="severityClass(w)">{{ w.code }}</span> — {{ w.message }}
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
</template>
