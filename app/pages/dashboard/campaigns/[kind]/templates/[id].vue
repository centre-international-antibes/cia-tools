<script setup lang="ts">
import type {
  CampaignKind,
  EmailTemplate,
  EmailTemplateVersion,
  TemplateVariable,
} from '~/types/campaign.types';

definePageMeta({ layout: 'dashboard' });

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const c = useCampaigns();

const kind = route.params.kind as CampaignKind;
const id = route.params.id as string;

interface VersionPreview {
  id: string;
  version: number;
  subject: string;
  variables_schema: TemplateVariable[];
  created_at: string;
  created_by: string;
}

const template = ref<EmailTemplate | null>(null);
const versions = ref<VersionPreview[]>([]);
const latestVersion = ref<EmailTemplateVersion | null>(null);
const loading = ref(true);

async function load() {
  const detail = await c.templates.get(id);
  template.value = detail.template;
  versions.value = detail.versions as VersionPreview[];

  if (detail.template.current_version_id) {
    latestVersion.value = await c.templates.getVersion(
      detail.template.id,
      detail.template.current_version_id,
    );
  }
  loading.value = false;
}
onMounted(load);

function onSaved() {
  load();
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex justify-center py-20">
      <Icon name="lucide:loader-2" class="size-6 animate-spin" />
    </div>
    <template v-else-if="template">
      <div>
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink :to="localePath(`/dashboard/campaigns/${kind}/templates`)">
            <Icon name="lucide:chevron-left" class="mr-2 size-4" />
            {{ t('campaigns.templates.backToList') }}
          </NuxtLink>
        </Button>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ template.name }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ template.variant }} · <span class="uppercase">{{ template.language }}</span>
          · {{ versions.length }} {{ t('campaigns.templates.versionsCount') }}
        </p>
      </div>

      <TemplateEditor
        :template-id="template.id"
        :initial-version="latestVersion ? {
          subject: latestVersion.subject,
          mjml: latestVersion.mjml,
          variables_schema: (latestVersion.variables_schema ?? []) as TemplateVariable[],
        } : undefined"
        @saved="onSaved"
      />

      <Card>
        <CardHeader>
          <CardTitle>{{ t('campaigns.templates.versionsTitle') }}</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>v</TableHead>
                <TableHead>{{ t('campaigns.templates.editor.subject') }}</TableHead>
                <TableHead>{{ t('campaigns.templates.createdAt') }}</TableHead>
                <TableHead>{{ t('campaigns.templates.status') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="v in versions" :key="v.id">
                <TableCell>{{ v.version }}</TableCell>
                <TableCell class="max-w-md truncate">{{ v.subject }}</TableCell>
                <TableCell>{{ new Date(v.created_at).toLocaleString() }}</TableCell>
                <TableCell>
                  <Badge v-if="v.id === template.current_version_id" variant="default">
                    {{ t('campaigns.templates.active') }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
