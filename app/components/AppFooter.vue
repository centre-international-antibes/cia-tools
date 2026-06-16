<script setup lang="ts">
const props = defineProps<{
  footer?: {
    navLinks?: Array<{ label: string; href: string }>
    legalLinks?: Array<{ label: string; href: string }>
  }
  site?: {
    tagline?: string
    email?: string
    linkedin?: string
  }
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const year = new Date().getFullYear()

const footerNavLinks = computed(() => props.footer?.navLinks ?? [])
const footerLegalLinks = computed(() => props.footer?.legalLinks ?? [])
const siteTagline = computed(() => props.site?.tagline)
const siteEmail = computed(() => props.site?.email)
const siteLinkedin = computed(() => props.site?.linkedin)
</script>

<template>
  <footer class="bg-ink text-white/70" aria-label="Pied de page">
    <div ref="columns"
      class="mx-auto grid max-w-container grid-cols-1 gap-12 px-8 pb-12 pt-20 sm:grid-cols-2 lg:grid-cols-footer lg:gap-16">
      <!-- Col 1 — Logo + tagline -->
      <div class="footer__col">
        <NuxtLink :to="localePath('index')"
          class="mb-5 inline-block focus-visible:rounded focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-4"
          aria-label="CIA — accueil">
        <Icon name="cia:logo" class="w-48 h-auto text-white" mode="svg" />
        </NuxtLink>
        <p class="m-0 max-w-[22ch] font-display text-sm font-light leading-heading text-white/55">{{ siteTagline }}
        </p>
      </div>

      <!-- Col 2 — Navigation -->
      <nav class="footer__col" :aria-label="t('footer.nav')">
        <p class="m-0 mb-5 font-ui text-xs uppercase tracking-label text-white/40">{{ t('footer.nav') }}</p>
        <ul role="list" class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="link in footerNavLinks" :key="link.href">
            <NuxtLink :to="localePath({ path: link.href })"
              class="font-body text-sm text-white/65 no-underline transition-colors duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3">
              {{ link.label }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <!-- Col 3 — Contact -->
      <div class="footer__col">
        <p class="m-0 mb-5 font-ui text-xs uppercase tracking-label text-white/40">{{ t('footer.contact') }}</p>
        <ul role="list" class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-if="siteEmail">
            <a :href="`mailto:${siteEmail}`"
              class="font-body text-sm text-white/65 no-underline transition-colors duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3">{{
                siteEmail }}</a>
          </li>
          <li v-if="siteLinkedin">
            <a :href="siteLinkedin"
              class="font-body text-sm text-white/65 no-underline transition-colors duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3"
              target="_blank" rel="noopener noreferrer">
              LinkedIn
              <span class="sr-only">(ouvre un nouvel onglet)</span>
            </a>
          </li>
          <li class="mt-2">
            <Button variant="default" size="sm" :href="localePath('contact')">
              {{ t('footer.contact') }}
            </Button>
          </li>
        </ul>
      </div>

      <!-- Col 4 — Legal -->
      <div class="footer__col">
        <p class="m-0 mb-5 font-ui text-xs uppercase tracking-label text-white/40">{{ t('footer.legal') }}</p>
        <ul role="list" class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="link in footerLegalLinks" :key="link.href">
            <NuxtLink :to="localePath({ path: link.href })"
              class="font-body text-sm text-white/65 no-underline transition-colors duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-cia-blue focus-visible:outline-offset-3">
              {{ link.label }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>
    <!-- Bottom bar -->
    <div class="mx-auto max-w-container border-t border-white/10 px-8 py-6">
      <p class="m-0 font-body text-xs text-white/35">
        {{ t('footer.copyright', { year }) }}
      </p>
    </div>
  </footer>
</template>

<style scoped></style>
