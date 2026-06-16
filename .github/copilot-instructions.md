# Copilot Instructions — cia-tools

## What this repo is
A backoffice containing tools to faciliate the work of the CIA team. Bulk emailing, bulk PDF generation, and other utilities to be added over time.
Built with Nuxt 4, Tailwind CSS, and TypeScript.

## Key conventions
- **Nuxt 4 `app/` directory** — all frontend code is under `app/`, not project root
- **i18n for UI** — `t('key')` use different files depending on the scope of the translation: Global for form field labels, ARIA/accessibility strings, validation error messages, and loading/state strings, vs page-specific for any text that appears in the page content (e.g. a "Read more" link at the end of an auto-truncated case study excerpt).
- **TypeScript strict** — `strict: true` + `typeCheck: true`. Build fails on TS errors.


## Build — validated working sequence

```bash
# 1. Install dependencies (always run after cloning or pulling)
npm install

# 2. Rebuild native module (required if Node version changes)
npm rebuild better-sqlite3

# 3. Generate Nuxt types + .nuxt/eslint.config.mjs (required before lint)
npm run postinstall   # runs: nuxt prepare

# 4. Production build (~5 min) — outputs to .output/
npm run build

# 5. Dev server
npm run dev           # http://localhost:3000
```

**Build takes ~5 minutes end-to-end.** The Nitro server bundle step (after client+server Vite builds) is the slow part (~4.5 min).


## Lint

```bash
# Must run AFTER npm run postinstall (needs .nuxt/eslint.config.mjs)
npx eslint .
```

ESLint config: `eslint.config.mjs` — uses `@nuxt/eslint` flat config + `eslint-config-prettier`. Rules: `max-len` 120, `no-console` off, `vue/no-multiple-template-root` off.

Prettier config: `.prettierrc` — single quotes, trailing commas, 100 char width, LF line endings, `prettier-plugin-tailwindcss`.

## Tests

```bash
npx vitest run          # unit tests (happy-dom)
npx playwright test     # e2e tests
```

Test files: `tests/unit/`, `tests/e2e/`. Currently empty (placeholder `.gitkeep` only).


## Nuxt modules registered (nuxt.config.ts)
`@nuxt/content`, `@nuxt/image`, `@nuxt/icon`, `@nuxt/fonts`, `@nuxt/scripts`, `@nuxtjs/i18n`, `@nuxtjs/color-mode`, `@nuxtjs/seo`, `@pinia/nuxt`, `@nuxt/eslint`


### When to use scoped `<style>` vs Tailwind

Use scoped CSS **only** when Tailwind cannot express the rule:
- `::before` / `::after` pseudo-elements
- `:deep()` child selectors (Vue SFC only)
- `@keyframes` animations
- `backdrop-filter` + JS-toggled class combinations
- `color-mix()` with CSS variable fallbacks (`var(--accent, var(--color-cia-blue))`)
- `background: linear-gradient(...)` / `radial-gradient(...)` with CSS vars
- `writing-mode`, sub-pixel values (1.5px), em-based positioning
- `fr`-ratio grid layouts (`55fr 45fr` — not expressible as Tailwind fractions)

Every scoped CSS rule must have a one-line comment explaining why Tailwind cannot replace it.

## Trust these instructions
Do not re-explore the repo structure unless the information above appears to be missing or incorrect. All architectural decisions are documented here.
