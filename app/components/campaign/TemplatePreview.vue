<script setup lang="ts">
interface Props {
  templateId: string;
  versionId?: string | null;
  sampleParams?: Record<string, unknown>;
}
const props = defineProps<Props>();

const { t } = useI18n();
const c = useCampaigns();

const subject = ref('');
const html = ref('');
const missing = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    const result = await c.templates.preview(props.templateId, {
      versionId: props.versionId ?? undefined,
      params: props.sampleParams ?? {},
    });
    subject.value = result.subject;
    html.value = result.html;
    missing.value = result.missingVariables;
  } catch (err) {
    error.value = extractApiError(err).message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.templateId, props.versionId, props.sampleParams],
  () => refresh(),
  { immediate: true, deep: true },
);
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs text-muted-foreground">{{ t('campaigns.preview.subject') }}</p>
        <p class="font-medium">{{ subject || '—' }}</p>
      </div>
      <Button size="sm" variant="ghost" :disabled="loading" @click="refresh">
        <Icon name="lucide:refresh-cw" class="mr-2 size-4" :class="loading ? 'animate-spin' : ''" />
        {{ t('common.refresh') }}
      </Button>
    </div>
    <Alert v-if="missing.length" variant="destructive">
      <Icon name="lucide:triangle-alert" class="size-4" />
      <AlertTitle>{{ t('campaigns.preview.missingTitle') }}</AlertTitle>
      <AlertDescription>{{ missing.join(', ') }}</AlertDescription>
    </Alert>
    <Alert v-if="error" variant="destructive">
      <AlertTitle>{{ t('campaigns.preview.errorTitle') }}</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>
    <div class="overflow-hidden rounded-md border">
      <iframe
        :srcdoc="html"
        class="block h-[640px] w-full bg-white"
        sandbox="allow-same-origin"
        :title="t('campaigns.preview.title')"
      />
    </div>
  </div>
</template>
