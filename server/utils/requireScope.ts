import type { H3Event } from 'h3';
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server';

export const ScopeAuthErrorCode = {
  NotAuthenticated: 'AUTH_NOT_AUTHENTICATED',
  ProfileFetchFailed: 'AUTH_PROFILE_FETCH_FAILED',
  ProfileNotFound: 'AUTH_PROFILE_NOT_FOUND',
  ScopeDenied: 'AUTH_SCOPE_DENIED',
} as const;

export type ScopeAuthErrorCode =
  (typeof ScopeAuthErrorCode)[keyof typeof ScopeAuthErrorCode];

/**
 * Resolves the caller's profile and asserts they hold the requested scope.
 * Admins are always allowed. Returns the authenticated supabase user, service-
 * role client and profile so the caller doesn't have to refetch them.
 */
export async function requireScope(event: H3Event, scope: string) {
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
      data: { code: ScopeAuthErrorCode.NotAuthenticated },
    });
  }

  const client = serverSupabaseServiceRole(event);

  const { data: profile, error } = await client
    .from('profiles')
    .select('id, role, scopes, email, full_name')
    .eq('id', user.sub)
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Profile lookup failed',
      message: error.message,
      data: { code: ScopeAuthErrorCode.ProfileFetchFailed, userId: user.sub },
    });
  }

  if (!profile) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Profile not found',
      message: 'No profile row exists for the authenticated user.',
      data: { code: ScopeAuthErrorCode.ProfileNotFound, userId: user.sub },
    });
  }

  const allowed = profile.role === 'admin' || profile.scopes.includes(scope);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient scope',
      message: `Scope "${scope}" required.`,
      data: { code: ScopeAuthErrorCode.ScopeDenied, scope, userId: user.sub },
    });
  }

  return { user, client, profile };
}

/** Same as requireScope but accepts a list — the caller needs ANY of them. */
export async function requireAnyScope(event: H3Event, scopes: string[]) {
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required.',
      data: { code: ScopeAuthErrorCode.NotAuthenticated },
    });
  }

  const client = serverSupabaseServiceRole(event);
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, role, scopes, email, full_name')
    .eq('id', user.sub)
    .single();

  if (error || !profile) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Profile not found',
      message: error?.message ?? 'No profile row exists.',
      data: { code: ScopeAuthErrorCode.ProfileNotFound, userId: user.sub },
    });
  }

  const allowed =
    profile.role === 'admin' || scopes.some((s) => profile.scopes.includes(s));
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient scope',
      message: `One of [${scopes.join(', ')}] required.`,
      data: { code: ScopeAuthErrorCode.ScopeDenied, scopes, userId: user.sub },
    });
  }

  return { user, client, profile };
}
