import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import type { EligibilityFlags } from '~/types/campaign.types';

/**
 * Payment-reminder cycles bind the 3-step dunning workflow to a single
 * outstanding proforma. Each operator reupload of the Payzen export is
 * matched against open cycles by proforma:
 *
 *   - balance now settled  → close cycle as 'paid'.
 *   - balance still owing  → bump `stage`, keep the existing Payzen link.
 *   - new proforma         → open a fresh cycle at stage 1.
 *
 * The cycle is the canonical store of "how many reminders has this
 * customer already received for this specific balance". The ERP's
 * `Relance N` columns remain the input signal.
 */

type Client = SupabaseClient<Database>;
type CycleRow = Database['public']['Tables']['payment_reminder_cycles']['Row'];

export interface CycleResolutionInput {
  proforma: string;
  email: string;
  clientId: string | null;
  amountCents: number;
  totalCents: number | null;
  paidCents: number | null;
  currency: string;
  listId: string;
}

export interface DiffEntry {
  proforma: string;
  email: string;
  stage: number;
  amount_cents: number;
  paid_cents: number;
  cycle_id: string | null;
}

export interface DiffResult {
  closed: DiffEntry[];
  advanced: DiffEntry[];
  unchanged: DiffEntry[];
  new: DiffEntry[];
  missing: DiffEntry[];
}

/**
 * Find the open cycle for a proforma; if none exists, create one at stage 1
 * using the current row's amount. Caller is responsible for calling
 * `progressCycle` afterwards when reuploads happen.
 */
export async function findOrCreateCycle(
  client: Client,
  input: CycleResolutionInput,
): Promise<CycleRow> {
  if (!input.proforma) {
    throw new Error('findOrCreateCycle: proforma is required.');
  }

  const { data: existing, error: fetchErr } = await client
    .from('payment_reminder_cycles')
    .select('*')
    .eq('proforma', input.proforma)
    .eq('status', 'open')
    .maybeSingle();
  if (fetchErr) throw new Error(`Cycle lookup failed: ${fetchErr.message}`);
  if (existing) return existing;

  const { data: inserted, error: insertErr } = await client
    .from('payment_reminder_cycles')
    .insert({
      proforma: input.proforma,
      client_id: input.clientId,
      email: input.email,
      stage: 1,
      status: 'open',
      amount_cents: input.amountCents,
      paid_cents: input.paidCents ?? 0,
      total_cents: input.totalCents,
      currency: input.currency,
      first_list_id: input.listId,
      last_list_id: input.listId,
    })
    .select()
    .single();
  if (insertErr || !inserted) {
    throw new Error(`Cycle insert failed: ${insertErr?.message ?? 'unknown'}`);
  }
  return inserted;
}

export interface ProgressInput {
  newAmountCents: number;
  newPaidCents: number | null;
  newListId: string;
  newCampaignId?: string | null;
  /** Reminder stage signalled by the latest ERP `Relance N` column. */
  signalledStage: 1 | 2 | 3;
}

/**
 * Apply a reupload to an existing cycle. Returns the resulting row.
 *
 *   - paid_cents covers the outstanding amount → close as 'paid'.
 *   - `signalledStage` is higher than current   → bump stage.
 *   - otherwise leave stage untouched.
 */
