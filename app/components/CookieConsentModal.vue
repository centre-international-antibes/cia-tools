<script setup lang="ts">
import type { CookieCategory, CookieCategoryInfo } from '~/types/cookie-consent'

const { t } = useI18n()
const { preferences, modalState, acceptAll, rejectAll, savePreferences, hideModal } =
  useCookieConsent()

const isOpen = computed({
  get: () => modalState.value.view === 'detailed' && modalState.value.isVisible,
  set: (value: boolean) => {
    if (!value) hideModal()
  },
})

const localPreferences = ref<Record<CookieCategory, boolean>>({
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  preferences: false,
})

watch(
  () => preferences.value,
  newPrefs => {
    if (newPrefs) localPreferences.value = { ...newPrefs.categories }
  },
  { deep: true },
)

const categories = computed<CookieCategoryInfo[]>(() => [
  {
    id: 'essential',
    required: true,
    titleKey: 'cookieConsent.categories.essential.title',
    descriptionKey: 'cookieConsent.categories.essential.description',
    examplesKey: 'cookieConsent.categories.essential.examples',
  },
  {
    id: 'functional',
    required: false,
    titleKey: 'cookieConsent.categories.functional.title',
    descriptionKey: 'cookieConsent.categories.functional.description',
    examplesKey: 'cookieConsent.categories.functional.examples',
  },
  {
    id: 'analytics',
    required: false,
    titleKey: 'cookieConsent.categories.analytics.title',
    descriptionKey: 'cookieConsent.categories.analytics.description',
    examplesKey: 'cookieConsent.categories.analytics.examples',
  },
  {
    id: 'marketing',
    required: false,
    titleKey: 'cookieConsent.categories.marketing.title',
    descriptionKey: 'cookieConsent.categories.marketing.description',
    examplesKey: 'cookieConsent.categories.marketing.examples',
  },
  {
    id: 'preferences',
    required: false,
    titleKey: 'cookieConsent.categories.preferences.title',
    descriptionKey: 'cookieConsent.categories.preferences.description',
    examplesKey: 'cookieConsent.categories.preferences.examples',
  },
])

const handleAcceptAll = (): void => {
  acceptAll()
  hideModal()
}

const handleRejectAll = (): void => {
  rejectAll()
  hideModal()
}

const handleSavePreferences = (): void => {
  savePreferences(localPreferences.value)
  hideModal()
}

// Native <dialog> management
const dialogRef = useTemplateRef<HTMLDialogElement>('dialog')

watch(
  isOpen,
  (val) => {
    if (!dialogRef.value) return
    if (val) {
      dialogRef.value.showModal()
    } else if (dialogRef.value.open) {
      dialogRef.value.close()
    }
  },
  { flush: 'post' },
)

// Sync state when native ESC key closes the dialog
function onDialogClose() {
  hideModal()
}

onMounted(() => {
  localPreferences.value = { 
    essential: true,
    functional: preferences.value?.categories.functional ?? false,
    analytics: preferences.value?.categories.analytics ?? false,
    marketing: preferences.value?.categories.marketing ?? false,
    preferences: preferences.value?.categories.preferences ?? false,
   };
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="m-auto h-screen w-full max-w-xl gap-0 overflow-hidden rounded-xl bg-surface p-0 sm:max-h-[90vh]"
      @close="onDialogClose"
    >
      <!-- Header -->
      <div class="shrink-0 bg-linear-to-br from-surface to-surface-alt px-6 py-6">
        <div class="rounded-icon border border-surface-alt bg-white p-5 shadow-xs">
          <p class="mb-2 font-body text-sm text-ink-muted">
            {{ t('cookieConsent.modal.greeting') }}
          </p>
          <h2 class="mb-3 font-ui text-2xl font-bold text-ink">
            {{ t('cookieConsent.modal.title') }}
          </h2>
          <p class="mb-4 font-body text-sm leading-relaxed text-ink-muted">
            {{ t('cookieConsent.modal.description') }}
          </p>
          <div class="border-t border-surface-alt pt-3">
            <p class="mb-2 font-ui text-sm font-semibold text-ink">
              {{ t('cookieConsent.modal.settingsTitle') }}
            </p>
            <p class="font-body text-xs text-ink-muted">
              {{ t('cookieConsent.modal.settingsDescription') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Scrollable: Cookie Categories -->
      <div class="min-h-0 flex-1 overflow-y-auto bg-surface px-6 py-4">
        <div class="space-y-3 pb-2">
          <CookieCategoryCard
            v-for="category in categories"
            :key="category.id"
            :model-value="localPreferences[category.id] ?? false"
            :category="category"
            :disabled="category.required"
            @update:model-value="value => (localPreferences[category.id] = value)"
          />
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="shrink-0 border-t border-surface-alt bg-surface px-4 py-4">
        <div class="flex flex-wrap justify-around gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" @click="handleRejectAll">
              {{ t('cookieConsent.modal.nothanks') }}
            </Button>
            <Button variant="secondary" size="sm" @click="handleSavePreferences">
              {{ t('cookieConsent.modal.customize') }}
            </Button>
            <Button variant="default" size="sm" @click="handleAcceptAll">
              {{ t('cookieConsent.modal.acceptButton') }}
            </Button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Native <dialog> backdrop — pseudo-element cannot be expressed in Tailwind */
dialog::backdrop {
  background: rgba(28, 28, 26, 0.6);
  backdrop-filter: blur(4px);
}

/* Tailwind's `flex` class would override the UA `display:none` on a closed <dialog>.
   Constraining to [open] ensures the dialog is hidden when closed. */
dialog[open] {
  display: flex;
  flex-direction: column;
}
</style>
