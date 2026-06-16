<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { modalState, acceptAll, rejectAll, showModal, hideModal } = useCookieConsent()

const handleAcceptAll = (): void => {
  acceptAll()
  hideModal()
}

const handleRejectAll = (): void => {
  rejectAll()
  hideModal()
}

const handleCustomize = (): void => {
  showModal('detailed')
}
</script>

<template>
  <Teleport v-if="modalState.view === 'banner' && modalState.isVisible" to="body">
    <div class="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div class="mx-auto max-w-5xl">
        <div class="rounded-card border-2 border-surface-alt bg-surface/95 shadow-2xl backdrop-blur supports-backdrop-filter:bg-surface/80">
          <div class="p-4 sm:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex-1">
                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cia-blue/10">
                    <Icon name="i-lucide-cookie" class="text-cia-blue" size="1.25rem" />
                  </div>
                  <div class="flex-1">
                    <h3 class="font-ui text-lg font-semibold text-ink">
                      {{ t('cookieConsent.banner.title') }}
                    </h3>
                    <p class="mt-1 font-body text-sm text-ink-muted">
                      {{ t('cookieConsent.banner.description') }}
                    </p>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
                <Button variant="secondary" size="sm" class="w-full sm:w-auto" @click="handleRejectAll">
                  {{ t('cookieConsent.banner.rejectAll') }}
                </Button>
                <Button variant="secondary" size="sm" class="w-full sm:w-auto" @click="handleCustomize">
                  {{ t('cookieConsent.banner.customize') }}
                </Button>
                <Button variant="default" size="sm" class="w-full sm:w-auto" @click="handleAcceptAll">
                  {{ t('cookieConsent.banner.acceptAll') }}
                </Button>
              </div>
            </div>

            <div class="mt-3 flex items-center gap-3 font-body text-xs text-ink-muted">
              <NuxtLink :to="localePath('confidentialite')" class="transition-colors hover:text-ink">
                {{ t('cookieConsent.info.privacyPolicy') }}
              </NuxtLink>
              <span aria-hidden="true">•</span>
              <NuxtLink :to="localePath('legal')" class="transition-colors hover:text-ink">
                {{ t('cookieConsent.info.cookiePolicy') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
