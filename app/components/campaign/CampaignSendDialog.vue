<script setup lang="ts">
interface Props {
  campaignId: string;
  recipientCount: number;
  disabled?: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ sent: [] }>();

const { t } = useI18n();
const c = useCampaigns();
const toast = useToast();

const open = ref(false);
const sending = ref(false);

async function submit() {
  sending.value = true;
  try {
    const clientRequestId = crypto.randomUUID();
    await c.campaigns.send(props.campaignId, clientRequestId);
    toast.success(t('campaigns.send.queued'));
    open.value = false;
    emit('sent');
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('campaigns.send.error'), { code: e.code, description: e.message });
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button :disabled="disabled">
        <Icon name="lucide:send" class="mr-2 size-4" />
        {{ t('campaigns.send.button') }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('campaigns.send.confirmTitle') }}</DialogTitle>
        <DialogDescription>
          {{ t('campaigns.send.confirmDescription', { count: recipientCount }) }}
        </DialogDescription>
      </DialogHeader>
      <Alert>
        <Icon name="lucide:info" class="size-4" />
        <AlertDescription>{{ t('campaigns.send.confirmWarning') }}</AlertDescription>
      </Alert>
      <DialogFooter>
        <Button variant="outline" @click="open = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="sending" @click="submit">
          <Icon v-if="sending" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
          {{ t('campaigns.send.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
