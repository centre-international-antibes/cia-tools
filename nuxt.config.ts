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
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      brand: {
        logoUrl:
          process.env.NUXT_PUBLIC_BRAND_LOGO_URL
          || 'https://www.cia-france.com/media/3339/logo-cia-horizontal_1151x320.png',
        companyName: process.env.NUXT_PUBLIC_BRAND_COMPANY_NAME || "Centre International d'Antibes",
        legalName: process.env.NUXT_PUBLIC_BRAND_LEGAL_NAME || 'SAS CENTRE INTERNATIONAL ANTIBES',
        addressLine1: process.env.NUXT_PUBLIC_BRAND_ADDRESS_LINE1 || "38 Boulevard d'Aguillon",
        addressLine2: process.env.NUXT_PUBLIC_BRAND_ADDRESS_LINE2 || '',
        postalCode: process.env.NUXT_PUBLIC_BRAND_POSTAL_CODE || '06600',
        city: process.env.NUXT_PUBLIC_BRAND_CITY || 'Antibes',
        country: process.env.NUXT_PUBLIC_BRAND_COUNTRY || 'France',
        phone: process.env.NUXT_PUBLIC_BRAND_PHONE || '+33 4 92 90 71 72',
        websiteUrl: process.env.NUXT_PUBLIC_BRAND_WEBSITE_URL || 'https://www.cia-france.com',
        websiteLabel: process.env.NUXT_PUBLIC_BRAND_WEBSITE_LABEL || 'www.cia-france.com',
        supportEmail: process.env.NUXT_PUBLIC_BRAND_SUPPORT_EMAIL || 'direct5@cia-france.com',
        replyToEmail:
          process.env.NUXT_PUBLIC_BRAND_REPLY_TO_EMAIL
          || process.env.BREVO_REPLY_TO
          || 'direct5@cia-france.com',
        termsUrl:
          process.env.NUXT_PUBLIC_BRAND_TERMS_URL
          || 'https://www.cia-france.com/terms-and-conditions',
        taglineFr:
          process.env.NUXT_PUBLIC_BRAND_TAGLINE_FR
          || 'Apprendre, échanger, découvrir... 40 ans de partage autour du français !',
        taglineEn:
          process.env.NUXT_PUBLIC_BRAND_TAGLINE_EN
          || 'Learn, share, discover... 40 years of sharing the French language!',
        iban: process.env.NUXT_PUBLIC_BRAND_IBAN || 'FR63 3000 2032 3100 0007 4097 Y88',
        bic: process.env.NUXT_PUBLIC_BRAND_BIC || 'CRLYFRPP',
        bankName: process.env.NUXT_PUBLIC_BRAND_BANK_NAME || '',
        signatureName: process.env.NUXT_PUBLIC_BRAND_SIGNATURE_NAME || 'Back Office Team',
      },
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
        'clsx',
        'reka-ui',
        'tailwind-merge',
        'vue-sonner',
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