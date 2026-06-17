<script setup lang="ts">
import type { CampaignStatus, RecipientStatus } from '~/types/campaign.types';

interface Props {
  status: CampaignStatus | RecipientStatus;
}
const props = defineProps<Props>();

const variant = computed<'default' | 'secondary' | 'destructive' | 'outline'>(() => {
  switch (props.status) {
    case 'sent':
    case 'delivered':
    case 'opened':
    case 'clicked':
      return 'default';
    case 'failed':
    case 'hard_bounce':
    case 'complained':
    case 'aborted':
      return 'destructive';
    case 'partially_failed':
    case 'soft_bounce':
      return 'secondary';
    case 'sending':
    case 'queued':
    case 'pending':
      return 'outline';
    default:
      return 'secondary';
  }
});
</script>

<template>
  <Badge :variant="variant" class="capitalize">{{ status.replace(/_/g, ' ') }}</Badge>
</template>
