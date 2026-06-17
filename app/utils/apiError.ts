/**
 * Normalised shape returned by Nuxt's `$fetch` when a server endpoint throws
 * `createError({ statusCode, statusMessage, data })`. We expose a typed helper
 * so UI code doesn't have to repeat the `unknown` narrowing dance.
 */
export interface ApiErrorDetails {
  statusCode: number;
  statusMessage: string;
  message: string;
  code?: string;
  data?: unknown;
}

export function extractApiError(err: unknown): ApiErrorDetails {
  if (typeof err === 'object' && err !== null) {
    const e = err as {
      statusCode?: number;
      statusMessage?: string;
      message?: string;
      data?: { code?: string; message?: string; statusMessage?: string; [k: string]: unknown };
    };
    return {
      statusCode: e.statusCode ?? 0,
      statusMessage: e.statusMessage ?? e.data?.statusMessage ?? 'Error',
      message: e.data?.message ?? e.message ?? 'Unexpected error',
      code: e.data?.code,
      data: e.data,
    };
  }
  return {
    statusCode: 0,
    statusMessage: 'Error',
    message: err instanceof Error ? err.message : String(err),
  };
}
