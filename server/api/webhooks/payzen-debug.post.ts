/**
 * Payzen IPN debug listener.
 *
 * Logs the full incoming request (headers + raw body + parsed params) and
 * always returns 200 so Lyra doesn't retry. Use this to inspect what Payzen
 * actually sends before troubleshooting the real handler.
 *
 * USAGE:
 *   1. Start dev server: `npm run dev`
 *   2. Expose local server via tunnel:
 *        ngrok http 3000
 *      or
 *        npx localtunnel --port 3000
 *   3. Set the tunnel URL as IPN target in .env:
 *        PAYZEN_IPN_TARGET_URL=https://<tunnel-id>.ngrok-free.app/api/webhooks/payzen-debug
 *   4. Trigger a payment on a test link — the full payload will appear in the
 *      dev server console.
 *   5. Once done, revert PAYZEN_IPN_TARGET_URL to point to the real handler
 *      and delete this file.
 */
export default defineEventHandler(async (event) => {
  const headers = Object.fromEntries(
    Object.entries(getHeaders(event)).filter(([, v]) => v !== undefined),
  );

  const rawBody = await readRawBody(event, 'utf8');

  let parsed: Record<string, string> | null = null;
  if (rawBody) {
    try {
      const params = new URLSearchParams(rawBody);
      parsed = Object.fromEntries(params.entries());

      // Pretty-print kr-answer if it's JSON
      if (parsed['kr-answer']) {
        try {
          parsed['kr-answer (decoded)'] = JSON.parse(parsed['kr-answer']);
        } catch {
          // not JSON, keep raw
        }
      }
    } catch {
      // not form-urlencoded
    }
  }

  const payload = {
    timestamp: new Date().toISOString(),
    method: event.method,
    url: getRequestURL(event).toString(),
    headers,
    rawBody: rawBody ?? '(empty)',
    parsed,
  };

  console.log('\n' + '='.repeat(80));
  console.log('[payzen-debug] INCOMING IPN REQUEST');
  console.log('='.repeat(80));
  console.log(JSON.stringify(payload, null, 2));
  console.log('='.repeat(80) + '\n');

  return { ok: true, debug: true, received: payload.timestamp };
});
