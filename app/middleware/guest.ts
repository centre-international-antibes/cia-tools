export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser();
  if (!user.value) return;

  const localePath = useLocalePath();
  return navigateTo(localePath('/dashboard'));
});
