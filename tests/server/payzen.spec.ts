import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyPayzenIpn } from '~/server/utils/payzen';

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
