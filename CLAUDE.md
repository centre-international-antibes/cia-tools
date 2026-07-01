# CIA Tools

Internal tooling platform for Centre International d'Antibes (CIA) staff.

## Stack

Nuxt 4.4 (Vue 3.5, TS 6 strict) · Supabase (auth + DB, local via CLI) · shadcn-vue (new-york) + Tailwind v4 · `@nuxt/icon` (Lucide + `cia:` custom) · `@nuxtjs/i18n` (default `fr`, also `en`, `prefix_except_default`) · Vitest · ESLint + Prettier (single quotes, trailing commas, 100 cols, 2 spaces, LF).

## Project structure

```
app/
  assets/css/      # main.css (Tailwind + shadcn), tokens.css
  components/      # global; ui/ = shadcn (auto-registered)
  composables/     # one file per domain (useCampaigns, useUserProfile…)
  layouts/         # default | auth | dashboard
  middleware/      # guest, admin (route)
  pages/           # file-based routing
  types/           # domain interfaces
  utils/           # shared helpers
server/
  api/             # nitro endpoints (api/admin/*, api/campaigns/*, api/webhooks/*)
  utils/           # auto-imported server helpers
locales/<lang>/    # one JSON file per domain (common, auth, admin, campaigns)
supabase/
  config.toml      # local config (storage buckets, etc.)
  migrations/      # SQL migrations (timestamped)
```

## Commands

```bash
npm run dev                                # http://localhost:3000
npm run build                              # production build
npm run test                               # vitest run
npm run generate:schema                    # regenerate types from Supabase
npx supabase start | stop | db reset       # local DB lifecycle
npx supabase migration new <name>          # create migration
npx shadcn-vue@latest add <component>      # add UI primitive
npm run seed:templates                     # seed default MJML templates (idempotent)

# Payzen dev / maintenance
node scripts/test-payzen-webhook.mjs [--order <id>] [--status PAID|EXPIRED|CANCELLED|REFUSED] [--use-password]
                                           # simulate Payzen IPN against local dev server
node scripts/update-payment-orders.mjs [--apply]
                                           # one-shot: update open order IDs + receipt email (dry-run by default)
```

## Environment variables

```env
SUPABASE_URL=                # http://127.0.0.1:54321 in dev
SUPABASE_KEY=                # anon key
NUXT_SUPABASE_SECRET_KEY=    # service_role — server-only
NUXT_PUBLIC_SITE_URL=        # public site origin (defaults to http://localhost:3000)

# Brand identity injected into every transactional email — all NUXT_PUBLIC_BRAND_*
# vars fall back to CIA defaults. See .env.example for the full list.

# Brevo (transactional)
BREVO_API_KEY=
BREVO_WEBHOOK_SECRET=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
BREVO_REPLY_TO=

# Payzen / Lyra
PAYZEN_API_URL=https://api.lyra.com/api-payment/V4
PAYZEN_USERNAME=             # shop / site ID
PAYZEN_PASSWORD=             # secret key
PAYZEN_HMAC_KEY=             # IPN HMAC
PAYZEN_RETURN_URL=
```

## Auth & RBAC

- Supabase Auth, email/password only. No public signup; admins create users at `/admin`.
- `@nuxtjs/supabase` handles sessions and redirects unauthenticated users to `/login`.
- Public routes: `/`, `/confirm`, `/forgot-password`, `/legal`, `/privacy-policy`, `/terms-of-service`.
- `public.profiles` extends `auth.users` with `role` (`admin` | `user`) and `scopes` (`text[]`). RLS: own row read; admins full CRUD.
- Server endpoints use `requireAdmin(event)` or `requireScope(event, scope)` from `server/utils/`. Service-role client is only available server-side.
- Scopes catalog (`app/utils/campaignScopes.ts`): one per campaign kind — `campaign:ats`, `campaign:ats_late_arrival`, `campaign:thanks_direct`, `campaign:test_fr`, `campaign:housing_confirmation`, `campaign:course_location`, `campaign:welcome_pack`, `campaign:payment_reminder`. Admins implicitly hold every scope.

## Campaigns subsystem

Under `/dashboard/campaigns`. Eight kinds share one wizard (list → contacts → template → review → send) and one set of infrastructure tables. Full operator guide: `docs/campaigns.md`.

