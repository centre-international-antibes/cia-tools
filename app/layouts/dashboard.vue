<script setup lang="ts">
const { t, locale } = useI18n();
const localePath = useLocalePath();
const client = useSupabaseClient();
const { profile, isAdmin, hasAnyCampaignScope } = useUserProfile();

useHead({
  htmlAttrs: { lang: locale },
});

const initials = computed(() => {
  const name = profile.value?.full_name || profile.value?.email || '';
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
});

async function handleLogout() {
  await client.auth.signOut();
  await navigateTo(localePath('/login'));
}
</script>

<template>
  <div class="min-h-dvh bg-background">
    <header
      class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div class="mx-auto flex h-14 max-w-container items-center gap-6 px-6">
        <NuxtLink :to="localePath('/dashboard')" class="flex shrink-0 items-center">
          <Icon name="cia:logo-sigle" class="h-8 w-auto text-cia-blue" mode="svg" />
        </NuxtLink>

        <nav class="flex items-center gap-1">
          <NuxtLink
            :to="localePath('/dashboard')"
            class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            active-class="bg-accent text-foreground"
          >
            {{ t('nav.dashboard') }}
          </NuxtLink>
          <NuxtLink
            v-if="hasAnyCampaignScope"
            :to="localePath('/dashboard/campaigns')"
            class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            active-class="bg-accent text-foreground"
          >
            {{ t('nav.campaigns') }}
          </NuxtLink>
          <NuxtLink
            v-if="isAdmin"
            :to="localePath('/admin')"
            class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            active-class="bg-accent text-foreground"
          >
            {{ t('nav.admin') }}
          </NuxtLink>
        </nav>

        <div class="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="sm" class="gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-xs">{{ initials }}</AvatarFallback>
                </Avatar>
                <span class="hidden text-sm sm:inline">
                  {{ profile?.full_name || profile?.email }}
                </span>
                <Icon name="lucide:chevron-down" class="size-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuLabel class="flex flex-col gap-1 font-normal">
                <span class="text-sm font-medium">{{ profile?.full_name }}</span>
                <span class="text-xs text-muted-foreground">{{ profile?.email }}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="cursor-pointer" @click="handleLogout">
                <Icon name="lucide:log-out" class="mr-2 size-4" />
                {{ t('auth.logout') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-container px-6 py-8">
      <slot />
    </main>
  </div>
</template>
