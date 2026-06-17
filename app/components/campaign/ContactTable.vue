<script setup lang="ts">
import type { CampaignContact, EligibilityFlags } from '~/types/campaign.types';

interface Props {
  contacts: CampaignContact[];
  modelValue: string[];
}
const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const { t } = useI18n();
const search = ref('');
const showSuppressed = ref(false);

const selected = computed({
  get: () => new Set(props.modelValue),
  set: (s) => emit('update:modelValue', Array.from(s)),
});

function eligibilityOf(c: CampaignContact): EligibilityFlags {
  return (c.eligibility ?? {}) as EligibilityFlags;
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return props.contacts.filter((c) => {
    const e = eligibilityOf(c);
    if (!showSuppressed.value && e.suppressed) return false;
    if (!q) return true;
    return (
      c.email.toLowerCase().includes(q)
      || c.first_name.toLowerCase().includes(q)
      || c.last_name.toLowerCase().includes(q)
    );
  });
});

const counts = computed(() => {
  let suppressed = 0;
  let selectable = 0;
  for (const c of props.contacts) {
    if (eligibilityOf(c).suppressed) suppressed++;
    else selectable++;
  }
  return { suppressed, selectable };
});

const allSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((c) => selected.value.has(c.id)),
);

function toggleAll() {
  const next = new Set(selected.value);
  if (allSelected.value) {
    for (const c of filtered.value) next.delete(c.id);
  } else {
    for (const c of filtered.value) {
      if (!eligibilityOf(c).suppressed || showSuppressed.value) next.add(c.id);
    }
  }
  emit('update:modelValue', Array.from(next));
}

function toggleOne(id: string) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit('update:modelValue', Array.from(next));
}

const FLAG_KEYS: Array<keyof EligibilityFlags> = [
  'no_flight_info',
  'no_health_form',
  'no_passport',
  'is_private_flat',
  'is_late_arrival',
  'had_complaint',
];

function flagsList(e: EligibilityFlags): string[] {
  const out: string[] = [];
  for (const key of FLAG_KEYS) {
    if (e[key]) out.push(String(key));
  }
  if (e.audience) out.push(e.audience);
  if (e.course_type) out.push(e.course_type);
  if (e.test_status && e.test_status !== 'pending') out.push(e.test_status);
  if (e.ats_rule && e.ats_rule !== 'unknown') out.push(`ats:${e.ats_rule}`);
  if (e.reminder_count) out.push(`r${e.reminder_count}`);
  if (e.client_type && !e.client_type.startsWith('DIRECT')) out.push(e.client_type);
  return out;
}

function suppressionLabel(e: EligibilityFlags): string {
  return (e.suppression_reasons ?? []).join(', ');
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between gap-4">
      <div>
        <CardTitle>{{ t('campaigns.contacts.title') }}</CardTitle>
        <CardDescription>
          {{ t('campaigns.contacts.selected', { selected: modelValue.length, total: contacts.length }) }}
          <span v-if="counts.suppressed" class="ml-2 text-amber-600">
            · {{ t('campaigns.contacts.suppressedCount', { count: counts.suppressed }) }}
          </span>
        </CardDescription>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input v-model="showSuppressed" type="checkbox" />
          {{ t('campaigns.contacts.showSuppressed') }}
        </label>
        <Input v-model="search" :placeholder="t('campaigns.contacts.search')" class="max-w-xs" />
      </div>
    </CardHeader>
    <CardContent class="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            </TableHead>
            <TableHead>{{ t('campaigns.contacts.email') }}</TableHead>
            <TableHead>{{ t('campaigns.contacts.name') }}</TableHead>
            <TableHead>{{ t('campaigns.contacts.lang') }}</TableHead>
            <TableHead>{{ t('campaigns.contacts.flags') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="c in filtered"
            :key="c.id"
            class="cursor-pointer"
            :class="eligibilityOf(c).suppressed ? 'opacity-60 bg-amber-50/40' : ''"
            @click="toggleOne(c.id)"
          >
            <TableCell>
              <input
                type="checkbox"
                :checked="selected.has(c.id)"
                @click.stop="toggleOne(c.id)"
              />
            </TableCell>
            <TableCell class="font-mono text-xs">{{ c.email }}</TableCell>
            <TableCell>{{ c.first_name }} {{ c.last_name }}</TableCell>
            <TableCell>
              <Badge variant="outline" class="uppercase">{{ c.language }}</Badge>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap items-center gap-1">
                <Badge
                  v-if="eligibilityOf(c).suppressed"
                  variant="destructive"
                  class="text-xs"
                  :title="suppressionLabel(eligibilityOf(c))"
                >
                  {{ t('campaigns.contacts.suppressed') }}
                </Badge>
                <Badge
                  v-for="f in flagsList(eligibilityOf(c))"
                  :key="f"
                  variant="secondary"
                  class="text-xs"
                >
                  {{ f }}
                </Badge>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="!filtered.length">
            <TableCell :colspan="5" class="py-8 text-center text-muted-foreground">
              {{ t('campaigns.contacts.empty') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