- **Templates**: MJML stored in `email_templates` + immutable `email_template_versions`. Compiled to HTML server-side. Handlebars handles variable interpolation (`{{first_name}}`, `{{#if ...}}`, `{{#each ...}}`).
- **Lists**: Matrix / Payzen exports (XLSX or CSV) → private bucket `campaign-imports`. Parsed in `server/utils/parseContactsSheet.ts` using per-kind column maps from `server/utils/campaignKinds.ts`.
- **Send pipeline**: `POST /api/campaigns/:id/send` queues the campaign; `runCampaignSend` processes recipients in batches via Brevo. Idempotent + resumable. Recipient status precedence enforced on inbound webhook events. `client_request_id` prevents accidental double-send.
- **Webhooks**: `POST /api/webhooks/brevo` (Brevo "Secured Webhooks" Bearer token in `Authorization` header), `POST /api/webhooks/payzen` (HMAC-SHA256 on `kr-answer`).
- **Test sends**: every wizard step shows a "Send test" button; logged in `test_sends`, never affects stats. Rate-limited 10/min/user.
- **Audit**: `logAudit()` writes every meaningful action to `public.audit_log` (admin-readable).

Kind-specific logic (required columns, eligibility flags, default variant, params builder, optional row grouping) lives in **one** registry: `server/utils/campaignKinds.ts`. Add new kinds by extending it.

- **Layout & defaults**: shared MJML wrapper (`server/utils/mjml/layout.ts`), brand vars injected from `runtimeConfig.public.brand.*` at render time, default MJML templates under `server/utils/mjml/templates/`. Seed defaults into the DB via `npm run seed:templates` (idempotent; templates whose description starts with `[custom]` are skipped).
- **Payment reminder cycles**: `payment_reminder_cycles` tracks one open cycle per proforma. `PaymentReminderUploader.vue` shows a proforma diff between previous and new uploads and exposes a "refresh Payzen statuses" action that closes paid cycles.
- **Payment links**: `payment_links` table stores Payzen orders. `ensurePaymentLinkForContact()` in `server/utils/paymentLinks.ts` creates or reuses an order (5 reuse rules; re-polls Lyra live before reuse to defend against missed IPNs). Reuse key: `proforma` field stored in `raw` JSONB column. `orderId` format: `"${lastName} ${firstName} ${base36_ts}"` (max 64 chars; doubles as back-office display label). Lyra `billingDetails.firstName/lastName` are **intentionally swapped** so the back-office shows "LASTNAME Firstname". IPN at `POST /api/webhooks/payzen` (`application/x-www-form-urlencoded`): `kr-hash-key=password` → verify with `PAYZEN_PASSWORD`; `kr-hash-key=sha256_hmac` → verify with `PAYZEN_HMAC_KEY`.

## Conventions

- **Components**: shadcn-vue, no prefix. Auto-registered from `app/components/`. Add via CLI.
- **Composables**: one file per domain/service (`useCampaigns`, `useUserProfile`, `useToast`). Don't split a domain into many files.
- **CSS**: Tailwind utilities; tokens in `tokens.css` under `@theme`; shadcn theme vars in `main.css`.
- **i18n**: one JSON per domain under `locales/<lang>/` (`common`, `auth`, `admin`, `campaigns`). Declare each file in `nuxt.config.ts` `i18n.locales[].files`. Access via `useI18n()` / `$t()`. Keep FR + EN in sync.
- **Layouts**: `auth` for login flows, `dashboard` for authed pages.
- **Middleware**: `guest` (redirect authed users away from `/login`), `admin` (enforce admin role on `/admin/*`).
- **Server routes**: validate inputs with `zod`. Use `serverSupabaseUser()` for the caller, `serverSupabaseServiceRole()` only when truly elevated. Helpers in `server/utils/` are auto-imported by Nitro — no `import` needed.
- **Types**: strict TS. Domain types in `app/types/`. Regenerate `database.types.ts` after every migration.
- **Supabase migrations**: one migration per logical change, descriptive timestamped name. Never edit an applied migration; write a new one.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer)

Always prefix shell commands with `rtk` (including inside `&&` chains) — if RTK has a filter for the command, output is compressed; otherwise it passes through unchanged. Full reference: `rtk --help`, `rtk gain --history`.

Common wins: `rtk vitest`, `rtk tsc`, `rtk lint`, `rtk git status|log|diff`, `rtk gh pr view`, `rtk npm install`, `rtk ls`, `rtk grep`, `rtk curl`. Run `rtk discover` to spot missed opportunities. Use `rtk proxy <cmd>` to bypass filtering when debugging.
<!-- /rtk-instructions -->
