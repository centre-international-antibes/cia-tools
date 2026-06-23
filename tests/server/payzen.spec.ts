import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  createPaymentLink,
  PayzenError,
  verifyPayzenIpn,
  type PayzenConfig,
} from '~/server/utils/payzen';

describe('verifyPayzenIpn', () => {
  it('accepts a valid HMAC-SHA256 signature', () => {
    const key = 'k';
    const answer = '{"orderStatus":"PAID"}';
    const sig = crypto.createHmac('sha256', key).update(answer).digest('hex');
    expect(verifyPayzenIpn(answer, key, sig)).toBe(true);
  });

  it('rejects bad signatures', () => {
    expect(verifyPayzenIpn('{}', 'k', 'deadbeef')).toBe(false);
  });

  it('rejects missing arguments', () => {
    expect(verifyPayzenIpn('{}', '', 'sig')).toBe(false);
    expect(verifyPayzenIpn('{}', 'k', null)).toBe(false);
  });
});

describe('createPaymentLink', () => {
  const cfg: PayzenConfig = {
    apiUrl: 'https://api.lyra.com/api-payment/V4',
    username: 'u',
    password: 'p',
    hmacKey: 'h',
    returnUrl: 'https://merchant.example/return',
  };

  const okResponse = (overrides: Record<string, unknown> = {}) =>
    new Response(
      JSON.stringify({
        status: 'SUCCESS',
        answer: {
          paymentOrder: {
            paymentOrderId: 'po_123',
            url: 'https://payzen.link/abc',
            status: 'OPEN',
            expirationDate: '2026-12-31T23:59:59+00:00',
            ...overrides,
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends a spec-compliant CreatePaymentOrder body (fr default)', async () => {
    fetchSpy.mockResolvedValueOnce(okResponse());

    const result = await createPaymentLink(cfg, {
      orderId: 'CIA-1',
      amountCents: 1990,
      customer: { email: 'c@example.com', firstName: 'Jane', lastName: 'Doe', reference: 'ref-1' },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.lyra.com/api-payment/V4/Charge/CreatePaymentOrder');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.channelOptions).toEqual({ channelType: 'URL' });
    expect(body.locale).toBe('fr_FR');
    expect(body.returnUrl).toBe('https://merchant.example/return');
    expect(body.amount).toBe(1990);
    expect(body.currency).toBe('EUR');
    expect(body.orderId).toBe('CIA-1');
    const customer = body.customer as { billingDetails?: Record<string, unknown> };
    expect(customer.billingDetails).toEqual({ firstName: 'Jane', lastName: 'Doe' });

    expect(result.paymentUrl).toBe('https://payzen.link/abc');
    expect(result.expiresAt).toBe('2026-12-31T23:59:59+00:00');
  });

  it('maps language=en to locale en_GB', async () => {
    fetchSpy.mockResolvedValueOnce(okResponse());

    await createPaymentLink(cfg, {
      orderId: 'CIA-2',
      amountCents: 100,
      language: 'en',
      customer: { email: 'c@example.com' },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { locale?: string };
    expect(body.locale).toBe('en_GB');
  });

  it('surfaces errorCode/errorMessage from answer on HTTP 200 ERROR wrapper', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ERROR',
          answer: {
            errorCode: 'PSP_010',
            errorMessage: 'shop not found',
            detailedErrorCode: 'INT_905',
            detailedErrorMessage: 'The shop ID is unknown for this account.',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      createPaymentLink(cfg, {
        orderId: 'CIA-3',
        amountCents: 100,
        customer: { email: 'c@example.com' },
      }),
    ).rejects.toMatchObject({
      name: 'PayzenError',
      message: 'shop not found',
      code: 'PSP_010',
      detailedCode: 'INT_905',
      detailedMessage: 'The shop ID is unknown for this account.',
      endpoint: '/Charge/CreatePaymentOrder',
    });
  });

  it('surfaces answer errorMessage on HTTP 401/4xx responses', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ERROR',
          answer: {
            errorCode: 'PSP_100',
            errorMessage: 'Authentication failed',
          },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      createPaymentLink(cfg, {
        orderId: 'CIA-4',
        amountCents: 100,
        customer: { email: 'c@example.com' },
      }),
    ).rejects.toMatchObject({
      name: 'PayzenError',
      statusCode: 401,
      code: 'PSP_100',
      message: 'Authentication failed',
    });
  });

  it('PayzenError.toDisplayString includes code, message and detailed fields', () => {
    const err = new PayzenError('shop not found', 200, 'PSP_010', null, {
      detailedCode: 'INT_905',
      detailedMessage: 'The shop ID is unknown for this account.',
      endpoint: '/Charge/CreatePaymentOrder',
    });
    const out = err.toDisplayString();
    expect(out).toContain('[Payzen 200 PSP_010]');
    expect(out).toContain('shop not found');
    expect(out).toContain('The shop ID is unknown for this account.');
    expect(out).toContain('(INT_905)');
    expect(out).toContain('@ /Charge/CreatePaymentOrder');
  });
});
