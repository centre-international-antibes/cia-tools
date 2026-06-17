import type { H3Event$Fetch } from 'nitropack/types';
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
 */
export function useApi(): H3Event$Fetch {
  return useRequestFetch();
}
