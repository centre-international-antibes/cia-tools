import crypto from 'node:crypto';

/**
 * PayZen REST API client.
 * Authentication: HTTP Basic with `${PAYZEN_USERNAME}:${PAYZEN_PASSWORD}` where
 * username is the shop/site ID and password is the secret key.
 *
 * Docs: https://docs.lyra.com/en/rest/V4.0/api/
 */

export class PayzenError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly detailedCode?: string;
  readonly detailedMessage?: string;
  readonly endpoint?: string;
  readonly payload?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    payload?: unknown,
    extra?: { detailedCode?: string; detailedMessage?: string; endpoint?: string },
  ) {
    super(message);
    this.name = 'PayzenError';
    this.statusCode = statusCode;
    this.code = code;
    this.detailedCode = extra?.detailedCode;
    this.detailedMessage = extra?.detailedMessage;
    this.endpoint = extra?.endpoint;
    this.payload = payload;
  }

  /** Human-readable summary suitable for logs and recipient.error storage. */
  toDisplayString(): string {
    const parts = [`[Payzen ${this.statusCode}`];
    if (this.code) parts[0] += ` ${this.code}`;
    parts[0] += ']';
    parts.push(this.message);
    if (this.detailedMessage && this.detailedMessage !== this.message) {
      parts.push(`- ${this.detailedMessage}`);
    }
    if (this.detailedCode && this.detailedCode !== this.code) {
      parts.push(`(${this.detailedCode})`);
    }
    if (this.endpoint) parts.push(`@ ${this.endpoint}`);
    return parts.join(' ');
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

  // Payzen REST always wraps responses (success or error) as:
  //   { status: 'SUCCESS' | 'ERROR', answer: { errorCode, errorMessage,
  //     detailedErrorCode, detailedErrorMessage, ...domain fields } }
  // Errors can surface either as HTTP !ok, or HTTP 200 with status === 'ERROR'.
  // We must read errorCode/errorMessage from `answer`, not from the wrapper.
  const wrapped =
    parsed && typeof parsed === 'object'
      ? (parsed as {
        status?: string;
        answer?: T & {
          errorCode?: string;
          errorMessage?: string;
          detailedErrorCode?: string;
          detailedErrorMessage?: string;
          answer?: { errorCode?: string; errorMessage?: string };
        };
      })
      : null;
  const ans = wrapped?.answer as
    | {
      errorCode?: string;
      errorMessage?: string;
      detailedErrorCode?: string;
      detailedErrorMessage?: string;
    }
    | undefined;

  if (!res.ok || (wrapped?.status && wrapped.status !== 'SUCCESS')) {
    const message =
      ans?.errorMessage
      ?? (typeof parsed === 'string' ? parsed : null)
      ?? `Payzen request failed (HTTP ${res.status})`;
    throw new PayzenError(
      message,
      res.ok ? 400 : res.status,
      ans?.errorCode ?? (res.ok ? 'PAYZEN_ERROR' : `HTTP_${res.status}`),
      parsed,
      {
        detailedCode: ans?.detailedErrorCode,
        detailedMessage: ans?.detailedErrorMessage,
        endpoint,
      },
    );
  }

  return (wrapped?.answer ?? parsed) as T;
}

/**
 * Generates a hosted payment link via `Charge/CreatePaymentOrder` with
 * `formAction: 'PAYMENT'`. Returns the URL we can share with the customer.
 */
export async function createPaymentLink(
  cfg: PayzenConfig,
  input: CreatePaymentLinkInput,
): Promise<CreatePaymentLinkResult> {
  const locale = input.language === 'en' ? 'en_GB' : 'fr_FR';
  const body: Record<string, unknown> = {
    amount: input.amountCents,
    currency: input.currency ?? 'EUR',
    orderId: input.orderId,
    formAction: 'PAYMENT',
    locale,
    channelOptions: { channelType: 'URL' },
    customer: {
      email: input.customer.email,
      reference: input.customer.reference,
      billingDetails: {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
      },
    },
  };

  if (input.expiresAt) body.expirationDate = input.expiresAt.toISOString();
  if (cfg.returnUrl) body.returnUrl = cfg.returnUrl;

  interface ChannelDetails {
    channelType: string;
    mailDetails: Record<string, unknown> | null;
    smsDetails: Record<string, unknown> | null;
    whatsAppDetails: Record<string, unknown> | null;
    ivrDetails: Record<string, unknown> | null;
    urlDetails: Record<string, unknown>; // Represents the [Object] in your log
    _type: string;
  }

  interface TransactionDetails {
    cardDetails: Record<string, unknown>; // Represents the [Object] in your log
    installmentDetails: Record<string, unknown> | null;
    transactionUuid: string | null;
    _type: string;
  }

  interface Customer {
    email: string;
    reference: string;
    shippingDetails: Record<string, unknown> | null;
    extraDetails: Record<string, unknown>; // Represents the [Object] in your log
    shoppingCart: Record<string, unknown> | null;
    billingDetails: Record<string, unknown>; // Represents the [Object] in your log
    _type: string;
  }

  interface SubMerchantDetails {
    companyType: string | null;
    legalNumber: string | null;
    name: string | null;
    url: string | null;
    phoneNumber: string | null;
    address1: string | null;
    address2: string | null;
    zip: string | null;
    city: string | null;
    country: string | null;
    mcc: string | null;
    mid: string | null;
    softDescriptor: string | null;
    facilitatorId: string | null;
    state: string | null;
    _type: string;
  }

  interface PaymentOrder {
    paymentOrderId: string;
    paymentURL: string;
    paymentOrderStatus: 'RUNNING' | string; // Broadened to string in case there are other statuses like 'PAID' or 'FAILED'
    creationDate: string;
    updateDate: string | null;
    amount: number;
    currency: string;
    locale: string;
    strongAuthentication: string;
    orderId: string;
    channelDetails: ChannelDetails;
    paymentReceiptEmail: string;
    taxRate: number | null;
    taxAmount: number | null;
    expirationDate: string;
    transactionDetails: TransactionDetails;
    dataCollectionForm: boolean;
    allowDCFAmountUpdate: string;
    merchantComment: string | null;
    message: string;
    description: string | null;
    formAction: string;
    paymentMethodToken: string | null;
    metadata: Record<string, unknown>;
    customer: Customer;
    acquirerTransientData: Record<string, unknown>;
    paymentMethods: unknown[]; // Adjust 'unknown' to a specific type if you expect a certain structure
    subMerchantDetails: SubMerchantDetails;
    returnMode: string | null;
    returnUrl: string | null;
    cancelUrl: string | null;
    successUrl: string | null;
    refusedUrl: string | null;
    errorUrl: string | null;
    postWalletUrl: string | null;
    ipnTargetUrl: string | null;
    redirectSuccessTimeout: number | null;
    redirectErrorTimeout: number | null;
    useCase: string | null;
    _type: string;
  }

  const answer = await payzenFetch<PaymentOrder>(cfg, '/Charge/CreatePaymentOrder', body);
  const url = answer.paymentURL ?? '';

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
 * Verifies the IPN signature Payzen sends in `kr-hash`, computed as
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
