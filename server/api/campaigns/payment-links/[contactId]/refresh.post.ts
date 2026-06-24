
export default defineEventHandler(async (event) => {
  const contactId = getRouterParam(event, 'contactId');
  if (!contactId) throw createError({ statusCode: 400, statusMessage: 'Missing id.' });

  const { client } = await requireScope(event, 'campaign:payment_reminder');
  const config = useRuntimeConfig();

  const { data: links } = await client
    .from('payment_links')
    .select('id')
    .eq('contact_id', contactId)
    .in('status', ['created', 'pending']);
  if (!links?.length) return { refreshed: 0 };

  for (const link of links) {
    try {
      await refreshPaymentLinkStatus(client, {
        apiUrl: config.payzen.apiUrl,
        username: config.payzen.username,
        password: config.payzen.password,
        hmacKey: config.payzen.hmacKey,
        returnUrl: config.payzen.returnUrl,
        ipnTargetUrl: config.payzen.ipnTargetUrl,
        paymentReceiptEmail: config.payzen.paymentReceiptEmail,
      }, link.id);
    } catch (err) {
      console.error('[payzen] refresh failed', { id: link.id, err });
    }
  }
  return { refreshed: links.length };
});
