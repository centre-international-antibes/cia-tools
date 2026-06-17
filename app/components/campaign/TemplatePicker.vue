<script setup lang="ts">
import type { CampaignKind, EmailTemplate } from '~/types/campaign.types';

interface Props {
  kind: CampaignKind;
  modelValue: { templateId: string | null; versionId: string | null };
}
const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: { templateId: string | null; versionId: string | null }];
}>();

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

function pick(t: EmailTemplate) {
  emit('update:modelValue', {
    templateId: t.id,
    versionId: t.current_version_id,
  });
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('campaigns.templates.pickTitle') }}</CardTitle>
      <CardDescription>{{ t('campaigns.templates.pickDescription') }}</CardDescription>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="loading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="size-5 animate-spin" />
      </div>
      <div v-else-if="!templates.length" class="px-6 py-8 text-center text-sm text-muted-foreground">
        {{ t('campaigns.templates.empty') }}
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>{{ t('campaigns.templates.name') }}</TableHead>
            <TableHead>{{ t('campaigns.templates.variant') }}</TableHead>
            <TableHead>{{ t('campaigns.templates.lang') }}</TableHead>
            <TableHead>{{ t('campaigns.templates.status') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="tpl in templates"
            :key="tpl.id"
            class="cursor-pointer"
            :class="modelValue.templateId === tpl.id ? 'bg-accent/40' : ''"
            @click="pick(tpl)"
          >
            <TableCell>
              <input
                type="radio"
                :checked="modelValue.templateId === tpl.id"
                @change="pick(tpl)"
              />
            </TableCell>
            <TableCell class="font-medium">{{ tpl.name }}</TableCell>
            <TableCell>{{ tpl.variant }}</TableCell>
            <TableCell class="uppercase">{{ tpl.language }}</TableCell>
            <TableCell>
              <Badge :variant="tpl.current_version_id ? 'default' : 'outline'">
                {{ tpl.current_version_id ? t('campaigns.templates.ready') : t('campaigns.templates.noVersion') }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
