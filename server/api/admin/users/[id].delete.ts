export default defineEventHandler(async (event) => {
  const { client } = await requireAdmin(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' });
  }

  const { error } = await client.auth.admin.deleteUser(id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});
