import type { H3Event } from 'h3';
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server';

/**
 * Structured error codes returned by admin auth checks.
 * The frontend uses these to display targeted toasts.
 */
export const AdminAuthErrorCode = {
  NotAuthenticated: 'AUTH_NOT_AUTHENTICATED',
  ProfileFetchFailed: 'AUTH_PROFILE_FETCH_FAILED',
  ProfileNotFound: 'AUTH_PROFILE_NOT_FOUND',
  NotAdmin: 'AUTH_NOT_ADMIN',
} as const;

export type AdminAuthErrorCode = (typeof AdminAuthErrorCode)[keyof typeof AdminAuthErrorCode];

export async function requireAdmin(event: H3Event) {
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required to access this resource.',
      data: { code: AdminAuthErrorCode.NotAuthenticated },
    });
  }

  const client = serverSupabaseServiceRole(event);

  const { data: profile, error } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.sub)
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Profile lookup failed',
      message: `Unable to verify admin role: ${error.message}`,
      data: {
        code: AdminAuthErrorCode.ProfileFetchFailed,
        userId: user.sub,
        supabase: {
          code: error.code,
          details: error.details,
          hint: error.hint,
          message: error.message,
        },
      },
    });
  }

  if (!profile) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Profile not found',
      message: 'No profile row exists for the authenticated user.',
      data: { code: AdminAuthErrorCode.ProfileNotFound, userId: user.sub },
    });
  }

  if (profile.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin role required',
      message: `Role "${profile.role}" is not allowed to access admin resources.`,
      data: { code: AdminAuthErrorCode.NotAdmin, userId: user.sub, role: profile.role },
    });
  }

  return { user, client };
}
