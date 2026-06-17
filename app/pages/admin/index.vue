<script setup lang="ts">
import type { Profile, AppRole, UserScope } from '~/types/profile.types';
import { CAMPAIGN_SCOPES } from '~/utils/campaignScopes';

definePageMeta({ layout: 'dashboard', middleware: 'admin' });

const { t } = useI18n();
const toast = useToast();
const api = useApi();

const AVAILABLE_SCOPES: UserScope[] = [...CAMPAIGN_SCOPES];

const users = ref<Profile[]>([]);
const loadingUsers = ref(false);
const dialogOpen = ref(false);
const deleteDialogOpen = ref(false);
const saving = ref(false);

const editingUser = ref<Profile | null>(null);
const deleteTarget = ref<Profile | null>(null);

const form = reactive({
  email: '',
  password: '',
  full_name: '',
  role: 'user' as AppRole,
  scopes: [] as UserScope[],
});

function resetForm() {
  form.email = '';
  form.password = '';
  form.full_name = '';
  form.role = 'user';
  form.scopes = [];
}

async function fetchUsers() {
  loadingUsers.value = true;
  try {
    users.value = await api<Profile[]>('/api/admin/users');
  } catch (err) {
    const e = extractApiError(err);
    toast.error(t('admin.fetchError'), {
      code: e.code,
      description: e.message,
    });
  } finally {
    loadingUsers.value = false;
  }
}

function openCreate() {
  editingUser.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(user: Profile) {
  editingUser.value = user;
  form.email = user.email;
  form.password = '';
  form.full_name = user.full_name;
  form.role = user.role;
  form.scopes = [...user.scopes];
  dialogOpen.value = true;
}

function openDelete(user: Profile) {
  deleteTarget.value = user;
  deleteDialogOpen.value = true;
}

function toggleScope(scope: UserScope) {
  const idx = form.scopes.indexOf(scope);
  if (idx === -1) {
    form.scopes.push(scope);
  } else {
    form.scopes.splice(idx, 1);
  }
}

async function handleSave() {
  saving.value = true;

  try {
    if (editingUser.value) {
      await api(`/api/admin/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: {
          full_name: form.full_name,
          role: form.role,
          scopes: form.scopes,
        },
      });
    } else {
      await api('/api/admin/users', {
        method: 'POST',
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          scopes: form.scopes,
        },
      });
    }

    dialogOpen.value = false;
    await fetchUsers();
    toast.success(editingUser.value ? t('admin.updateSuccess') : t('admin.createSuccess'));
  } catch (err: unknown) {
    const e = extractApiError(err);
    toast.error(t('admin.saveError'), { code: e.code, description: e.message });
  }

  saving.value = false;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  saving.value = true;

  try {
    await api(`/api/admin/users/${deleteTarget.value.id}`, {
      method: 'DELETE',
    });

    deleteDialogOpen.value = false;
    deleteTarget.value = null;
    await fetchUsers();
    toast.success(t('admin.deleteSuccess'));
  } catch (err: unknown) {
    const e = extractApiError(err);
    toast.error(t('admin.deleteError'), { code: e.code, description: e.message });
  }

  saving.value = false;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

onMounted(fetchUsers);
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('admin.title') }}
        </h1>
        <p class="mt-1 text-muted-foreground">{{ t('admin.subtitle') }}</p>
      </div>
      <Button @click="openCreate">
        <Icon name="lucide:plus" class="mr-2 size-4" />
        {{ t('admin.createUser') }}
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="loadingUsers" class="flex items-center justify-center py-12">
          <Icon
            name="lucide:loader-2"
            class="size-6 animate-spin text-muted-foreground"
          />
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('admin.colName') }}</TableHead>
              <TableHead>{{ t('admin.colEmail') }}</TableHead>
              <TableHead>{{ t('admin.colRole') }}</TableHead>
              <TableHead>{{ t('admin.colScopes') }}</TableHead>
              <TableHead>{{ t('admin.colCreated') }}</TableHead>
              <TableHead class="w-[100px]">{{ t('admin.colActions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="u in users" :key="u.id">
              <TableCell class="font-medium">{{ u.full_name || '—' }}</TableCell>
              <TableCell>{{ u.email }}</TableCell>
              <TableCell>
                <Badge :variant="u.role === 'admin' ? 'default' : 'secondary'">
                  {{ u.role }}
                </Badge>
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="scope in u.scopes"
                    :key="scope"
                    variant="outline"
                  >
                    {{ scope }}
                  </Badge>
                  <span
                    v-if="!u.scopes.length"
                    class="text-sm text-muted-foreground"
                  >—</span>
                </div>
              </TableCell>
              <TableCell>{{ formatDate(u.created_at) }}</TableCell>
              <TableCell>
                <div class="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        @click="openEdit(u)"
                      >
                        <Icon name="lucide:pencil" class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{{ t('common.edit') }}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        @click="openDelete(u)"
                      >
                        <Icon
                          name="lucide:trash-2"
                          class="size-4 text-destructive"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{{ t('common.delete') }}</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="!users.length">
              <TableCell :colspan="6" class="py-8 text-center text-muted-foreground">
                {{ t('admin.noUsers') }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Create/Edit Dialog -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ editingUser ? t('admin.editUser') : t('admin.createUser') }}
          </DialogTitle>
          <DialogDescription>
            {{ editingUser ? t('admin.editUserDescription') : t('admin.createUserDescription') }}
          </DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="handleSave">
          <div class="space-y-2">
            <Label for="user-name">{{ t('admin.colName') }}</Label>
            <Input
              id="user-name"
              v-model="form.full_name"
              :placeholder="t('admin.namePlaceholder')"
            />
          </div>

          <div v-if="!editingUser" class="space-y-2">
            <Label for="user-email">{{ t('admin.colEmail') }}</Label>
            <Input
              id="user-email"
              v-model="form.email"
              type="email"
              required
              :placeholder="t('admin.emailPlaceholder')"
            />
          </div>

          <div v-if="!editingUser" class="space-y-2">
            <Label for="user-password">{{ t('auth.password') }}</Label>
            <Input
              id="user-password"
              v-model="form.password"
              type="password"
              required
              minlength="8"
              :placeholder="t('admin.passwordPlaceholder')"
            />
          </div>

          <div class="space-y-2">
            <Label for="user-role">{{ t('admin.colRole') }}</Label>
            <Select v-model="form.role">
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-3">
            <Label>{{ t('admin.colScopes') }}</Label>
            <div
              v-for="scope in AVAILABLE_SCOPES"
              :key="scope"
              class="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <Label :for="`scope-${scope}`" class="cursor-pointer font-normal">
                {{ scope }}
              </Label>
              <Switch
                :id="`scope-${scope}`"
                :checked="form.scopes.includes(scope)"
                @update:checked="toggleScope(scope)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="dialogOpen = false"
            >
              {{ t('common.cancel') }}
            </Button>
            <Button type="submit" :disabled="saving">
              <Icon
                v-if="saving"
                name="lucide:loader-2"
                class="mr-2 size-4 animate-spin"
              />
              {{ t('common.save') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('admin.deleteUser') }}</DialogTitle>
          <DialogDescription>
            {{ t('admin.deleteConfirm', { email: deleteTarget?.email ?? '' }) }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            @click="deleteDialogOpen = false"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            variant="destructive"
            :disabled="saving"
            @click="handleDelete"
          >
            <Icon
              v-if="saving"
              name="lucide:loader-2"
              class="mr-2 size-4 animate-spin"
            />
            {{ t('common.delete') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
