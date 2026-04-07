'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Users, Tag, Download, Plus, ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { User } from '@/types';
import { toast } from '@/hooks/use-toast';

const TABS = [
  { id: 'store', label: 'Loja', icon: Settings },
  { id: 'categories', label: 'Categorias', icon: Tag },
  { id: 'users', label: 'Usuários', icon: Users },
];

const ALL_PERMISSIONS = [
  { key: 'view_orders', label: 'Ver Pedidos de Reposição', description: 'Acesso à aba de pedidos' },
  { key: 'view_cost_price', label: 'Ver Preço de Custo', description: 'Visualizar custo dos produtos' },
  { key: 'manage_products', label: 'Gerenciar Produtos', description: 'Criar, editar e excluir produtos' },
  { key: 'view_analytics', label: 'Ver Analytics', description: 'Acesso ao dashboard de análises' },
  { key: 'upload', label: 'Importar Planilhas', description: 'Upload em massa de produtos' },
];

interface UserWithPermissions extends User {
  permissions: string[];
}

function PermissionToggles({ userId, currentPermissions, disabled }: {
  userId: string;
  currentPermissions: string[];
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [perms, setPerms] = useState<string[]>(currentPermissions);

  const mutation = useMutation({
    mutationFn: (permissions: string[]) =>
      api.patch(`/api/settings/users/${userId}/permissions`, { permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Permissões atualizadas!' });
    },
    onError: () => toast({ title: 'Erro ao atualizar permissões', variant: 'destructive' }),
  });

  const toggle = (key: string) => {
    const next = perms.includes(key) ? perms.filter((p) => p !== key) : [...perms, key];
    setPerms(next);
  };

  return (
    <div className="mt-3 pt-3 border-t border-lumine-lavender-pale space-y-2">
      <p className="text-xs font-medium text-lumine-warm-gray mb-2">Permissões de acesso</p>
      <div className="grid grid-cols-1 gap-2">
        {ALL_PERMISSIONS.map((perm) => {
          const active = perms.includes(perm.key);
          return (
            <button
              key={perm.key}
              onClick={() => toggle(perm.key)}
              disabled={disabled}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                active
                  ? 'border-lumine-lavender bg-lumine-lavender-pale/50 text-lumine-charcoal'
                  : 'border-lumine-lavender-pale text-lumine-warm-gray hover:bg-lumine-lavender-pale/20'
              }`}
            >
              <div>
                <p className="text-xs font-medium">{perm.label}</p>
                <p className="text-xs opacity-70">{perm.description}</p>
              </div>
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-3 ${
                active ? 'bg-lumine-lavender border-lumine-lavender' : 'border-lumine-lavender-pale'
              }`}>
                {active && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>
      <Button
        size="sm"
        className="w-full mt-2"
        onClick={() => mutation.mutate(perms)}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
        Salvar permissões
      </Button>
    </div>
  );
}

function UserCard({ user, onToggle, toggling }: {
  user: UserWithPermissions;
  onToggle: () => void;
  toggling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOwner = user.role === 'OWNER';

  return (
    <div className="rounded-xl border border-lumine-lavender-pale overflow-hidden">
      <div className="flex items-center justify-between p-4 hover:bg-lumine-lavender-pale/20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-lumine-lavender-pale flex items-center justify-center shrink-0">
            <span className="text-lumine-lavender font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-lumine-charcoal">{user.name}</p>
            <p className="text-xs text-lumine-warm-gray">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOwner ? 'sage' : 'default'}>
            {isOwner ? 'Admin' : 'Funcionário'}
          </Badge>
          <Badge variant={user.active ? 'success' : 'danger'}>
            {user.active ? 'Ativo' : 'Inativo'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            disabled={toggling || isOwner}
          >
            {user.active ? 'Desativar' : 'Ativar'}
          </Button>
          {!isOwner && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-lumine-lavender-pale transition-colors text-lumine-warm-gray"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && !isOwner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <PermissionToggles
                userId={user.id}
                currentPermissions={user.permissions ?? []}
                disabled={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    name: string;
    email: string;
    password: string;
    role: 'OWNER' | 'EMPLOYEE';
  }>({ defaultValues: { role: 'EMPLOYEE' } });

  const mutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string; permissions: string[] }) =>
      api.post('/api/settings/users', data),
    onSuccess: () => {
      toast({ title: 'Usuário criado com sucesso!' });
      reset();
      setOpen(false);
      onSuccess();
    },
    onError: (err) =>
      toast({ title: 'Erro ao criar usuário', description: err instanceof Error ? err.message : '', variant: 'destructive' }),
  });

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="mb-4"
      >
        <Plus size={14} className="mr-1.5" />
        Novo Usuário
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <form
              onSubmit={handleSubmit((d) => mutation.mutate({ ...d, permissions: [] }))}
              className="p-4 rounded-xl border border-lumine-lavender bg-lumine-lavender-pale/20 space-y-3"
            >
              <p className="font-heading text-sm text-lumine-sage-dark mb-1">Criar novo usuário</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    {...register('name', { required: true })}
                    placeholder="Nome completo"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    {...register('email', { required: true })}
                    type="email"
                    placeholder="email@loja.com"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Senha</Label>
                  <Input
                    {...register('password', { required: true, minLength: 6 })}
                    type="password"
                    placeholder="Mín. 6 caracteres"
                    className="h-9 text-sm"
                  />
                  {errors.password && (
                    <p className="text-xs text-lumine-danger">Mínimo 6 caracteres</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Perfil</Label>
                  <select
                    {...register('role')}
                    className="flex h-9 w-full rounded-xl border border-lumine-lavender-pale bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumine-lavender"
                  >
                    <option value="EMPLOYEE">Funcionário</option>
                    <option value="OWNER">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={mutation.isPending} className="flex-1">
                  {mutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                  Criar usuário
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('store');
  const qc = useQueryClient();

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, string | number>>('/api/settings'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Array<{
      id: string; name: string; icon?: string;
      _count: { products: number };
      subcategories: Array<{ id: string; name: string }>;
    }>>('/api/settings/categories'),
    enabled: activeTab === 'categories',
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserWithPermissions[]>('/api/settings/users'),
    enabled: activeTab === 'users',
  });

  const settings = settingsData?.data ?? {};
  const categories = categoriesData?.data ?? [];
  const users = usersData?.data ?? [];

  const { register, handleSubmit } = useForm({
    values: {
      store_name: String(settings.store_name ?? ''),
      store_email: String(settings.store_email ?? ''),
      store_phone: String(settings.store_phone ?? ''),
      store_address: String(settings.store_address ?? ''),
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/api/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Configurações salvas!' });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/settings/users/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <PermissionGuard ownerOnly>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-lumine-lavender-pale/50 p-1 rounded-xl w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-lumine-sage-dark shadow-sm'
                  : 'text-lumine-warm-gray hover:text-lumine-charcoal'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Store Settings */}
      {activeTab === 'store' && (
        <Card>
          <CardHeader>
            <CardTitle>Perfil da Loja</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((d) => updateSettingsMutation.mutate(d))} className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label>Nome da loja</Label>
                <Input {...register('store_name')} placeholder="Lumine" />
              </div>
              <div className="space-y-1.5">
                <Label>Email de contato</Label>
                <Input {...register('store_email')} type="email" placeholder="contato@loja.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input {...register('store_phone')} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input {...register('store_address')} placeholder="Rua..." />
              </div>
              <Button type="submit" disabled={updateSettingsMutation.isPending}>
                Salvar Configurações
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-lumine-lavender-pale">
              <h3 className="font-heading text-base text-lumine-sage-dark mb-3">Backup</h3>
              <p className="text-sm text-lumine-warm-gray mb-3">
                Solicite um backup completo do banco de dados.
              </p>
              <Button
                variant="outline"
                onClick={() => api.post('/api/settings/backup').then(() =>
                  toast({ title: 'Backup solicitado. Verifique com o administrador.' })
                )}
              >
                <Download size={14} className="mr-2" />
                Solicitar Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      {activeTab === 'categories' && (
        <Card>
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-lumine-warm-gray">Nenhuma categoria cadastrada</p>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-lumine-lavender-pale hover:bg-lumine-lavender-pale/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat.icon ?? '📦'}</span>
                      <div>
                        <p className="font-medium text-lumine-charcoal">{cat.name}</p>
                        <p className="text-xs text-lumine-warm-gray">
                          {cat._count.products} produtos · {cat.subcategories.length} subcategorias
                        </p>
                      </div>
                    </div>
                    <Badge variant="default">{cat._count.products}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <NewUserForm onSuccess={() => qc.invalidateQueries({ queryKey: ['users'] })} />

            {users.length === 0 ? (
              <p className="text-sm text-lumine-warm-gray">Nenhum usuário cadastrado</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onToggle={() => toggleUserMutation.mutate(user.id)}
                    toggling={toggleUserMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
    </PermissionGuard>
  );
}
