export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) return navigateTo(localePath('/login'));

  const { ensureLoaded, isAdmin } = useUserProfile();
  await ensureLoaded();

  if (!isAdmin.value) return navigateTo(localePath('/dashboard'));
});
