import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensurePaymentLinkForContact } from '~/server/utils/paymentLinks';
import * as payzen from '~/server/utils/payzen';

/**
 * In-memory stub for the bits of supabase-js that ensurePaymentLinkForContact
 * touches. Faithfully models the query DSL we use (chained .from/.select/.eq/
 * .in/.order/.limit/.maybeSingle/.update/.insert/.neq) and tracks the rows so
 * we can assert side-effects.
 */
function makeClient(initial: Record<string, unknown>[] = []) {
  const rows = initial.map((r, i) => ({ id: `row-${i + 1}`, ...r }));

  function table() {
    const filters: Array<{ col: string; op: string; val: unknown }> = [];
    let nextOrder: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    const apply = () => {
      let out = [...rows];
      for (const f of filters) {
        out = out.filter((r) => {
          if (f.col === 'raw->>proforma') {
            const raw = (r as Record<string, unknown>).raw as Record<string, unknown> | undefined;
            return f.op === 'eq' ? raw?.proforma === f.val : true;
          }
          const v = (r as Record<string, unknown>)[f.col];
          if (f.op === 'eq') return v === f.val;
          if (f.op === 'neq') return v !== f.val;
          if (f.op === 'in') return (f.val as unknown[]).includes(v);
          return true;
        });
      }
      if (nextOrder) {
        const { col, asc } = nextOrder;
        out = [...out].sort((a, b) => {
          const av = (a as Record<string, unknown>)[col] as string;
          const bv = (b as Record<string, unknown>)[col] as string;
          return asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limit != null) out = out.slice(0, limit);
      return out;
    };

    const flushUpdate = () => {
      if (!pendingUpdate) return;
      for (const r of apply()) Object.assign(r, pendingUpdate);
      pendingUpdate = null;
    };

    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters.push({ col, op: 'eq', val });
        return chain;
      },
      neq: (col: string, val: unknown) => {
        filters.push({ col, op: 'neq', val });
        return chain;
      },
      in: (col: string, val: unknown[]) => {
        filters.push({ col, op: 'in', val });
        return chain;
      },
      order: (col: string, opts: { ascending: boolean }) => {
        nextOrder = { col, asc: opts.ascending };
        return chain;
      },
      limit: (n: number) => {
        limit = n;
        return chain;
      },
      single: async () => {
        flushUpdate();
        return { data: apply()[0] ?? null, error: null };
      },
      maybeSingle: async () => {
        flushUpdate();
        return { data: apply()[0] ?? null, error: null };
      },
      update: (patch: Record<string, unknown>) => {
        pendingUpdate = patch;
        return chain;
      },
      insert: async (row: Record<string, unknown>) => {
        rows.push({ id: `row-${rows.length + 1}`, ...row });
        return { error: null };
      },
      // The chain is itself awaitable — supabase-js builders are thenables.
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        flushUpdate();
        resolve({ data: null, error: null });
      },
    };
    return chain;
  }

  return {
    from: (_t: string) => table() as unknown as never,
    _rows: rows,
  };
}

