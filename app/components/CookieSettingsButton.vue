<script setup lang="ts">
/**
 * Cookie Settings Button Component
 *
 * Floating button to reopen cookie preferences modal.
 * Can be positioned in different corners of the screen.
 */

interface Props {
  /**
   * Position of the button
   * @default 'bottom-left'
   */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

  /**
   * Whether to show the button
   * Only shows if user has already given consent
   * @default true
   */
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom-left',
  show: true,
});

const { t } = useI18n();
const { preferences, showModal } = useCookieConsent();

/**
 * Only show button if user has made a choice
 */
const shouldShow = computed(() => props.show && preferences.value !== null);

/**
 * Position classes based on prop
 */
const positionClasses = computed(() => {
  const positions = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
  };
  return positions[props.position];
});

/**
 * Handle button click
 */
const handleClick = (): void => {
  showModal();
};
</script>

<template>
  <ClientOnly>
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 scale-90 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <button
        v-if="shouldShow"
        :class="[
          'fixed z-40 flex rounded-full p-3 shadow-lg',
          'border border-surface-alt bg-surface',
          'hover:scale-105 hover:shadow-xl',
          'transition-all duration-200',
          'focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-2',
          'group',
          positionClasses,
        ]"
        :aria-label="t('cookieConsent.settings.title')"
        @click="handleClick"
      >
        <Icon
          name="i-lucide-cookie"
          class="text-ink-muted transition-colors group-hover:text-ink"
          size="1.25rem"
        />

        <!-- Tooltip -->
        <div
          class="pointer-events-none absolute bottom-full mb-2 rounded-lg border border-surface-alt bg-ink px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
          :class="{
            'right-0 -ml-4': positionClasses.includes('right'),
            'left-0': positionClasses.includes('left'),
          }"
        >
          {{ t('cookieConsent.settings.title') }}
        </div>
      </button>
    </Transition>
  </ClientOnly>
</template>
