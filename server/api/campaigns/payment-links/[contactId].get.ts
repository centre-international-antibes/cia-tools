
export default defineEventHandler(async (event) => {
  const contactId = getRouterParam(event, 'contactId');
  if (!contactId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client } = await requireScope(event, 'campaign:payment_reminder');
  const { data, error } = await client
    .from('payment_links')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return data;
});
