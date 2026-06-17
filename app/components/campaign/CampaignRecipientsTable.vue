<script setup lang="ts">
import type { CampaignRecipient } from '~/types/campaign.types';

interface Props {
  recipients: CampaignRecipient[];
}
defineProps<Props>();
const { t } = useI18n();

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('campaigns.recipients.title') }}</CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('campaigns.recipients.email') }}</TableHead>
            <TableHead>{{ t('campaigns.recipients.status') }}</TableHead>
            <TableHead>{{ t('campaigns.recipients.attempts') }}</TableHead>
            <TableHead>{{ t('campaigns.recipients.sentAt') }}</TableHead>
            <TableHead>{{ t('campaigns.recipients.lastEventAt') }}</TableHead>
            <TableHead>{{ t('campaigns.recipients.error') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="r in recipients" :key="r.id">
            <TableCell class="font-mono text-xs">{{ r.email }}</TableCell>
            <TableCell>
              <StatusBadges :status="r.status" />
            </TableCell>
            <TableCell>{{ r.attempts }}</TableCell>
            <TableCell>{{ formatDate(r.sent_at) }}</TableCell>
            <TableCell>{{ formatDate(r.last_event_at) }}</TableCell>
            <TableCell class="max-w-xs truncate text-xs text-destructive">{{ r.error ?? '' }}</TableCell>
          </TableRow>
          <TableRow v-if="!recipients.length">
            <TableCell :colspan="6" class="py-8 text-center text-muted-foreground">
              {{ t('campaigns.recipients.empty') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
