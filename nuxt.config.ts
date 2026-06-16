// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxtjs/i18n',
    '@nuxtjs/supabase',
    'shadcn-nuxt'
  ],

  css: ['~/assets/css/main.css'],

  // ── PostCSS ───────────────────────────────────────────
  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
    },
  },


  // ── Nuxt Image ───────────────────────────────────────
  image: {
    format: ['webp', 'avif', 'svg'],
    quality: 80,
    screens: {
      mobile: 375,
      tablet: 768,
      desktop: 1280,
      wide: 1440,
    },
  },

  // ── Nuxt Icon ────────────────────────────────────────
  icon: {
    serverBundle: {
      collections: ['circle-flags', 'line-md', 'lucide', 'cia'],
    },
    customCollections: [
      {
        dir: './app/assets/images/custom-svg',
        prefix: 'cia',
      },
    ]
  },

  // ── Nuxt Fonts ───────────────────────────────────────
  fonts: {
    families: [
      {
        name: 'Inter',
        provider: 'google',
        weights: [300, 400, 500],
        styles: ['normal'],
        display: 'swap',
        preload: true,
      },
    ],
  },

  // ── Nuxt i18n ────────────────────────────────────────
  i18n: {
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', files: ['fr/global.json'] },
      { code: 'en', language: 'en-GB', name: 'English', files: ['en/global.json'] },
    ],
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    langDir: '../locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'cia-i18n',
      redirectOn: 'root',
    },
  },
  // ── Runtime Config ────────────────────────────────────
  runtimeConfig: {
    public: {
      ga4Id: process.env.GA4_ID || '',
      supabase: {
        url: process.env.SUPABASE_URL || '',
        key: process.env.SUPABASE_KEY || '',
      }
    },
  },

  // ── Nuxt Supabase ───────────────────────────────────
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: undefined,
      exclude: ['/', '/register', '/forgot-password', '/legal', '/privacy-policy', '/terms-of-service'],
      saveRedirectToCookie: false,
    }
  },

  // ── Shadcn Nuxt ───────────────────────────────────────
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui'
  },

  // ── Vite ─────────────────────────────────────────────
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        '@vueuse/core',
      ]
    },
  },

  // ── TypeScript ────────────────────────────────────────
  typescript: {
    strict: true,
    typeCheck: false,
  },

})