<script setup lang="ts">
import type { CampaignKind } from '~/types/campaign.types';

definePageMeta({ layout: 'dashboard' });

const route = useRoute();
const { t } = useI18n();
const { fetchKinds, getKind } = useCampaigns();

const kind = route.params.kind as CampaignKind;
await fetchKinds();
const kindCfg = getKind(kind);

if (!kindCfg) {
  throw createError({ statusCode: 404, statusMessage: 'Unknown campaign kind.' });
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('campaigns.wizard.title', { kind: t(kindCfg.labelKey) }) }}
      </h1>
      <p class="mt-1 text-muted-foreground">{{ t('campaigns.wizard.subtitle') }}</p>
    </div>

    <CampaignWizard :kind="kind" :kind-config="kindCfg" />
  </div>
</template>
