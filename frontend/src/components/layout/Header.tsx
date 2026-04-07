'use client';

import { usePathname } from 'next/navigation';
import { Bell, LogOut, User, Menu } from 'lucide-react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Insight } from '@/types';
import { useSidebar } from './SidebarContext';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Produtos & Inventário',
  '/sales': 'Vendas',
  '/orders': 'Pedidos de Reposição',
  '/analytics': 'Analytics',
  '/insights': 'Insights',
  '/upload': 'Importar Planilha',
  '/settings': 'Configurações',
};

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const logout = useLogout();
  const { toggle } = useSidebar();

  const { data: insightsData } = useQuery({
    queryKey: ['insights', 'stock'],
    queryFn: () => api.get<Insight[]>('/api/insights/stock'),
    staleTime: 5 * 60 * 1000,
  });

  const dangerInsights = insightsData?.data?.filter((i) => i.severity === 'danger') ?? [];

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] ?? 'Lumine';

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-lumine-lavender-pale shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — só aparece em mobile */}
        <button
          onClick={toggle}
          className="md:hidden p-2 rounded-xl hover:bg-lumine-lavender-pale transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} strokeWidth={1.5} className="text-lumine-sage-dark" />
        </button>
        <h1 className="font-heading text-xl sm:text-2xl text-lumine-sage-dark">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notificações */}
        <button className="relative p-2 rounded-xl hover:bg-lumine-lavender-pale transition-colors">
          <Bell size={20} strokeWidth={1.5} className="text-lumine-warm-gray" />
          {dangerInsights.length > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-lumine-danger rounded-full flex items-center justify-center text-white text-[10px] font-bold">
              {dangerInsights.length}
            </span>
          )}
        </button>

        {/* User info */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-lumine-lavender-pale">
          <div className="w-8 h-8 rounded-full bg-lumine-lavender-pale flex items-center justify-center">
            <User size={16} strokeWidth={1.5} className="text-lumine-lavender" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-lumine-charcoal leading-none">{user?.name}</p>
            <p className="text-xs text-lumine-warm-gray mt-0.5">
              {user?.role === 'OWNER' ? 'Administrador' : 'Funcionário'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout.mutate()}
            className="ml-1"
            title="Sair"
          >
            <LogOut size={16} strokeWidth={1.5} className="text-lumine-warm-gray" />
          </Button>
        </div>
      </div>
    </header>
  );
}
