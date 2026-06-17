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
      {
        code: 'fr',
        language: 'fr-FR',
        name: 'Français',
        files: ['fr/common.json', 'fr/auth.json', 'fr/admin.json', 'fr/campaigns.json'],
      },
      {
        code: 'en',
        language: 'en-GB',
        name: 'English',
        files: ['en/common.json', 'en/auth.json', 'en/admin.json', 'en/campaigns.json'],
      },
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
    brevo: {
      apiKey: process.env.BREVO_API_KEY || '',
      webhookSecret: process.env.BREVO_WEBHOOK_SECRET || '',
      senderEmail: process.env.BREVO_SENDER_EMAIL || '',
      senderName: process.env.BREVO_SENDER_NAME || '',
      replyTo: process.env.BREVO_REPLY_TO || '',
    },
    payzen: {
      apiUrl: process.env.PAYZEN_API_URL || 'https://api.lyra.com/api-payment/V4',
      username: process.env.PAYZEN_USERNAME || '',
      password: process.env.PAYZEN_PASSWORD || '',
      hmacKey: process.env.PAYZEN_HMAC_KEY || '',
      returnUrl: process.env.PAYZEN_RETURN_URL || '',
    },
    public: {
      ga4Id: process.env.GA4_ID || '',
    },
  },

  // ── Nitro ────────────────────────────────────────────
  nitro: {
    experimental: { tasks: true },
  },

  // ── Nuxt Supabase ───────────────────────────────────
  supabase: {
    redirect: false,
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
        '@lucide/vue',
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

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
})