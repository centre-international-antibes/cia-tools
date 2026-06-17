export default defineEventHandler(async (event) => {
  const { client } = await requireAdmin(event);
  const body = await readBody(event);

  const { email, password, full_name, role, scopes } = body;

  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required (min 8 characters)',
    });
  }

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || '' },
  });

  if (authError) {
    throw createError({ statusCode: 400, statusMessage: authError.message });
  }

  const updates: Record<string, unknown> = {};
  if (role) updates.role = role;
  if (Array.isArray(scopes)) updates.scopes = scopes;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await client
      .from('profiles')
      .update(updates)
      .eq('id', authData.user.id);

    if (updateError) {
      throw createError({ statusCode: 500, statusMessage: updateError.message });
    }
  }

  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  return profile;
});
