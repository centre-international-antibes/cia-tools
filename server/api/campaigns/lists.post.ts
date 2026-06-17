import { createHash } from 'node:crypto'
import { z } from 'zod';
import type { CampaignKind } from '~/types/campaign.types';

const ALLOWED_EXT = ['.xlsx', '.xls', '.csv'];

const schema = z.object({
  kind: z.string(),
  name: z.string().min(1),
});

/**
 * Multipart upload: receives the Matrix / Payzen export, persists it in the
 * private `campaign-imports` Storage bucket, parses it via the kind registry,
 * and inserts the resulting contacts.
 */
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No multipart payload.' });
  }

  const fields: Record<string, string> = {};
  let filePart: { filename?: string; type?: string; data: Buffer } | null = null;

  for (const part of parts) {
    if (part.filename) {
      filePart = { filename: part.filename, type: part.type, data: part.data };
    } else if (part.name) {
      fields[part.name] = part.data.toString('utf8');
    }
  }

  if (!filePart) throw createError({ statusCode: 400, statusMessage: 'File missing.' });

  const ext = (filePart.filename ?? '').toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (!ALLOWED_EXT.includes(ext)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported file type "${ext}". Use .xlsx or .csv.`,
    });
  }

  const parsedFields = schema.parse(fields);
  const kind = parsedFields.kind as CampaignKind;

  const { client, user } = await requireScope(event, scopeForKind(kind));

  const sha256 = createHash('sha256').update(filePart.data).digest('hex');
  const storagePath = `${kind}/${new Date().toISOString().slice(0, 10)}/${sha256}-${sanitizeFileName(filePart.filename || 'upload')}`;

  const upload = await client.storage
    .from('campaign-imports')
    .upload(storagePath, filePart.data, {
      contentType: filePart.type ?? 'application/octet-stream',
      upsert: false,
    });

  if (upload.error && !upload.error.message.includes('already exists')) {
    throw createError({ statusCode: 500, statusMessage: upload.error.message });
  }

  const parseResult = parseContactsSheet(filePart.data, kind);

  const { data: list, error: listErr } = await client
    .from('campaign_lists')
    .insert({
      kind,
      name: parsedFields.name,
      source_filename: filePart.filename ?? 'upload',
      source_file_path: storagePath,
      source_file_sha256: sha256,
      row_count: parseResult.rows.length,
      warnings: parseResult.warnings,
      uploaded_by: user.sub,
    })
    .select()
    .single();

  if (listErr || !list) {
    throw createError({ statusCode: 500, statusMessage: listErr?.message ?? 'List insert failed.' });
  }

  if (parseResult.rows.length) {
    const rows = parseResult.rows.map((r) => ({
      list_id: list.id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      language: r.language,
      group_key: r.group_key,
      raw: r.raw,
      eligibility: r.eligibility as Record<string, unknown>,
    }));
    const { error: rowsErr } = await client.from('campaign_contacts').insert(rows);
    if (rowsErr) {
      // Roll back the list to avoid an orphaned record.
      await client.from('campaign_lists').delete().eq('id', list.id);
      throw createError({ statusCode: 500, statusMessage: rowsErr.message });
    }
  }

  await logAudit(client, user.sub, 'list.upload', 'campaign_lists', list.id, {
    kind,
    rows: parseResult.rows.length,
    warnings: parseResult.warnings.length,
  });

  return { list, warnings: parseResult.warnings, summary: parseResult.summary };
});


function sanitizeFileName(fileName: string) {
  const parts = fileName.split('.');
  const extension = parts.pop();
  const name = parts.join('.');

  const sanitizedName = name
    .normalize('NFD') // retire les accents
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${sanitizedName}.${extension?.toLowerCase()}`;
}