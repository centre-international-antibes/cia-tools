import type { $Fetch, FetchOptions } from 'ofetch';

// Minimal call signature decouples consumers from Nitro's generated route
// table, which on this project pushes TS past its recursion limit when
// composed with deep DB row types (TS2589 / TS2321).
type ApiFetch = <T>(request: string, opts?: FetchOptions) => Promise<T>;
/**
 * Centralized HTTP client for the frontend.
 *
 * Wraps `useRequestFetch()` so calls made during SSR forward the incoming
 * request's cookies. Without this, `$fetch('/api/...')` runs server-side
 * without the user's Supabase session cookie, `serverSupabaseUser(event)`
 * returns null, and every `requireScope` / `requireAnyScope` guard throws 401.
 *
 * On the client it's a plain `$fetch`.
 *
 * Always use this composable for internal API calls; never reach for the
 * global `$fetch` in user-facing code.
 *
 * Must be invoked from a Vue setup context (component, composable, plugin).
 *
 * Typed as plain `$Fetch` rather than Nitro's `H3Event$Fetch` because the
 * latter's route-table inference blows past TS's recursion limit on this
 * project (TS2321 "excessive stack depth").
 */
export function useApi(): ApiFetch {
  return useRequestFetch() as unknown as ApiFetch;
}

export type { $Fetch };
