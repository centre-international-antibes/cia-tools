export default defineEventHandler(async (event) => {
  const { client } = await requireAdmin(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' });
  }

  const body = await readBody(event);
  const { full_name, role, scopes, email } = body;

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (scopes !== undefined) updates.scopes = scopes;
  if (email !== undefined) updates.email = email;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  if (email) {
    await client.auth.admin.updateUserById(id, { email });
  }

  return data;
});
