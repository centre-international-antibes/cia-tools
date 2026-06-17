import crypto from 'node:crypto';

/**
 * Lyra Collect / PayZen REST API client.
 * Authentication: HTTP Basic with `${PAYZEN_USERNAME}:${PAYZEN_PASSWORD}` where
 * username is the shop/site ID and password is the secret key.
 *
 * Docs: https://docs.lyra.com/en/rest/V4.0/api/
 */

export class PayzenError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly payload?: unknown;

  constructor(message: string, statusCode: number, code?: string, payload?: unknown) {
    super(message);
    this.name = 'PayzenError';
    this.statusCode = statusCode;
    this.code = code;
    this.payload = payload;
  }
}

export interface PayzenConfig {
  apiUrl: string;
  username: string;
  password: string;
  hmacKey: string;
  returnUrl?: string;
}

export interface CreatePaymentLinkInput {
  orderId: string;
  amountCents: number;
  currency?: string;
  customer: {
    email: string;
    firstName?: string;
    lastName?: string;
    reference?: string;
  };
  expiresAt?: Date;
  language?: 'fr' | 'en';
}

export interface CreatePaymentLinkResult {
  orderId: string;
  paymentUrl: string;
  expiresAt: string | null;
  raw: unknown;
}

async function payzenFetch<T>(
  cfg: PayzenConfig,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!cfg.apiUrl || !cfg.username || !cfg.password) {
    throw new PayzenError('Payzen credentials are not configured.', 500, 'PAYZEN_NOT_CONFIGURED');
  }

  const auth = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64');
  const res = await fetch(`${cfg.apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
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
    const b = (parsed ?? {}) as { errorMessage?: string; errorCode?: string };
    throw new PayzenError(
      b.errorMessage ?? `Payzen request failed (${res.status})`,
      res.status,
      b.errorCode,
      parsed,
    );
  }

  // Lyra REST wraps responses in { status: 'SUCCESS' | 'ERROR', answer: {...} }.
  const wrapped = parsed as { status?: string; answer?: T; errorMessage?: string };
  if (wrapped?.status && wrapped.status !== 'SUCCESS') {
    throw new PayzenError(
      wrapped.errorMessage ?? 'Payzen returned an error',
      400,
      'PAYZEN_ERROR',
      parsed,
    );
  }
  return (wrapped?.answer ?? parsed) as T;
}

/**
 * Generates a hosted payment link via `Charge/CreatePayment` with
 * `formAction: 'PAYMENT'`. Returns the URL we can share with the customer.
 */
export async function createPaymentLink(
  cfg: PayzenConfig,
  input: CreatePaymentLinkInput,
): Promise<CreatePaymentLinkResult> {
  const body: Record<string, unknown> = {
    amount: input.amountCents,
    currency: input.currency ?? 'EUR',
    orderId: input.orderId,
    formAction: 'PAYMENT',
    customer: {
      email: input.customer.email,
      reference: input.customer.reference,
      billingDetails: {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        language: input.language?.toUpperCase() ?? 'FR',
      },
    },
  };

  if (input.expiresAt) body.expirationDate = input.expiresAt.toISOString();
  if (cfg.returnUrl) body.formTokenOptions = { returnUrl: cfg.returnUrl };

  type Answer = {
    formToken?: string;
    _links?: { paymentUrl?: string };
    paymentUrl?: string;
    expirationDate?: string;
  };

  const answer = await payzenFetch<Answer>(cfg, '/Charge/CreatePayment', body);
  const url = answer.paymentUrl ?? answer._links?.paymentUrl ?? '';

  if (!url) {
    throw new PayzenError(
      'Payzen response did not contain a payment URL.',
      500,
      'PAYZEN_NO_URL',
      answer,
    );
  }

  return {
    orderId: input.orderId,
    paymentUrl: url,
    expiresAt: answer.expirationDate ?? null,
    raw: answer,
  };
}

export interface PayzenOrderStatus {
  orderId: string;
  status: 'paid' | 'pending' | 'expired' | 'failed';
  paidAt: string | null;
  raw: unknown;
}

export async function getOrderStatus(
  cfg: PayzenConfig,
  orderId: string,
): Promise<PayzenOrderStatus> {
  type Transaction = {
    status?: string;
    detailedStatus?: string;
    creationDate?: string;
  };
  type Answer = { transactions?: Transaction[] };

  const answer = await payzenFetch<Answer>(cfg, '/Order/Get', { orderId });
  const tx = answer.transactions?.[0];
  const upstream = (tx?.status ?? '').toUpperCase();
  const status: PayzenOrderStatus['status'] =
    upstream === 'PAID' || upstream === 'AUTHORISED'
      ? 'paid'
      : upstream === 'EXPIRED'
        ? 'expired'
        : upstream === 'UNPAID' || upstream === 'CANCELLED' || upstream === 'REFUSED'
          ? 'failed'
          : 'pending';

  return {
    orderId,
    status,
    paidAt: status === 'paid' ? (tx?.creationDate ?? null) : null,
    raw: answer,
  };
}

/**
 * Verifies the IPN signature Lyra sends in `kr-hash`, computed as
 * HMAC-SHA256(answer-string, hmacKey) when the `kr-hash-algorithm` header is
 * `sha256_hmac`.
 */
export function verifyPayzenIpn(
  rawAnswer: string,
  hmacKey: string,
  signature: string | null,
): boolean {
  if (!signature || !hmacKey) return false;
  const expected = crypto.createHmac('sha256', hmacKey).update(rawAnswer).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
