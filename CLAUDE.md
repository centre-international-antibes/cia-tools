# CIA Tools

Internal tooling platform for Centre International d'Antibes (CIA) staff.

## Stack

- **Framework**: Nuxt 4.4+ (Vue 3.5, Vue Router 5, TypeScript 6 strict)
- **Backend/Auth**: Supabase (local dev via CLI, `@nuxtjs/supabase` v2)
- **UI**: shadcn-vue (new-york style, reka-ui primitives), Tailwind CSS v4 with PostCSS
- **Icons**: `@nuxt/icon` with Lucide + custom `cia:` collection (`app/assets/images/custom-svg/`)
- **i18n**: `@nuxtjs/i18n` — French default (`fr`), English (`en`), strategy `prefix_except_default`
- **Fonts**: Inter via `@nuxt/fonts`
- **Testing**: Vitest
- **Linting**: ESLint via `@nuxt/eslint` + Prettier (single quotes, trailing commas, 100 char width, 2-space tabs)

## Project structure

```
app/
  assets/css/          # main.css (Tailwind v4 + shadcn theme), tokens.css (design tokens)
  components/          # Global components (AppHeader, AppFooter, Cookie*)
    ui/                # shadcn-vue components (auto-registered)
  composables/         # Vue composables (useCookieConsent, useAnalytics*)
  layouts/             # Nuxt layouts (default, auth, dashboard)
  lib/utils.ts         # cn() utility for class merging
  middleware/           # Route middleware (guest, admin)
  pages/               # File-based routing
  plugins/             # Nuxt plugins (ssr-width)
  server/              # Nitro server routes + utilities
    api/admin/         # Admin-only API endpoints (service role key)
    utils/             # Server-side helpers (requireAdmin)
  stores/              # Pinia stores (if needed)
  types/               # TypeScript type definitions
  utils/               # Shared utilities
locales/               # i18n JSON files (fr/, en/)
supabase/
  config.toml          # Local Supabase config
  migrations/          # SQL migrations (ordered timestamps)
```

## Commands

```bash
npm run dev              # Start Nuxt dev server (http://localhost:3000)
npm run build            # Production build
npx supabase start       # Start local Supabase (Docker required)
npx supabase stop        # Stop local Supabase
npx supabase db reset    # Reset DB and re-run all migrations
npx supabase migration new <name>  # Create new migration file
npx shadcn-vue@latest add <component>  # Add shadcn component
```

## Environment variables

```env
SUPABASE_URL=            # Supabase API URL (http://127.0.0.1:54321 for local)
SUPABASE_KEY=            # Supabase anon/public key
NUXT_SUPABASE_SECRET_KEY=  # Supabase service_role key (server-side only, never expose to client)
```

## Auth & RBAC

- Authentication via Supabase Auth (email/password only, no OAuth)
- No public signup — users created by admins only via `/admin`
- `@nuxtjs/supabase` handles session management and auto-redirects unauthenticated users to `/login`
- Routes excluded from auth: `/`, `/confirm`, `/forgot-password`, `/legal`, `/privacy-policy`, `/terms-of-service`
- Database table `public.profiles` extends `auth.users` with `role` (enum: `admin`, `user`) and `scopes` (text array)
- RLS on `profiles`: users read own row, admins full CRUD
- Admin API routes (`server/api/admin/`) use `serverSupabaseServiceRole()` — always verify caller is admin before acting
- Scoped features check `scopes` array (e.g., `relance_ats` for email follow-up)

## Conventions

- **Formatting**: Prettier config — single quotes, trailing commas, 2-space indent, 100 char line width, LF endings
- **Components**: shadcn-vue new-york style, no component prefix. Add via CLI: `npx shadcn-vue@latest add <name>`
- **CSS**: Use Tailwind utility classes. Custom tokens in `tokens.css` under `@theme {}`. shadcn theme variables in `main.css`
- **i18n**: All user-facing strings in `locales/{lang}/global.json`. Access via `useI18n()` / `$t()`. Keep FR and EN in sync
- **Layouts**: `auth` for login/forgot-password (minimal centered card), `dashboard` for authenticated pages (top nav + content)
- **Middleware**: `guest` (redirect authed users away from login), `admin` (enforce admin role on `/admin` routes)
- **Server routes**: Use `serverSupabaseUser()` for auth check, `serverSupabaseServiceRole()` for admin operations. Always validate inputs
- **Types**: Strict TypeScript. Define interfaces in `app/types/`. No `any` in production code
- **Supabase migrations**: One migration per logical change. Use `npx supabase migration new <descriptive-name>`

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->