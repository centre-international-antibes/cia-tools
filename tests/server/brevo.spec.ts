import { describe, it, expect, afterEach, vi } from 'vitest';
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

  it('accepts a matching Bearer token', () => {
    expect(verifyBrevoWebhook(secret, `Bearer ${secret}`)).toBe(true);
  });

  it('rejects a bad Bearer token', () => {
    expect(verifyBrevoWebhook(secret, 'Bearer wrong')).toBe(false);
  });

  it('rejects unknown auth schemes', () => {
    expect(verifyBrevoWebhook(secret, `Basic ${secret}`)).toBe(false);
    expect(verifyBrevoWebhook(secret, `Digest ${secret}`)).toBe(false);
  });

  it('rejects when no Authorization header is provided', () => {
    expect(verifyBrevoWebhook(secret, null)).toBe(false);
  });
});
