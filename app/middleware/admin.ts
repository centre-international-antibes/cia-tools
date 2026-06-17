export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) {
    return navigateTo(localePath('/login'));
  }

  const client = useSupabaseClient();

  const { data } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.value.id)
    .single();

  if (data?.role !== 'admin') {
    return navigateTo(localePath('/dashboard'));
  }
});
