<script setup lang="ts">
import type { TemplateVariable } from '~/types/campaign.types';

interface Props {
  templateId: string;
  initialVersion?: {
    subject: string;
    mjml: string;
    variables_schema: TemplateVariable[];
  };
}
const props = defineProps<Props>();
const emit = defineEmits<{ saved: [versionId: string] }>();

const { t } = useI18n();
const c = useCampaigns();
const toast = useToast();

const subject = ref(props.initialVersion?.subject ?? '');
const mjml = ref(
  props.initialVersion?.mjml ?? '<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{first_name}}</mj-text></mj-column></mj-section></mj-body></mjml>',
);
const variables = ref<TemplateVariable[]>(
  props.initialVersion?.variables_schema ?? [
    { key: 'first_name', type: 'string', required: false, sample: 'Marie' },
  ],
);
const saving = ref(false);
const previewHtml = ref('');
const previewError = ref<string | null>(null);
const previewLoading = ref(false);
const lastSavedVersionId = ref<string | null>(null);
const previewVersionId = ref<string | null>(null);

const sampleParams = computed<Record<string, unknown>>(() => {
  const params: Record<string, unknown> = {};
  for (const v of variables.value) {
    if (v.sample !== undefined) params[v.key] = v.sample;
  }
  return params;
});

async function previewLocally() {
  // Quick path: save a draft version (non-activated) and request preview from server.
  // Avoids shipping mjml/handlebars to the browser.
  previewLoading.value = true;
  previewError.value = null;
  try {
    const version = await c.templates.createVersion(props.templateId, {
      subject: subject.value,
      mjml: mjml.value,
      variables_schema: variables.value,
      activate: false,
    });
    previewVersionId.value = version.id;
    const result = await c.templates.preview(props.templateId, {
      versionId: version.id,
      params: sampleParams.value,
    });
    previewHtml.value = result.html;
  } catch (err) {
    const e = extractApiError(err);
    previewError.value = e.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errs = ((e.data as any)?.errors ?? []) as string[];
    if (errs.length) previewError.value += '\n' + errs.join('\n');
  } finally {
    previewLoading.value = false;
  }
}

async function saveAndActivate() {
  saving.value = true;
  try {
    const version = await c.templates.createVersion(props.templateId, {
      subject: subject.value,
      mjml: mjml.value,
      variables_schema: variables.value,
      activate: true,
    });
    lastSavedVersionId.value = version.id;
    previewVersionId.value = version.id;
    toast.success(t('campaigns.templates.savedActive'));
    emit('saved', version.id);
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.templates.saveError'), { code: e.code, description: e.message });
  } finally {
    saving.value = false;
  }
}

function addVariable() {
  variables.value.push({ key: '', type: 'string', required: false, sample: '' });
}

function removeVariable(index: number) {
  variables.value.splice(index, 1);
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('campaigns.templates.editor.title') }}</CardTitle>
        <CardDescription>{{ t('campaigns.templates.editor.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="tpl-subject">{{ t('campaigns.templates.editor.subject') }}</Label>
          <Input id="tpl-subject" v-model="subject" />
        </div>
        <div class="space-y-2">
          <Label for="tpl-mjml">{{ t('campaigns.templates.editor.mjml') }}</Label>
          <textarea
            id="tpl-mjml"
            v-model="mjml"
            spellcheck="false"
            class="h-96 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>{{ t('campaigns.templates.editor.variables') }}</Label>
            <Button variant="ghost" size="sm" @click="addVariable">
              <Icon name="lucide:plus" class="mr-1 size-3.5" />
              {{ t('campaigns.templates.editor.addVariable') }}
            </Button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(v, idx) in variables"
              :key="idx"
              class="grid grid-cols-12 items-center gap-2 rounded-md border p-2"
            >
              <Input v-model="v.key" :placeholder="t('campaigns.templates.editor.key')" class="col-span-3" />
              <Select v-model="v.type">
                <SelectTrigger class="col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                  <SelectItem value="url">url</SelectItem>
                  <SelectItem value="date">date</SelectItem>
                  <SelectItem value="array">array</SelectItem>
                  <SelectItem value="object">object</SelectItem>
                </SelectContent>
              </Select>
              <div class="col-span-2 flex items-center gap-1">
                <Switch
                  :id="`req-${idx}`"
                  :checked="v.required"
                  @update:checked="(c: boolean) => (v.required = c)"
                />
                <Label :for="`req-${idx}`" class="text-xs">{{ t('campaigns.templates.editor.required') }}</Label>
              </div>
              <Input
                :model-value="String(v.sample ?? '')"
                :placeholder="t('campaigns.templates.editor.sample')"
                class="col-span-4"
                @update:model-value="(val: string | number) => (v.sample = val)"
              />
              <Button variant="ghost" size="icon-sm" class="col-span-1" @click="removeVariable(idx)">
                <Icon name="lucide:x" class="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t pt-3">
          <TestSendDialog
            :template-version-id="previewVersionId"
            :sample-params="sampleParams"
          />
          <Button variant="outline" :disabled="previewLoading" @click="previewLocally">
            <Icon v-if="previewLoading" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="lucide:eye" class="mr-2 size-4" />
            {{ t('campaigns.templates.editor.preview') }}
          </Button>
          <Button :disabled="saving" @click="saveAndActivate">
            <Icon v-if="saving" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="lucide:save" class="mr-2 size-4" />
            {{ t('campaigns.templates.editor.saveActivate') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ t('campaigns.preview.title') }}</CardTitle>
        <CardDescription>{{ t('campaigns.preview.description') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert v-if="previewError" variant="destructive">
          <AlertTitle>{{ t('campaigns.preview.errorTitle') }}</AlertTitle>
          <AlertDescription class="whitespace-pre-wrap font-mono text-xs">{{ previewError }}</AlertDescription>
        </Alert>
        <div v-if="previewHtml" class="overflow-hidden rounded-md border">
          <iframe
            :srcdoc="previewHtml"
            class="block h-[640px] w-full bg-white"
            sandbox="allow-same-origin"
          />
        </div>
        <div v-else class="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          {{ t('campaigns.preview.empty') }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>
