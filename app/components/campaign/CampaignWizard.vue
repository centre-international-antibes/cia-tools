<script setup lang="ts">
import type {
  Campaign,
  CampaignContact,
  CampaignKind,
  CampaignKindConfig,
} from '~/types/campaign.types';

interface Props {
  kind: CampaignKind;
  kindConfig: CampaignKindConfig;
}
const props = defineProps<Props>();

const { t } = useI18n();
const c = useCampaigns();
const toast = useToast();
const localePath = useLocalePath();

type Step = 'list' | 'contacts' | 'template' | 'review';

const step = ref<Step>('list');
const listId = ref<string | null>(null);
const contacts = ref<CampaignContact[]>([]);
const selectedContactIds = ref<string[]>([]);
const template = ref<{
  default: { templateId: string | null; versionId: string | null };
  overrides: Record<string, string>;
}>({
  default: { templateId: null, versionId: null },
  overrides: {},
});
const campaign = ref<Campaign | null>(null);
const campaignName = ref(`${t(props.kindConfig.labelKey)} — ${new Date().toLocaleDateString()}`);
const notes = ref('');
const submitting = ref(false);

const steps: { id: Step; labelKey: string }[] = [
  { id: 'list', labelKey: 'campaigns.wizard.steps.list' },
  { id: 'contacts', labelKey: 'campaigns.wizard.steps.contacts' },
  { id: 'template', labelKey: 'campaigns.wizard.steps.template' },
  { id: 'review', labelKey: 'campaigns.wizard.steps.review' },
];

const currentIndex = computed(() => steps.findIndex((s) => s.id === step.value));

async function loadContacts() {
  if (!listId.value) return;
  const page = await c.lists.contacts(listId.value, { limit: 500 });
  contacts.value = page.rows;
  // Default selection skips rows the parser flagged as suppressed.
  selectedContactIds.value = page.rows
    .filter((r) => !((r.eligibility ?? {}) as { suppressed?: boolean }).suppressed)
    .map((r) => r.id);
}

async function ensureCampaign(): Promise<Campaign> {
  if (campaign.value) return campaign.value;
  if (!listId.value) throw new Error('No list selected.');
  const created = await c.campaigns.create({
    kind: props.kind,
    name: campaignName.value,
    list_id: listId.value,
    notes: notes.value,
  });
  campaign.value = created;
  return created;
}

async function next() {
  submitting.value = true;
  try {
    if (step.value === 'list') {
      if (!listId.value) {
        toast.warning(t('campaigns.wizard.pickListFirst'));
        return;
      }
      await loadContacts();
      step.value = 'contacts';
    } else if (step.value === 'contacts') {
      if (!selectedContactIds.value.length) {
        toast.warning(t('campaigns.wizard.pickContacts'));
        return;
      }
      const created = await ensureCampaign();
      await c.campaigns.prepare(created.id, selectedContactIds.value);
      step.value = 'template';
    } else if (step.value === 'template') {
      const d = template.value.default;
      if (!d.templateId || !d.versionId) {
        toast.warning(t('campaigns.wizard.pickTemplate'));
        return;
      }
      const presentVariants = inferPresentVariants();
      const missing = presentVariants.filter((v) => !template.value.overrides[v]);
      if (missing.length) {
        toast.warning(t('campaigns.wizard.pickAllVariants', { variants: missing.join(', ') }));
        return;
      }
      const created = await ensureCampaign();
      const updated = await c.campaigns.update(created.id, {
        template_id: d.templateId,
        template_version_id: d.versionId,
        template_overrides: template.value.overrides,
      });
      campaign.value = updated;
      step.value = 'review';
    }
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.wizard.error'), { code: e.code, description: e.message });
  } finally {
    submitting.value = false;
  }
}

/**
 * Mirrors `VariantTemplatePicker.presentVariants` so the wizard can
 * enforce coverage at the gate. Falls back to the kind's declared
 * variants when nothing is derivable from contacts.
 */
function inferPresentVariants(): string[] {
  const selected = new Set(selectedContactIds.value);
  const present = new Set<string>();
  for (const ct of contacts.value) {
    if (!selected.has(ct.id)) continue;
    const e = (ct.eligibility ?? {}) as Record<string, unknown>;
    const audience = typeof e.audience === 'string' ? e.audience : null;
    if (props.kind === 'ats' && audience) {
      present.add(audience === 'adult' ? 'adult' : 'junior');
    }
  }
  return present.size ? [...present] : [...props.kindConfig.variants];
}

function back() {
  const idx = currentIndex.value;
  if (idx > 0) step.value = steps[idx - 1].id;
}

