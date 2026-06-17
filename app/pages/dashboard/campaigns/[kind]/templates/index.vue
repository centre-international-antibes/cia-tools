<script setup lang="ts">
import type { CampaignKind, EmailTemplate } from '~/types/campaign.types';

definePageMeta({ layout: 'dashboard' });

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const c = useCampaigns();
const toast = useToast();
const { fetchKinds, getKind } = useCampaigns();

const kind = route.params.kind as CampaignKind;
await fetchKinds();
const kindCfg = getKind(kind);
if (!kindCfg) throw createError({ statusCode: 404 });

const templates = ref<EmailTemplate[]>([]);
const loading = ref(true);
const dialogOpen = ref(false);
const form = reactive({
  name: '',
  language: 'fr' as 'fr' | 'en',
  variant: kindCfg.variants[0] ?? 'default',
  description: '',
});
const creating = ref(false);

async function load() {
  loading.value = true;
  try {
    templates.value = await c.templates.list(kind);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function create() {
  creating.value = true;
  try {
    const tpl = await c.templates.create({
      kind,
      name: form.name,
      language: form.language,
      variant: form.variant,
      description: form.description,
    });
    dialogOpen.value = false;
    await navigateTo(localePath(`/dashboard/campaigns/${kind}/templates/${tpl.id}`));
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.templates.createError'), { code: e.code, description: e.message });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink :to="localePath(`/dashboard/campaigns/${kind}`)">
            <Icon name="lucide:chevron-left" class="mr-2 size-4" />
            {{ t('campaigns.backToKind') }}
          </NuxtLink>
        </Button>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">
          {{ t('campaigns.templates.titleFor', { kind: t(kindCfg.labelKey) }) }}
        </h1>
      </div>
      <Button @click="dialogOpen = true">
        <Icon name="lucide:plus" class="mr-2 size-4" />
        {{ t('campaigns.templates.create') }}
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="loading" class="flex justify-center py-8">
          <Icon name="lucide:loader-2" class="size-5 animate-spin" />
        </div>
        <div v-else-if="!templates.length" class="px-6 py-8 text-center text-sm text-muted-foreground">
          {{ t('campaigns.templates.empty') }}
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('campaigns.templates.name') }}</TableHead>
              <TableHead>{{ t('campaigns.templates.variant') }}</TableHead>
              <TableHead>{{ t('campaigns.templates.lang') }}</TableHead>
              <TableHead>{{ t('campaigns.templates.status') }}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="tpl in templates"
              :key="tpl.id"
              class="cursor-pointer"
              @click="$router.push(localePath(`/dashboard/campaigns/${kind}/templates/${tpl.id}`))"
            >
              <TableCell class="font-medium">{{ tpl.name }}</TableCell>
              <TableCell>{{ tpl.variant }}</TableCell>
              <TableCell class="uppercase">{{ tpl.language }}</TableCell>
              <TableCell>
                <Badge :variant="tpl.current_version_id ? 'default' : 'outline'">
                  {{ tpl.current_version_id ? t('campaigns.templates.ready') : t('campaigns.templates.noVersion') }}
                </Badge>
              </TableCell>
              <TableCell><Icon name="lucide:chevron-right" class="size-4 text-muted-foreground" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('campaigns.templates.create') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="create">
          <div class="space-y-2">
            <Label for="tpl-name">{{ t('campaigns.templates.name') }}</Label>
            <Input id="tpl-name" v-model="form.name" required />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-2">
              <Label for="tpl-lang">{{ t('campaigns.templates.lang') }}</Label>
              <Select v-model="form.language">
                <SelectTrigger id="tpl-lang"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">fr</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="tpl-variant">{{ t('campaigns.templates.variant') }}</Label>
              <Select v-model="form.variant">
                <SelectTrigger id="tpl-variant"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="v in kindCfg.variants" :key="v" :value="v">{{ v }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="tpl-desc">{{ t('campaigns.templates.description') }}</Label>
            <Input id="tpl-desc" v-model="form.description" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="dialogOpen = false">{{ t('common.cancel') }}</Button>
            <Button type="submit" :disabled="creating">
              <Icon v-if="creating" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
              {{ t('common.create') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
