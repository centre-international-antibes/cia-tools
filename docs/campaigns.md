# Campaigns subsystem

End-to-end operator guide for the email campaign engine living under
`/dashboard/campaigns`.

## Architecture overview

```
┌──────────────────────┐   upload   ┌──────────────────────┐
│  Matrix / Payzen     │ ─────────► │  campaign_lists +    │
│  Excel/CSV export    │            │  campaign_contacts   │
└──────────────────────┘            └──────────┬───────────┘
                                               │ prepare
                                               ▼
┌──────────────────────┐  render   ┌──────────────────────┐
│  email_templates +   │ ────────► │  campaign_recipients │ ─► Brevo
│  email_template_     │           │  (per-contact bag    │      │
│  versions (MJML)     │           │   of Handlebars vars)│      ▼
└──────────────────────┘           └──────────────────────┘   email_events
                                                                (webhook)
```

Every campaign is one `(kind, list, template_version)` tuple. Kinds are
declared in **one** server-side registry (`server/utils/campaignKinds.ts`)
which controls: required columns, eligibility detection, suppression
reasons, default variant, and the params bag passed to the template
renderer.

## Email layout & branding

All templates share a single MJML wrapper:

- `server/utils/mjml/layout.ts` — header (logo + brand divider), body slot,
  footer (signature, address, phone, web, unsubscribe).
- `server/utils/mjml/partials.ts` — reusable MJML fragments (`paymentCtaButton`,
  `bankBlock`, `urgentBanner`, `documentChecklist`, `paragraph`, `heading`).
- `server/utils/mjml/tokens.ts` — color & typography tokens. System font
  stack only (no remote font fetch → better deliverability).

The wrapper is **content-agnostic**: brand identity (logo URL, phone,
support email, IBAN, tagline, unsubscribe destination, etc.) is sourced
from `runtimeConfig.public.brand.*` and injected into the Handlebars
params bag at render time. Every variable is prefixed `brand_` to avoid
collisions with kind-specific vars. See `server/utils/brand.ts`.

To rebrand the emails for a different deployment, set the
`NUXT_PUBLIC_BRAND_*` env vars listed in `.env.example` — no code change
needed.

## Default templates

Default MJML lives under `server/utils/mjml/templates/`. Each kind maps
to one or more `variant × language` files:

- **`ats.ts`** — finalised: `junior` (parents, with/without housing) and
  `adult` (residence vs family, with/without transfer, Aragon-aware).
- **`paymentReminder.ts`** — finalised: `first` (neutral), `second`
  (urgent, 72h deadline), `third` (final notice, auto-cancellation +
  penalties + T&Cs link).
- All other kinds — minimal stubs (`stubs.ts`) for layout-correct
  starting points. Operators clone + edit from the dashboard.

### Seeding defaults into the database

After every `supabase db reset` or fresh environment, run:

```bash
npm run seed:templates
```

The seeder is idempotent:

- Missing `(kind, variant, language)` row → creates template + v1.
- MJML matches latest version → no-op.
- MJML differs → creates v(N+1) and activates it.
- Description starts with `[custom]` → skipped (locks the row).

There is also an admin-only HTTP endpoint:
`POST /api/admin/seed-templates`.

## ATS — conditional matrix

The `ats` parser computes the following eligibility flags from the ERP
columns (see `headerMap.ts` for FR header aliases):

| Source column | Canonical | Effect |
| --- | --- | --- |
| `Type` (`A` / `J`) | `audience_tag` | Picks `junior` or `adult` variant |
| `Hébergement` | `housing_residence` | Drives `has_housing`, `is_aragon`, residence/family selection |
| `Type Héb.` (`F` / `R`) | `housing_type` | Drives `is_family` / `is_residence` |
| `Transfert` (`X`) | `transfer` | Drives `needs_transfer` |
| `Ats`, `Fiche San.`, `Passeport` | `ats_done`, `health_form_done`, `passport_done` | Empty cell = missing; any value (OK, date, …) = on file |

