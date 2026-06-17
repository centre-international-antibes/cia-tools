/**
 * Global auth middleware.
 *
 * Routes opt out by setting `definePageMeta({ auth: false })`.
 * Anything else requires an authenticated user.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.auth === false) return;

  const user = useSupabaseUser();
  if (user.value) return;

  const localePath = useLocalePath();
  return navigateTo(localePath('/login'));
});
