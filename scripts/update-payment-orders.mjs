#!/usr/bin/env node

/**
 * One-shot script: update all open Payzen payment orders to set:
 *   - orderId = "LASTNAME FirstName"
 *   - paymentReceiptEmail = direct5@cia-france.com (CC on buyer notification)
 *
 * Usage:
 *   node scripts/update-payment-orders.mjs            # dry-run
 *   node scripts/update-payment-orders.mjs --apply     # actually update
 */

const DRY_RUN = !process.argv.includes('--apply');

const SUPABASE_URL = 'https://wlphpnczkmcypvkwbofv.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGhwbmN6a21jeXB2a3dib2Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkxNzQ4NiwiZXhwIjoyMDk2NDkzNDg2fQ.tf28m_HkXkBX0sB3MuUClRpTlRSmbd-K64ODiA0tYpk';

const PAYZEN_API_URL = 'https://api.payzen.eu/api-payment/V4';
const PAYZEN_AUTH = Buffer.from(
  '86791785:prodpassword_6eXpVdolr8Z4wWvtlKAPc3KEclI9voZO9qeTaqjM1x7ks',
).toString('base64');

const CC_EMAIL = 'direct5@cia-france.com';
const DELAY_MS = 300;

async function supabaseFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || '',
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function payzenUpdate(paymentOrderId, updates) {
  const res = await fetch(`${PAYZEN_API_URL}/Charge/PaymentOrder/Update`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${PAYZEN_AUTH}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ paymentOrderId, ...updates }),
  });
  const text = await res.text();
  if (!text) return {}; // empty body = success
  const data = JSON.parse(text);
  if (data.status !== 'SUCCESS') {
    const err = data.answer;
    throw new Error(
      `${err?.errorCode}: ${err?.errorMessage} (${err?.detailedErrorMessage || ''})`,
    );
  }
  return data.answer;
}

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildOrderId(billing) {
  const { firstName, lastName } = billing;
  const fnUpper = firstName === firstName.toUpperCase();
  const lnUpper = lastName === lastName.toUpperCase();

  let raw;
  if (fnUpper && !lnUpper) raw = `${firstName} ${lastName}`;
  else if (lnUpper && !fnUpper) raw = `${lastName} ${firstName}`;
  else raw = `${firstName} ${lastName}`;
  return stripDiacritics(raw);
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (pass --apply to execute) ===' : '=== APPLYING CHANGES ===');

  const links = await supabaseFetch(
    'payment_links?select=id,payzen_order_id,raw&status=in.(created,pending)&order=created_at.asc',
  );
  console.log(`Found ${links.length} open payment links\n`);

  let ok = 0;
  let fail = 0;

  for (const link of links) {
    const { paymentOrderId, orderId: currentOrderId } = link.raw;
    const billing = link.raw.customer?.billingDetails;
    if (!billing?.firstName || !billing?.lastName) {
      console.log(`SKIP ${link.id} — missing billing name`);
      fail++;
      continue;
    }

    const newOrderId = buildOrderId(billing);

    if (currentOrderId === newOrderId) {
      console.log(`SKIP ${currentOrderId} — already correct`);
      ok++;
      continue;
    }

    console.log(`${currentOrderId} → ${newOrderId}`);

    if (!DRY_RUN) {
      try {
        await payzenUpdate(paymentOrderId, {
          amount: link.raw.amount,
          currency: link.raw.currency,
          orderId: newOrderId,
          paymentReceiptEmail: CC_EMAIL,
        });

        await supabaseFetch(`payment_links?id=eq.${link.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ payzen_order_id: newOrderId }),
          prefer: 'return=minimal',
        });

        console.log(`  ✓ updated`);
        ok++;
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
        fail++;
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } else {
      ok++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
