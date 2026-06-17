<script setup lang="ts">
import type { CampaignKind, CampaignList } from '~/types/campaign.types';

interface Props {
  kind: CampaignKind;
  modelValue: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const { t } = useI18n();
const c = useCampaigns();
const lists = ref<CampaignList[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    lists.value = await c.lists.list(props.kind);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ reload: load });

function formatDate(d: string) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('campaigns.lists.title') }}</CardTitle>
      <CardDescription>{{ t('campaigns.lists.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="loading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="size-5 animate-spin text-muted-foreground" />
      </div>
      <div v-else-if="!lists.length" class="px-6 py-8 text-center text-sm text-muted-foreground">
        {{ t('campaigns.lists.empty') }}
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>{{ t('campaigns.lists.name') }}</TableHead>
            <TableHead>{{ t('campaigns.lists.rows') }}</TableHead>
            <TableHead>{{ t('campaigns.lists.uploadedAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="l in lists"
            :key="l.id"
            class="cursor-pointer"
            :class="modelValue === l.id ? 'bg-accent/40' : ''"
            @click="emit('update:modelValue', l.id)"
          >
            <TableCell>
              <input
                type="radio"
                :checked="modelValue === l.id"
                @change="emit('update:modelValue', l.id)"
              />
            </TableCell>
            <TableCell class="font-medium">{{ l.name }}</TableCell>
            <TableCell>{{ l.row_count }}</TableCell>
            <TableCell>{{ formatDate(l.created_at) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
