import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';

/**
 * Append-only audit entry. Always call with the service-role client.
 * Never raises — auditing must not block business logic.
 */
export async function logAudit(
  client: SupabaseClient<Database>,
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  diff: Record<string, unknown> = {},
): Promise<void> {
  try {
    await client.from('audit_log').insert({
      actor_user_id: actorUserId,
      action,
      entity,
      entity_id: entityId,
      diff,
    });
  } catch (err) {
    console.error('[audit] failed to write entry', { action, entity, err });
  }
}
