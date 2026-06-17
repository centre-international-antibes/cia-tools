const PUBLIC_ROUTES = new Set([
  'index',
  'login',
  'forgot-password',
  'confirm',
  'legal',
  'privacy-policy',
  'terms-of-service',
]);

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  const routeName = String(to.name ?? '').replace(/___\w+$/, '');

  if (PUBLIC_ROUTES.has(routeName)) return;

  if (!user.value) {
    return navigateTo(localePath('/login'));
  }
});
