#!/usr/bin/env node

/**
 * Simulate a Payzen IPN POST against the local dev server.
 *
 * Signs the payload with the test HMAC key from .env so the real webhook
 * handler accepts it. Useful for verifying the handler without a real payment.
 *
 * USAGE:
 *   1. Start the dev server: `npm run dev`
 *   2. Run this script:
 *        node scripts/test-payzen-webhook.mjs
 *
 *   Options:
 *     --target <url>   Override target URL (default: http://localhost:3000/api/webhooks/payzen)
 *     --debug          Hit the debug endpoint instead (/api/webhooks/payzen-debug)
 *     --order <id>     Override orderId (default: TEST-ORDER-001)
 *     --status <s>     Transaction status: PAID | EXPIRED | CANCELLED | REFUSED (default: PAID)
 *     --use-password   Sign with PAYZEN_PASSWORD (kr-hash-key=password) instead of HMAC key
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Parse .env
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = resolve(import.meta.dirname, '..', '.env');
  const vars = {};
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  } catch {
    console.error('Could not read .env — make sure it exists at project root.');
    process.exit(1);
  }
  return vars;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function opt(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

const useDebug = flag('debug');
const usePassword = flag('use-password');
const orderId = opt('order', 'TEST-ORDER-001');
const txStatus = opt('status', 'PAID');

const env = loadEnv();
const hmacKey = env.PAYZEN_HMAC_KEY;
const password = env.PAYZEN_PASSWORD;

if (!hmacKey && !usePassword) {
  console.error('PAYZEN_HMAC_KEY not found in .env');
  process.exit(1);
}
if (usePassword && !password) {
  console.error('PAYZEN_PASSWORD not found in .env');
  process.exit(1);
}

const signingKey = usePassword ? password : hmacKey;
const krHashKey = usePassword ? 'password' : 'sha256_hmac';

// ---------------------------------------------------------------------------
// Build kr-answer (mimics real Payzen IPN payload)
// ---------------------------------------------------------------------------
const krAnswer = JSON.stringify({
  shopId: env.PAYZEN_USERNAME || '86791785',
  orderCycle: 'CLOSED',
  orderStatus: txStatus,
  serverDate: new Date().toISOString(),
  orderDetails: {
    orderId,
    mode: 'TEST',
  },
  customer: {
    email: 'test@example.com',
    billingDetails: {
      firstName: 'Test',
      lastName: 'User',
    },
  },
  transactions: [
    {
      shopId: env.PAYZEN_USERNAME || '86791785',
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      amount: 15000,
      currency: 'EUR',
      status: txStatus,
      detailedStatus: txStatus === 'PAID' ? 'AUTHORISED' : txStatus,
      creationDate: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
      paymentMethodType: 'CARD',
      paymentMethodToken: null,
    },
  ],
});

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------
const krHash = createHmac('sha256', signingKey).update(krAnswer).digest('hex');

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
const defaultPath = useDebug ? '/api/webhooks/payzen-debug' : '/api/webhooks/payzen';
const target = opt('target', `http://localhost:3000${defaultPath}`);

const body = new URLSearchParams({
  'kr-answer': krAnswer,
  'kr-hash': krHash,
  'kr-hash-algorithm': 'sha256_hmac',
  'kr-hash-key': krHashKey,
}).toString();

console.log(`\n🔧 Payzen IPN test`);
console.log(`   Target:     ${target}`);
console.log(`   Order ID:   ${orderId}`);
console.log(`   Status:     ${txStatus}`);
console.log(`   Signed with: ${krHashKey}`);
console.log(`   kr-hash:    ${krHash}`);
console.log();

try {
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  console.log(`📬 Response: ${res.status} ${res.statusText}`);
  if (json) {
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(text);
  }

  if (!res.ok) {
    console.log(`\n⚠️  Got ${res.status} — check server logs for details.`);
  }
} catch (err) {
  console.error(`\n❌ Request failed:`, err.message);
  console.error('   Is the dev server running? (npm run dev)');
  process.exit(1);
}