const cfg = {
  apiUrl: 'https://api.lyra.com/api-payment/V4',
  username: 'u',
  password: 'p',
  hmacKey: 'h',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ensurePaymentLinkForContact — reuse semantics', () => {
  it('reuses an existing open link when proforma + amount match and Lyra status is pending', async () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const client = makeClient([
      {
        contact_id: 'c1',
        payzen_order_id: 'CIA-OLD',
        payzen_payment_url: 'https://payzen.link/old',
        amount_cents: 44100,
        currency: 'EUR',
        status: 'created',
        expires_at: future,
        raw: { proforma: 'P-123' },
      },
    ]);
    const create = vi.spyOn(payzen, 'createPaymentLink');
    vi.spyOn(payzen, 'getOrderStatus').mockResolvedValue({
      orderId: 'CIA-OLD',
      status: 'pending',
      paidAt: null,
      raw: {},
    });

    const result = await ensurePaymentLinkForContact(client as never, cfg, {
      contactId: 'c1',
      campaignId: 'camp-1',
      email: 'p@x.com',
      firstName: 'A',
      lastName: 'B',
      amountCents: 44100,
      proforma: 'P-123',
    });

    expect(result.paymentUrl).toBe('https://payzen.link/old');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a fresh link when amount changed between cycles', async () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const client = makeClient([
      {
        contact_id: 'c1',
        payzen_order_id: 'CIA-OLD',
        payzen_payment_url: 'https://payzen.link/old',
        amount_cents: 44100,
        currency: 'EUR',
        status: 'created',
        expires_at: future,
        raw: { proforma: 'P-123' },
      },
    ]);
    vi.spyOn(payzen, 'getOrderStatus').mockResolvedValue({
      orderId: 'CIA-OLD', status: 'pending', paidAt: null, raw: {},
    });
    const create = vi.spyOn(payzen, 'createPaymentLink').mockResolvedValue({
      orderId: 'CIA-NEW',
      paymentUrl: 'https://payzen.link/new',
      expiresAt: future,
      raw: {},
    });

    const result = await ensurePaymentLinkForContact(client as never, cfg, {
      contactId: 'c1',
      campaignId: 'camp-2',
      email: 'p@x.com',
      firstName: 'A',
      lastName: 'B',
      amountCents: 20000,
      proforma: 'P-123',
    });

    expect(create).toHaveBeenCalledOnce();
    expect(result.paymentUrl).toBe('https://payzen.link/new');
    // Old row must be superseded.
    const oldRow = client._rows.find((r) => (r as Record<string, unknown>).payzen_order_id === 'CIA-OLD') as Record<string, unknown>;
    expect(oldRow.status).toBe('expired');
  });

  it('creates a fresh link when Lyra reports the order paid (missed IPN recovery)', async () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const client = makeClient([
      {
        contact_id: 'c1',
        payzen_order_id: 'CIA-OLD',
        payzen_payment_url: 'https://payzen.link/old',
        amount_cents: 44100,
        currency: 'EUR',
        status: 'created',
        expires_at: future,
        raw: { proforma: 'P-123' },
      },
    ]);
    vi.spyOn(payzen, 'getOrderStatus').mockResolvedValue({
      orderId: 'CIA-OLD',
      status: 'paid',
      paidAt: '2026-06-01T00:00:00Z',
      raw: {},
    });
    const create = vi.spyOn(payzen, 'createPaymentLink').mockResolvedValue({
      orderId: 'CIA-NEW',
      paymentUrl: 'https://payzen.link/new',
      expiresAt: future,
      raw: {},
    });

    await ensurePaymentLinkForContact(client as never, cfg, {
      contactId: 'c1',
      campaignId: 'camp-2',
      email: 'p@x.com',
      firstName: 'A',
      lastName: 'B',
      amountCents: 44100,
      proforma: 'P-123',
    });

    expect(create).toHaveBeenCalledOnce();
    const oldRow = client._rows.find((r) => (r as Record<string, unknown>).payzen_order_id === 'CIA-OLD') as Record<string, unknown>;
    // Live-poll wrote back the paid status before we minted a new order.
    expect(oldRow.status).toBe('paid');
  });

  it('creates a fresh link when existing link is near expiry', async () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day left
    const client = makeClient([
      {
        contact_id: 'c1',
        payzen_order_id: 'CIA-OLD',
        payzen_payment_url: 'https://payzen.link/old',
        amount_cents: 44100,
        currency: 'EUR',
        status: 'created',
        expires_at: soon,
        raw: { proforma: 'P-123' },
      },
    ]);
    const getStatus = vi.spyOn(payzen, 'getOrderStatus');
    const create = vi.spyOn(payzen, 'createPaymentLink').mockResolvedValue({
      orderId: 'CIA-NEW',
      paymentUrl: 'https://payzen.link/new',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      raw: {},
    });

    await ensurePaymentLinkForContact(client as never, cfg, {
      contactId: 'c1',
      campaignId: 'camp-2',
      email: 'p@x.com',
      firstName: 'A',
      lastName: 'B',
      amountCents: 44100,
      proforma: 'P-123',
    });

    // Near-expiry short-circuits before Lyra is ever polled.
    expect(getStatus).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
  });
});
