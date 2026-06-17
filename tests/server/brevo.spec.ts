import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { sendTransacEmail, BrevoError, verifyBrevoWebhook } from '~/server/utils/brevo';

describe('Brevo client', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the messageId on success', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: 'msg-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await sendTransacEmail('key', {
      to: [{ email: 'a@x.com' }],
      subject: 'hi',
      htmlContent: '<p>hi</p>',
      sender: { email: 'sender@x.com' },
    });
    expect(result.messageId).toBe('msg-123');
  });

  it('raises a structured BrevoError on HTTP failure', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'invalid_parameter', message: 'oops' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    await expect(
      sendTransacEmail('key', {
        to: [{ email: 'a@x.com' }],
        subject: 's',
        htmlContent: 'h',
        sender: { email: 's@x.com' },
      }),
    ).rejects.toBeInstanceOf(BrevoError);
  });
});

describe('verifyBrevoWebhook', () => {
  const secret = 'shared-secret';

  it('accepts a matching query secret', () => {
    expect(verifyBrevoWebhook('{}', secret, null, secret)).toBe(true);
  });

  it('accepts a matching HMAC signature header', () => {
    const body = JSON.stringify({ event: 'delivered' });
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyBrevoWebhook(body, secret, sig, null)).toBe(true);
  });

  it('rejects bad signatures', () => {
    expect(verifyBrevoWebhook('{}', secret, 'bad-sig', null)).toBe(false);
    expect(verifyBrevoWebhook('{}', secret, null, 'bad-secret')).toBe(false);
  });

  it('rejects when no signature is provided', () => {
    expect(verifyBrevoWebhook('{}', secret, null, null)).toBe(false);
  });
});
