import type {
  Campaign,
  CampaignContact,
  CampaignKind,
  CampaignKindConfig,
  CampaignList,
  CampaignRecipient,
  EmailTemplate,
  EmailTemplateVersion,
  ParserWarning,
  ParseSummary,
} from '~/types/campaign.types';

/**
 * Single composable for the whole campaigns domain.
 *
 * State:
 *   - `kinds`: cached metadata from /api/campaigns/kinds.
 *
 * Methods are grouped by sub-resource (lists, contacts, templates, campaign
 * lifecycle, test-send). All API calls return typed promises; UI components
 * surface errors via `useToast()`.
 */

interface UploadListResult {
  list: CampaignList;
  warnings: ParserWarning[];
  summary?: ParseSummary;
}

interface ContactsPage {
  rows: CampaignContact[];
  total: number;
}

interface RecipientsPage {
  rows: CampaignRecipient[];
  total: number;
}

interface TemplateDetail {
  template: EmailTemplate;
  versions: Array<
    Pick<
      EmailTemplateVersion,
      'id' | 'version' | 'subject' | 'variables_schema' | 'created_at' | 'created_by'
    >
  >;
}

interface RenderResult {
  subject: string;
  html: string;
  plaintext: string;
  missingVariables: string[];
}

interface TestSendResult {
  id: string;
  status: 'sent' | 'failed';
  messageId: string | null;
  error: string | null;
}

export function useCampaigns() {
  const api = useApi();
  const kinds = useState<CampaignKindConfig[] | null>('campaign-kinds', () => null);
  const kindsLoading = useState<boolean>('campaign-kinds-loading', () => false);

  async function fetchKinds(): Promise<CampaignKindConfig[]> {
    if (kinds.value) return kinds.value;
    kindsLoading.value = true;
    try {
      kinds.value = await api<CampaignKindConfig[]>('/api/campaigns/kinds');
      return kinds.value;
    } finally {
      kindsLoading.value = false;
    }
  }

  function getKind(kind: CampaignKind): CampaignKindConfig | null {
    return kinds.value?.find((k) => k.kind === kind) ?? null;
  }

  // ── Lists ────────────────────────────────────────────────
  const lists = {
    list: (kind: CampaignKind) =>
      api<CampaignList[]>('/api/campaigns/lists', { query: { kind } }),
    get: (id: string) => api<CampaignList>(`/api/campaigns/lists/${id}`),
    contacts: (id: string, params?: { limit?: number; offset?: number }) =>
      api<ContactsPage>(`/api/campaigns/lists/${id}/contacts`, { query: params }),
    upload: (kind: CampaignKind, name: string, file: File) => {
      const form = new FormData();
      form.append('kind', kind);
      form.append('name', name);
      form.append('file', file, file.name);
      return api<UploadListResult>('/api/campaigns/lists', { method: 'POST', body: form });
    },
    remove: (id: string) =>
      api<{ success: boolean }>(`/api/campaigns/lists/${id}`, { method: 'DELETE' }),
  };

  // ── Templates ────────────────────────────────────────────
  const templates = {
    list: (kind?: CampaignKind) =>
      api<EmailTemplate[]>('/api/campaigns/templates', {
        query: kind ? { kind } : undefined,
      }),
    get: (id: string) => api<TemplateDetail>(`/api/campaigns/templates/${id}`),
    getVersion: (templateId: string, versionId: string) =>
      api<EmailTemplateVersion>(
        `/api/campaigns/templates/${templateId}/versions/${versionId}`,
      ),
    create: (body: {
      kind: CampaignKind;
      name: string;
      language?: 'fr' | 'en';
      variant?: string;
      description?: string;
    }) => api<EmailTemplate>('/api/campaigns/templates', { method: 'POST', body }),
    createVersion: (
      id: string,
      body: {
        subject: string;
        mjml: string;
        variables_schema: Array<{
          key: string;
          type: string;
          required?: boolean;
          sample?: unknown;
          description?: string;
        }>;
        activate?: boolean;
      },
    ) =>
      api<EmailTemplateVersion>(`/api/campaigns/templates/${id}/versions`, {
        method: 'POST',
        body,
      }),
    preview: (
      id: string,
      body: { versionId?: string; params: Record<string, unknown> },
    ) =>
      api<RenderResult>(`/api/campaigns/templates/${id}/preview`, {
        method: 'POST',
        body,
      }),
  };

  // ── Campaigns ────────────────────────────────────────────
  const campaigns = {
    list: (kind: CampaignKind) =>
      api<Campaign[]>('/api/campaigns', { query: { kind } }),
    get: (id: string) => api<Campaign>(`/api/campaigns/${id}`),
    create: (body: { kind: CampaignKind; name: string; list_id: string; notes?: string }) =>
      api<Campaign>('/api/campaigns', { method: 'POST', body }),
    update: (
      id: string,
      body: Partial<Campaign> & { template_overrides?: Record<string, string> },
    ) => api<Campaign>(`/api/campaigns/${id}`, { method: 'PATCH', body }),
    remove: (id: string) =>
      api<{ success: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),
    prepare: (id: string, contactIds: string[]) =>
      api<{ prepared: number }>(`/api/campaigns/${id}/prepare`, {
        method: 'POST',
        body: { contact_ids: contactIds },
      }),
    send: (id: string, clientRequestId: string) =>
      api<{ success: boolean; campaignId: string }>(`/api/campaigns/${id}/send`, {
        method: 'POST',
        body: { client_request_id: clientRequestId },
      }),
    abort: (id: string) =>
      api<{ success: boolean }>(`/api/campaigns/${id}/abort`, { method: 'POST' }),
    recipients: (id: string, params?: { status?: string; limit?: number; offset?: number }) =>
      api<RecipientsPage>(`/api/campaigns/${id}/recipients`, { query: params }),
  };

  // ── Payment reminder lifecycle ───────────────────────────
  interface DiffEntry {
    proforma: string;
    email: string;
    stage: number;
    amount_cents: number;
    paid_cents: number;
    cycle_id: string | null;
  }
  interface DiffResult {
    closed: DiffEntry[];
    advanced: DiffEntry[];
    unchanged: DiffEntry[];
    new: DiffEntry[];
    missing: DiffEntry[];
  }
  const paymentReminder = {
    diff: (prevListId: string, newListId: string) =>
      api<DiffResult>('/api/campaigns/payment-reminder/diff', {
        method: 'POST',
        body: { prevListId, newListId },
      }),
    refreshLinks: (listId: string) =>
      api<{ refreshed: number; closed: number; total: number }>(
        '/api/campaigns/payment-reminder/refresh-links',
        { method: 'POST', body: { listId } },
      ),
  };

  // ── Misc ─────────────────────────────────────────────────
  function testSend(body: {
    template_version_id: string;
    recipient_email?: string;
    sample_contact_id?: string | null;
    campaign_id?: string | null;
    params?: Record<string, unknown>;
  }) {
    return api<TestSendResult>('/api/campaigns/test-send', { method: 'POST', body });
  }

  return {
    kinds,
    kindsLoading,
    fetchKinds,
    getKind,
    lists,
    templates,
    campaigns,
    paymentReminder,
    testSend,
  };
}
