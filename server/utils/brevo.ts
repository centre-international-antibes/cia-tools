import crypto from 'node:crypto';

/**
 * Minimal typed wrapper around the Brevo (Sendinblue) transactional API.
 * We hand-craft the fetch calls to avoid the heavy official SDK.
 *
 * Rate limit: the official limit is ~100 req/s. We apply a conservative
 * client-side throttle of 10 req/s to protect against bursts.
 */

const BREVO_API_BASE = 'https://api.brevo.com/v3';
const MIN_INTERVAL_MS = 100; // 10 req/s

let lastRequestAt = 0;

export class BrevoError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly payload?: unknown;

  constructor(message: string, statusCode: number, code?: string, payload?: unknown) {
    super(message);
    this.name = 'BrevoError';
    this.statusCode = statusCode;
    this.code = code;
    this.payload = payload;
  }
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function brevoFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  await throttle();

  const res = await fetch(`${BREVO_API_BASE}${path}`, {
    ...init,
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const body = (parsed ?? {}) as { code?: string; message?: string };
    throw new BrevoError(
      body.message ?? `Brevo request failed (${res.status})`,
      res.status,
      body.code,
      parsed,
    );
  }

  return parsed as T;
}

export interface SendTransacEmailInput {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender: { email: string; name?: string };
  replyTo?: { email: string; name?: string };
  /** Custom message-id-like headers for downstream correlation. */
  headers?: Record<string, string>;
  /** Brevo "tags" appear in webhook events. */
  tags?: string[];
  /** Used to suppress duplicate sends in case of retries. */
  messageId?: string;
}

export interface SendTransacEmailResult {
  messageId: string;
}

export async function sendTransacEmail(
  apiKey: string,
  input: SendTransacEmailInput,
): Promise<SendTransacEmailResult> {
  const result = await brevoFetch<{ messageId: string }>(apiKey, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { messageId: result.messageId };
}

/**
 * Verifies a Brevo webhook by recomputing the HMAC-SHA256 signature of the raw
 * body using the shared secret. Brevo does not natively sign webhooks, so we
 * append a `?secret=...` query param when registering the webhook URL OR use
 * the bearer token model. We support both: header `x-brevo-signature` (custom
 * proxy) OR query param `secret`.
 */
export function verifyBrevoWebhook(
  rawBody: string,
  secret: string,
  signatureHeader: string | null,
  querySecret: string | null,
): boolean {
  if (!secret) return false;

  // Path 1: shared secret in query string (simplest deployment model).
  if (querySecret && timingSafeEqual(querySecret, secret)) return true;

  // Path 2: HMAC signature.
  if (signatureHeader) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return timingSafeEqual(signatureHeader, expected);
  }

  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