> `Règle Ats` is **ignored** — it carries internal going-out rules, not
> email triggers.

The server then populates the kind params bag:

- **Junior** — server-built `missing_documents` array (only items still
  outstanding), plus the correct `pre_arrival_url` for
  `(language × has_housing)`:
  - FR with housing → `/media-file/900/documents-avant-arrivee-francais.pdf`
  - FR without housing → `/media-file/1748/documents-avant-arrivee-sans-hebergement.pdf`
  - EN with housing → `/media-file/901/pre-arrival-documents-english.pdf`
  - EN without housing → `/media-file/1749/pre-arrival-documents-without-accommodation.pdf`
- **Adult** — boolean flags drive Handlebars conditionals in the single
  adult template: `needs_transfer`, `is_family`, `is_residence`,
  `is_aragon`. One variant, four flows in conditionals.

## Payment reminder — 3-cycle workflow

A "cycle" tracks one outstanding balance through the dunning workflow.
Each cycle is keyed on `proforma` (one open cycle per proforma at a time
— enforced by a partial unique index).

### Lifecycle

1. **First upload** — operator imports the Payzen export. The parser
   creates a `campaign_contacts` row per outstanding proforma. The
   sender opens a `payment_reminder_cycles` row at `stage=1`, generates
   a Payzen payment link, sends the `first` variant.
2. **Second upload** — operator imports the new Payzen export. The
   `PaymentReminderUploader` UI shows the **proforma diff**:
   - `closed` — balance now settled in the new export.
   - `advanced` — still outstanding, `Relance N` column moved.
   - `unchanged` — still outstanding, no progression yet.
   - `new` — proformas absent from the previous list.
   - `missing` — proformas absent from the new list (default: cycle
     stays `open`, operator decides what to do).

   The "Refresh Payzen statuses" button polls Payzen's `Order/Get` for
   every open cycle's link and closes paid cycles automatically.

   Sending the campaign progresses the cycle to `stage=2` and reuses the
   same Payzen payment URL (key: `payment_links.raw.proforma`).

3. **Third upload** — same flow, cycle bumps to `stage=3`, sends the
   final variant.

### Suppression rules

- Negative balance → `do_not_contact` (refund / credit note).
- Zero balance → `missing_data`.
- "ne pas relancer" / "Avoir n°" in notes → `do_not_contact` +
  `credit_note`.
- Customer type ≠ `DIRECT` → `wrong_client_type`.

## Duplicate emails

The parser never dedups on email. Two siblings sharing a parent's inbox
are both kept — each as its own contact. The database constraints that
used to block this (`(list_id, email)` on `campaign_contacts` and
`(campaign_id, email)` on `campaign_recipients`) have been dropped.

`group_key` still drives multi-row aggregation for kinds that opt in
(e.g. `housing_confirmation.groupRows` merges siblings sharing a stable
`client_id`). Kinds without a `client_id` column (ATS) assign a per-row
`group_key` so each upload line stays distinct.

## Adding a new kind

1. Add the enum value in a new migration (`ALTER TYPE
   public.campaign_kind ADD VALUE 'foo'`) then regenerate types.
2. Add an entry in `server/utils/campaignKinds.ts` (`requiredColumns`,
   `parseRow`, `resolveVariant`, `buildParams`, optionally `groupRows`).
3. Add header aliases under `ALIASES.foo` in
   `server/utils/headerMap.ts`.
4. Add a scope entry in `app/utils/campaignScopes.ts`.
5. Add an MJML template file under
   `server/utils/mjml/templates/foo.ts` and wire it in `index.ts`.
6. Add FR + EN labels under `locales/<lang>/campaigns.json`.
7. Run `npm run seed:templates`.

## Webhooks

- **Brevo**: `POST /api/webhooks/brevo` — shared secret in URL or HMAC
  header. Updates `campaign_recipients.status` per the precedence rules.
- **Payzen**: `POST /api/webhooks/payzen` — HMAC-SHA256 on `kr-answer`.
  Closes payment cycles when an `Order/Get` reflects a paid state.
