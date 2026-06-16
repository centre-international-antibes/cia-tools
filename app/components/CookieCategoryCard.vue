<script setup lang="ts">
import type { CookieCategoryInfo } from '~/types/cookie-consent'

interface Props {
  category: CookieCategoryInfo
  modelValue: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const handleToggle = (): void => {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}

const getCategoryIcon = computed(() => {
  const iconMap: Record<string, string> = {
    essential: 'i-lucide-shield-check',
    functional: 'i-lucide-settings',
    analytics: 'i-lucide-bar-chart',
    marketing: 'i-lucide-megaphone',
    preferences: 'i-lucide-user-cog',
  }
  return iconMap[props.category.id] || 'i-lucide-cookie'
})
</script>

<template>
  <div class="group rounded-xl border border-surface-alt bg-white p-4 transition-all hover:shadow-xs">
    <div class="flex items-start justify-between gap-4">
      <!-- Icon and Content -->
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <!-- Icon -->
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-surface to-surface-alt transition-colors group-hover:from-cia-blue/10 group-hover:to-cia-blue/5"
        >
          <Icon :name="getCategoryIcon" class="text-cia-blue" size="1.5rem" />
        </div>

        <!-- Text Content -->
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-ui text-base font-semibold text-ink">
              {{ t(category.titleKey) }}
            </h4>
            <span
              v-if="category.required"
              class="rounded-full bg-surface-alt px-2 py-0.5 font-ui text-[10px] font-medium text-ink-muted"
            >
              {{ t('cookieConsent.banner.required') }}
            </span>
          </div>
          <p class="font-body text-sm leading-relaxed text-ink-muted">
            {{ t(category.descriptionKey) }}
          </p>
        </div>
      </div>

      <!-- Toggle Switch -->
      <div class="flex shrink-0 items-start pt-1">
        <button
          :id="`cookie-${category.id}`"
          role="switch"
          :aria-checked="modelValue"
          :disabled="disabled"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cia-blue',
            modelValue ? 'bg-cia-blue' : 'bg-ink/20',
            disabled ? 'cursor-not-allowed opacity-50' : '',
          ]"
          @click="handleToggle"
        >
          <span
            :class="[
              'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
              modelValue ? 'translate-x-5' : 'translate-x-0',
            ]"
            aria-hidden="true"
          />
        </button>
        <label :for="`cookie-${category.id}`" class="sr-only">
          {{ t(category.titleKey) }}
        </label>
      </div>
    </div>

    <!-- Examples -->
    <div v-if="t(category.examplesKey)" class="mt-3 border-t border-surface-alt pt-3">
      <p class="font-body text-xs text-ink-muted">
        <span class="font-medium">{{ t('cookieConsent.categories.examples') }}:</span>
        {{ t(category.examplesKey) }}
      </p>
    </div>
  </div>
</template>