function onSent() {
  if (campaign.value) {
    navigateTo(localePath(`/dashboard/campaigns/${props.kind}/${campaign.value.id}`));
  }
}

const sampleParams = computed<Record<string, unknown>>(() => {
  const first = contacts.value.find((c) => selectedContactIds.value.includes(c.id))
    ?? contacts.value[0];
  if (!first) return {};
  return {
    first_name: first.first_name,
    last_name: first.last_name,
    ...((first.eligibility ?? {}) as Record<string, unknown>),
  };
});
</script>

<template>
  <div class="space-y-6">
    <!-- Stepper -->
    <ol class="flex items-center gap-2">
      <li
        v-for="(s, i) in steps"
        :key="s.id"
        class="flex items-center gap-2"
      >
        <span
          class="flex size-7 items-center justify-center rounded-full text-xs font-medium"
          :class="
            i < currentIndex
              ? 'bg-primary text-primary-foreground'
              : i === currentIndex
                ? 'bg-primary/80 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
          "
        >
          {{ i + 1 }}
        </span>
        <span
          class="text-sm"
          :class="i === currentIndex ? 'font-medium' : 'text-muted-foreground'"
        >
          {{ t(s.labelKey) }}
        </span>
        <Icon
          v-if="i < steps.length - 1"
          name="lucide:chevron-right"
          class="size-4 text-muted-foreground"
        />
      </li>
    </ol>

    <!-- Step body -->
    <div v-if="step === 'list'" class="space-y-4">
      <PaymentReminderUploader
        v-if="kind === 'payment_reminder'"
        :kind="kind"
        @uploaded="(id) => (listId = id)"
      />
      <ContactListUploader
        v-else
        :kind="kind"
        @uploaded="(id) => (listId = id)"
      />
      <ContactListPicker :kind="kind" v-model="listId" />
    </div>

    <div v-else-if="step === 'contacts'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="campaign-name">{{ t('campaigns.wizard.campaignName') }}</Label>
          <Input id="campaign-name" v-model="campaignName" />
        </div>
        <div class="space-y-2">
          <Label for="campaign-notes">{{ t('campaigns.wizard.notes') }}</Label>
          <Input id="campaign-notes" v-model="notes" />
        </div>
      </div>
      <ContactTable :contacts="contacts" v-model="selectedContactIds" />
    </div>

    <div v-else-if="step === 'template'" class="space-y-4">
      <VariantTemplatePicker
        :kind="kind"
        :variants="kindConfig.variants"
        :contacts="contacts"
        :selected-contact-ids="selectedContactIds"
        v-model="template"
      />
      <Card v-if="template.default.templateId">
        <CardHeader class="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{{ t('campaigns.preview.title') }}</CardTitle>
            <CardDescription>{{ t('campaigns.preview.description') }}</CardDescription>
          </div>
          <TestSendDialog
            :template-version-id="template.default.versionId"
            :sample-params="sampleParams"
            :campaign-id="campaign?.id ?? null"
          />
        </CardHeader>
        <CardContent>
          <TemplatePreview
            :template-id="template.default.templateId"
            :version-id="template.default.versionId"
            :sample-params="sampleParams"
          />
        </CardContent>
      </Card>
    </div>

    <div v-else-if="step === 'review'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('campaigns.review.title') }}</CardTitle>
          <CardDescription>{{ t('campaigns.review.description') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('campaigns.review.kind') }}</span>
            <span class="font-medium">{{ t(kindConfig.labelKey) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('campaigns.review.recipients') }}</span>
            <span class="font-medium">{{ selectedContactIds.length }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('campaigns.review.name') }}</span>
            <span class="font-medium">{{ campaignName }}</span>
          </div>
        </CardContent>
      </Card>

      <div v-if="campaign" class="flex justify-end gap-2">
        <TestSendDialog
          :template-version-id="template.default.versionId"
          :sample-params="sampleParams"
          :campaign-id="campaign.id"
        />
        <CampaignSendDialog
          :campaign-id="campaign.id"
          :recipient-count="selectedContactIds.length"
          @sent="onSent"
        />
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex items-center justify-between border-t pt-4">
      <Button variant="ghost" :disabled="currentIndex === 0 || submitting" @click="back">
        <Icon name="lucide:chevron-left" class="mr-2 size-4" />
        {{ t('common.back') }}
      </Button>
      <Button v-if="step !== 'review'" :disabled="submitting" @click="next">
        <Icon v-if="submitting" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
        {{ t('common.next') }}
      </Button>
    </div>
  </div>
</template>
