import { z } from 'zod';

const schema = z.object({
  prevListId: z.string().uuid(),
  newListId: z.string().uuid(),
});

/**
 * Compares two payment-reminder lists by proforma. Returns:
 *   - closed    : was outstanding, now paid in the new upload
 *   - advanced  : still outstanding, but the reminder stage went up
 *   - unchanged : same stage and amount
 *   - new       : appears only in the new upload
 *   - missing   : was in the previous upload but not in the new one
 *                 (operator decides — open cycle is kept until explicit
 *                  cancellation per the project's "leave open + warn" rule)
 */
export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));
  const { client } = await requireScope(event, 'campaign:payment_reminder');

  const diff = await diffLists(client, body.prevListId, body.newListId);
  return diff;
});
