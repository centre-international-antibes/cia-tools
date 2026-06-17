import type { Database } from '~/types/database.types';
import type { Profile, UserScope } from '~/types/profile.types';

/**
 * Shared user profile state.
 *
 * Backed by `useState` so the value is consistent across components, layouts
 * and route middleware (where `useAsyncData` is awkward to consume).
 *
 * In-flight requests are deduplicated via a shared promise; the profile is
 * automatically refetched when the authenticated user changes and cleared
 * on sign-out.
 */
export function useUserProfile() {
  const user = useSupabaseUser();
  const client = useSupabaseClient<Database>();

  const profile = useState<Profile | null>('user-profile', () => null);
  const loading = useState<boolean>('user-profile-loading', () => false);
  const inflight = useState<Promise<Profile | null> | null>(
    'user-profile-inflight',
    () => null,
  );
  const loadedFor = useState<string | null>('user-profile-loaded-for', () => null);

  async function refresh(): Promise<Profile | null> {
    const id = user.value?.sub;
    if (!id) {
      profile.value = null;
      loadedFor.value = null;
      return null;
    }

    if (inflight.value) return inflight.value;

    loading.value = true;
    inflight.value = (async () => {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      profile.value = data as Profile;
      loadedFor.value = id;
      return profile.value;
    })();

    try {
      return await inflight.value;
    } finally {
      inflight.value = null;
      loading.value = false;
    }
  }

  /** Fetch the profile only if it isn't already loaded for the current user. */
  async function ensureLoaded(): Promise<Profile | null> {
    const id = user.value?.sub ?? null;
    if (id && loadedFor.value === id && profile.value) return profile.value;
    return refresh();
  }

  // Auto-sync with the reactive user: refetch on login / user switch, clear on logout.
  // The watcher is installed once per Nuxt app instance via a plugin-scoped flag
  // so repeated `useUserProfile()` calls don't register duplicate watchers.
  const nuxtApp = useNuxtApp();
  if (import.meta.client && !nuxtApp._userProfileWatcherInstalled) {
    nuxtApp._userProfileWatcherInstalled = true;
    watch(
      () => user.value?.sub ?? null,
      (id) => {
        if (id) {
          if (loadedFor.value !== id) refresh();
        } else {
          profile.value = null;
          loadedFor.value = null;
        }
      },
      { immediate: true },
    );
  }

  const isAdmin = computed(() => profile.value?.role === 'admin');
  const hasScope = (scope: UserScope) =>
    isAdmin.value || (profile.value?.scopes.includes(scope) ?? false);
  const hasAnyCampaignScope = computed(() => {
    if (isAdmin.value) return true;
    return profile.value?.scopes.some((s) => s.startsWith('campaign:')) ?? false;
  });
  const accessibleCampaignScopes = computed<UserScope[]>(() => {
    if (!profile.value) return [];
    return profile.value.scopes.filter((s) => s.startsWith('campaign:'));
  });

  return {
    profile,
    loading,
    isAdmin,
    hasScope,
    hasAnyCampaignScope,
    accessibleCampaignScopes,
    refresh,
    ensureLoaded,
  };
}
