<script setup lang="ts">
import type { CampaignContact, CampaignKind, EmailTemplate } from '~/types/campaign.types';

/**
 * Per-variant template picker.
 *
 * Why this exists: a single list (notably for `ats`) commonly mixes
 * juniors and adults. One template version per campaign isn't enough.
 * We surface one selector per variant *actually present* in the
 * selected contacts so the operator maps each to its own template.
 *
 * Output (`v-model`):
 *   {
 *     default: { templateId, versionId },             // sender fallback
 *     overrides: { junior: versionId, adult: ... },   // saved to campaign
 *   }
 */
interface VariantSelection {
  default: { templateId: string | null; versionId: string | null };
  overrides: Record<string, string>;
}

interface Props {
  kind: CampaignKind;
  variants: readonly string[];
  contacts: CampaignContact[];
  selectedContactIds: string[];
  modelValue: VariantSelection;
}
const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [value: VariantSelection] }>();

const { t } = useI18n();
const c = useCampaigns();

const templates = ref<EmailTemplate[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    templates.value = await c.templates.list(props.kind);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

/**
 * Variants we actually need to pick a template for, derived from the
 * resolved variant stamped on each selected contact's eligibility.
 * Falls back to the kind's declared variants when contacts haven't been
 * tagged yet (older lists).
 */
const presentVariants = computed<string[]>(() => {
  const selected = new Set(props.selectedContactIds);
  const present = new Set<string>();
  for (const ct of props.contacts) {
    if (!selected.has(ct.id)) continue;
    const e = (ct.eligibility ?? {}) as Record<string, unknown>;
    const audience = typeof e.audience === 'string' ? e.audience : null;
    // For ATS this is the natural variant; for others, fall through.
    if (props.kind === 'ats' && audience) {
      present.add(audience === 'adult' ? 'adult' : 'junior');
    }
  }
  // If we couldn't derive anything, fall back to the kind's declared variants.
  return present.size ? [...present] : [...props.variants];
});

/** Templates available for a given variant (filtered + with an active version). */
function templatesFor(variant: string): EmailTemplate[] {
  return templates.value.filter(
    (tpl) => tpl.variant === variant && tpl.current_version_id !== null,
  );
}

/** Currently-selected version id per variant (mirrors props.modelValue). */
const selection = ref<Record<string, string>>({ ...props.modelValue.overrides });

// Resync local state if the parent resets the picker (e.g. variant set changes).
watch(
  presentVariants,
  (vs) => {
    for (const v of Object.keys(selection.value)) {
      if (!vs.includes(v)) delete selection.value[v];
    }
  },
  { immediate: true },
);

function pickVariant(variant: string, versionId: string) {
  const tpl = templates.value.find(
    (t) => t.variant === variant && t.current_version_id === versionId,
  );
  if (!tpl) return;
  selection.value = { ...selection.value, [variant]: versionId };
  emitSelection(tpl);
}

function emitSelection(latest: EmailTemplate) {
  // Compute the campaign default = first variant we have a selection for.
  // The sender still falls back to it when a recipient's variant has no
  // override, but every present variant *should* end up explicitly mapped.
  const first = presentVariants.value.find((v) => selection.value[v]);
  const firstVersionId = first ? selection.value[first] : null;
  const firstTpl = templates.value.find(
    (t) => t.current_version_id === firstVersionId,
  ) ?? latest;
  emit('update:modelValue', {
    default: {
      templateId: firstTpl.id,
      versionId: firstTpl.current_version_id,
    },
    overrides: { ...selection.value },
  });
}

function variantLabel(variant: string): string {
  const key = `campaigns.variants.${props.kind}.${variant}`;
  const translated = t(key);
  return translated === key ? variant : translated;
}

const allPicked = computed(() =>
  presentVariants.value.every((v) => selection.value[v]),
);
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('campaigns.templates.pickTitle') }}</CardTitle>
      <CardDescription>
        {{ t('campaigns.templates.pickPerVariantDescription') }}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div v-if="loading" class="flex items-center justify-center py-6">
        <Icon name="lucide:loader-2" class="size-5 animate-spin" />
      </div>
      <template v-else>
        <div
          v-for="variant in presentVariants"
          :key="variant"
          class="space-y-2 rounded-md border p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <Label :for="`tpl-${variant}`" class="text-sm font-medium">
              {{ variantLabel(variant) }}
            </Label>
            <Badge v-if="selection[variant]" variant="default" class="text-xs">
              {{ t('campaigns.templates.ready') }}
            </Badge>
            <Badge v-else variant="outline" class="text-xs">
              {{ t('campaigns.templates.pickRequired') }}
            </Badge>
          </div>
          <Select
            :model-value="selection[variant] ?? ''"
            @update:model-value="(v) => pickVariant(variant, String(v))"
          >
            <SelectTrigger :id="`tpl-${variant}`">
              <SelectValue :placeholder="t('campaigns.templates.pickPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="tpl in templatesFor(variant)"
                :key="tpl.id"
                :value="tpl.current_version_id ?? ''"
              >
                {{ tpl.name }} · <span class="uppercase">{{ tpl.language }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="!templatesFor(variant).length"
            class="text-xs text-amber-700"
          >
            {{ t('campaigns.templates.noVariantAvailable', { variant }) }}
          </p>
        </div>
      </template>

      <Alert v-if="!loading && !allPicked" variant="default">
        <Icon name="lucide:info" class="size-4" />
        <AlertTitle>{{ t('campaigns.templates.pickAllRequiredTitle') }}</AlertTitle>
        <AlertDescription>
          {{ t('campaigns.templates.pickAllRequiredDescription') }}
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