export async function progressCycle(
  client: Client,
  cycleId: string,
  input: ProgressInput,
): Promise<CycleRow> {
  const { data: cycle, error } = await client
    .from('payment_reminder_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();
  if (error || !cycle) throw new Error(`Cycle ${cycleId} not found.`);

  const balanceCleared = input.newAmountCents <= 0
    || (input.newPaidCents !== null
      && cycle.total_cents !== null
      && input.newPaidCents >= cycle.total_cents);

  const nextStage = Math.max(cycle.stage, input.signalledStage) as 1 | 2 | 3;

  const update: Database['public']['Tables']['payment_reminder_cycles']['Update'] = {
    last_list_id: input.newListId,
    last_campaign_id: input.newCampaignId ?? cycle.last_campaign_id,
    amount_cents: input.newAmountCents,
    paid_cents: input.newPaidCents ?? cycle.paid_cents,
    stage: balanceCleared ? cycle.stage : nextStage,
  };
  if (balanceCleared) {
    update.status = 'paid';
    update.closed_at = new Date().toISOString();
  }

  const { data: updated, error: updErr } = await client
    .from('payment_reminder_cycles')
    .update(update)
    .eq('id', cycleId)
    .select()
    .single();
  if (updErr || !updated) throw new Error(`Cycle progress failed: ${updErr?.message}`);
  return updated;
}

/**
 * Compute the proforma-level diff between two campaign_lists.
 *
 *   - `closed`    : proforma was in `prevListId`, now settled in `newListId`.
 *   - `advanced`  : still owing but signalled stage went up.
 *   - `unchanged` : present in both with same stage/amount.
 *   - `new`       : appears only in `newListId`.
 *   - `missing`   : was in `prevListId`, absent from `newListId` (operator
 *                   decides — default is "leave the cycle open + warn").
 *
 * Diff is computed against canonicalized rows already persisted in
 * `campaign_contacts`. Operates entirely off `eligibility.proforma`.
 */
export async function diffLists(
  client: Client,
  prevListId: string,
  newListId: string,
): Promise<DiffResult> {
  const [prev, next, cycles] = await Promise.all([
    fetchListEntries(client, prevListId),
    fetchListEntries(client, newListId),
    client
      .from('payment_reminder_cycles')
      .select('id, proforma, status'),
  ]);

  const cycleByProforma = new Map<string, { id: string; status: string }>();
  for (const c of cycles.data ?? []) {
    if (c.proforma) cycleByProforma.set(c.proforma, { id: c.id, status: c.status });
  }

  const prevByProforma = new Map(prev.map((r) => [r.proforma, r]));
  const result: DiffResult = {
    closed: [],
    advanced: [],
    unchanged: [],
    new: [],
    missing: [],
  };

  for (const row of next) {
    const before = prevByProforma.get(row.proforma);
    const cycle = cycleByProforma.get(row.proforma);
    const entry: DiffEntry = {
      proforma: row.proforma,
      email: row.email,
      stage: row.stage,
      amount_cents: row.amount_cents,
      paid_cents: row.paid_cents,
      cycle_id: cycle?.id ?? null,
    };
    if (!before) {
      result.new.push(entry);
      continue;
    }
    const settled = row.amount_cents <= 0 || cycle?.status === 'paid';
    if (settled) result.closed.push(entry);
    else if (row.stage > before.stage) result.advanced.push(entry);
    else result.unchanged.push(entry);
  }

  for (const [proforma, before] of prevByProforma) {
    if (!next.some((r) => r.proforma === proforma)) {
      result.missing.push({
        proforma,
        email: before.email,
        stage: before.stage,
        amount_cents: before.amount_cents,
        paid_cents: before.paid_cents,
        cycle_id: cycleByProforma.get(proforma)?.id ?? null,
      });
    }
  }

  return result;
}

interface ListEntry {
  proforma: string;
  email: string;
  stage: number;
  amount_cents: number;
  paid_cents: number;
}

async function fetchListEntries(client: Client, listId: string): Promise<ListEntry[]> {
  const { data, error } = await client
    .from('campaign_contacts')
    .select('email, eligibility')
    .eq('list_id', listId);
  if (error) throw new Error(`List fetch failed: ${error.message}`);
  const out: ListEntry[] = [];
  for (const row of data ?? []) {
    const e = (row.eligibility ?? {}) as EligibilityFlags;
    const proforma = String(e.proforma ?? '').trim();
    if (!proforma) continue;
    out.push({
      proforma,
      email: row.email,
      stage: (e.cycle_stage as number | undefined) ?? 1,
      amount_cents: (e.amount_cents as number | undefined) ?? 0,
      paid_cents: (e.paid_cents as number | undefined) ?? 0,
    });
  }
  return out;
}
