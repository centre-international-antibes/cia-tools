<script setup lang="ts">
const props = defineProps<{
  items?: Array<{ label: string; href: string }>
  cta?: { label: string; href: string }
}>()

const { t, locale, locales, setLocale } = useI18n()
const otherLocale = computed(() =>
  locales.value.find(l => l.code !== locale.value),
)
const localePath = useLocalePath()
const route = useRoute()

const headerRef = useTemplateRef<HTMLElement>('header')
const menuRef = useTemplateRef<HTMLElement>('menu')
const navItemsRef = useTemplateRef<HTMLElement>('navItems')

const isMenuOpen = ref(false)

const navItems = computed(() => props.items ?? [])
const navCta = computed(() => props.cta ?? null)

const isActive = (href: string) => {
  return route.path === href ||
    route.path === localePath({ path: href }) ||
    route.path.startsWith(href + '/') ||
    route.path.startsWith(localePath({ path: href }) + '/')
}


function openMenu() {
  isMenuOpen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    const closeBtn = menuRef.value?.querySelector<HTMLElement>('[data-close]')
    closeBtn?.focus()
  })
}

function closeMenu() {
  isMenuOpen.value = false
  document.body.style.overflow = ''
  // Return focus to hamburger
  const hamburger = headerRef.value?.querySelector<HTMLElement>('[data-hamburger]')
  hamburger?.focus()
}

function onMenuKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}

// Close menu on route change
watch(() => route.path, () => {
  if (isMenuOpen.value) closeMenu()
})
</script>

<template>
  <header ref="header"
    class="fixed inset-x-0 top-0 z-100 bg-transparent transition-colors duration-300 will-change-transform"
    role="banner">
    <div class="mx-auto flex max-w-container items-center justify-between gap-8 px-8 py-5">
      <!-- Logo -->
      <NuxtLink :to="localePath('index')"
        class="flex shrink-0 items-center text-white no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-4"
        aria-label="CIA — accueil">
        <Icon name="cia:logo-sigle" class="w-12 h-auto text-cia-blue" mode="svg" />
      </NuxtLink>

      <!-- Desktop nav -->
      <nav :aria-label="t('a11y.mainNav')" class="hidden items-center gap-8 lg:flex">
        <ul role="list" class="m-0 flex list-none items-center gap-7 p-0">
          <li v-for="item in navItems" :key="item.href">
            <NuxtLink :to="localePath({ path: item.href })"
              class="app-header__link relative no-underline font-ui text-xs uppercase tracking-label text-white/80 transition-colors duration-200 hover:text-cia-blue-soft focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3"
              :class="{ 'app-header__link--active': isActive(item.href) }">
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>

        <!-- Language switcher -->
        <button v-if="otherLocale"
          class="cursor-pointer border-none bg-transparent font-ui text-xs uppercase tracking-label text-white/60 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3"
          :aria-label="`Switch to ${otherLocale.name}`" @click="setLocale(otherLocale.code)">
          {{ otherLocale.code.toUpperCase() }}
        </button>

        <!-- Primary CTA -->
        <Button v-if="navCta" variant="default" size="sm" :href="localePath({ path: navCta.href })">
          {{ navCta.label }}
        </Button>
      </nav>

      <!-- Hamburger (mobile) -->
      <button data-hamburger
        class="flex cursor-pointer flex-col gap-1.5 rounded border-none bg-transparent p-1.5 lg:hidden focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3"
        :aria-expanded="isMenuOpen" :aria-label="t('a11y.openMenu')" @click="openMenu">
        <span class="block h-0.5 w-6 rounded-sm bg-white" />
        <span class="block h-0.5 w-6 rounded-sm bg-white" />
        <span class="block h-0.5 w-6 rounded-sm bg-white" />
      </button>
    </div>

    <!-- Mobile overlay menu -->
    <Teleport to="body">
      <div v-if="isMenuOpen" ref="menu" role="dialog" aria-modal="true" :aria-label="t('a11y.mainNav')"
        class="fixed inset-0 z-200 flex-col items-start justify-center gap-12 bg-ink p-8" style="display: none"
        @keydown="onMenuKeydown">
        <!-- Close -->
        <button data-close
          class="absolute right-6 top-6 cursor-pointer rounded border-none bg-transparent p-2 text-2xl leading-none text-white/70 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3"
          :aria-label="t('a11y.closeMenu')" @click="closeMenu">
          <span aria-hidden="true">✕</span>
        </button>

        <nav ref="navItems" :aria-label="t('a11y.mainNav')">
          <ul role="list" class="m-0 flex list-none flex-col gap-6 p-0">
            <li v-for="item in navItems" :key="item.href" class="header-menu__item">
              <NuxtLink :to="localePath({ path: item.href })"
                class="header-menu__link font-display text-h2 font-bold tracking-display no-underline text-white/80 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-4"
                :class="{ 'header-menu__link--active': isActive(item.href) }" @click="closeMenu">
                {{ item.label }}
              </NuxtLink>
            </li>
            <li v-if="navCta" class="header-menu__item">
              <Button variant="default" size="lg" :href="localePath({ path: navCta.href })" @click="closeMenu">
                {{ navCta.label }}
              </Button>
            </li>
          </ul>
        </nav>

        <!-- Language (mobile) -->
        <button v-if="otherLocale"
          class="cursor-pointer border-none bg-transparent font-ui text-xs uppercase tracking-label text-white/50 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3"
          :aria-label="`Switch to ${otherLocale.name}`" @click="setLocale(otherLocale.code)">
          {{ locale.toUpperCase() }} / {{ otherLocale.code.toUpperCase() }}
        </button>
      </div>
    </Teleport>
  </header>
</template>

<style scoped>
/* Toggled by JS: el.classList.add('app-header--scrolled') — backdrop-filter needs CSS */
.app-header--scrolled {
  background-color: rgba(28 28 26 / 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 1px 0 rgba(255 255 255 / 0.06);
}

/* Gold underline pseudo-element on desktop nav links */
.app-header__link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 1.5px;
  background-color: var(--color-gold);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s ease;
}

.app-header__link--active {
  color: #fff;
}

.app-header__link--active::after {
  transform: scaleX(1);
}

/* Mobile menu active state */
.header-menu__link--active {
  color: var(--color-cia-blue-soft);
}
</style>
