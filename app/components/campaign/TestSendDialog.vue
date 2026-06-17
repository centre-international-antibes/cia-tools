<script setup lang="ts">
interface Props {
  templateVersionId: string | null;
  sampleParams?: Record<string, unknown>;
  campaignId?: string | null;
}
const props = defineProps<Props>();

const { t } = useI18n();
const c = useCampaigns();
const toast = useToast();
const { profile } = useUserProfile();

const open = ref(false);
const recipient = ref('');
const sending = ref(false);

watch(open, (v) => {
  if (v && !recipient.value) recipient.value = profile.value?.email ?? '';
});

async function submit() {
  if (!props.templateVersionId) return;
  sending.value = true;
  try {
    const result = await c.testSend({
      template_version_id: props.templateVersionId,
      recipient_email: recipient.value || undefined,
      campaign_id: props.campaignId ?? null,
      params: props.sampleParams ?? {},
    });
    if (result.status === 'sent') {
      toast.success(t('campaigns.testSend.success'), {
        description: t('campaigns.testSend.successDescription', { email: recipient.value }),
      });
      open.value = false;
    } else {
      toast.error(t('campaigns.testSend.failure'), { description: result.error ?? '' });
    }
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.testSend.failure'), { code: e.code, description: e.message });
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm" :disabled="!templateVersionId">
        <Icon name="lucide:send-horizontal" class="mr-2 size-4" />
        {{ t('campaigns.testSend.button') }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('campaigns.testSend.title') }}</DialogTitle>
        <DialogDescription>{{ t('campaigns.testSend.description') }}</DialogDescription>
      </DialogHeader>
      <div class="space-y-3 py-2">
        <Label for="test-recipient">{{ t('campaigns.testSend.recipient') }}</Label>
        <Input
          id="test-recipient"
          v-model="recipient"
          type="email"
          :placeholder="profile?.email"
        />
        <p class="text-xs text-muted-foreground">{{ t('campaigns.testSend.recipientHelp') }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="sending || !recipient" @click="submit">
          <Icon
            v-if="sending"
            name="lucide:loader-2"
            class="mr-2 size-4 animate-spin"
          />
          {{ t('campaigns.testSend.send') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
