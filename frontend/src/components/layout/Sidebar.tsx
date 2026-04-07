'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp, Lightbulb,
  Upload, Settings, ChevronLeft, ChevronRight, ClipboardList, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermission } from '@/hooks/usePermission';
import { useSidebar } from './SidebarContext';

const navItems = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/products',   icon: Package,          label: 'Produtos'     },
  { href: '/sales',      icon: ShoppingCart,     label: 'Vendas'       },
  { href: '/orders',     icon: ClipboardList,    label: 'Pedidos'      },
  { href: '/analytics',  icon: TrendingUp,       label: 'Analytics'    },
  { href: '/insights',   icon: Lightbulb,        label: 'Insights'     },
  { href: '/upload',     icon: Upload,           label: 'Importar'     },
  { href: '/settings',   icon: Settings,         label: 'Configurações'},
];

function NavContent({ collapsed, onLinkClick }: { collapsed: boolean; onLinkClick?: () => void }) {
  const pathname = usePathname();
  const { canAccessRoute } = usePermission();
  const visibleItems = navItems.filter((item) => canAccessRoute(item.href));

  return (
    <nav className="flex-1 py-4 px-2 space-y-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
              isActive
                ? 'bg-lumine-lavender text-white shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon
              className={cn(
                'shrink-0 transition-transform duration-200 group-hover:scale-110',
                collapsed ? 'mx-auto' : '',
                isActive ? 'text-white' : ''
              )}
              size={20}
              strokeWidth={1.5}
            />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        );
      })}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center h-16 px-4 border-b border-white/10 overflow-hidden">
      <AnimatePresence mode="wait">
        {!collapsed ? (
          <motion.div
            key="full-logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-lumine-lavender flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-accent font-bold">L</span>
            </div>
            <span className="text-white font-accent font-semibold text-lg whitespace-nowrap">
              Lumine.io
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="icon-logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-8 h-8 rounded-full bg-lumine-lavender flex items-center justify-center mx-auto"
          >
            <span className="text-white text-xs font-accent font-bold">L</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sidebar Desktop ──────────────────────────────────────────
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, close } = useSidebar();

  return (
    <>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <motion.aside
        key="mobile-sidebar"
        initial={{ x: '-100%' }}
        animate={{ x: mobileOpen ? 0 : '-100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed inset-y-0 left-0 w-64 flex flex-col bg-lumine-sage-dark z-40 md:hidden shadow-xl"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-lumine-lavender flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-accent font-bold">L</span>
            </div>
            <span className="text-white font-accent font-semibold text-lg">Lumine.io</span>
          </div>
          <button onClick={close} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <NavContent collapsed={false} onLinkClick={close} />
      </motion.aside>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="relative hidden md:flex flex-col bg-lumine-sage-dark min-h-screen shrink-0"
      >
        <Logo collapsed={collapsed} />
        <NavContent collapsed={collapsed} />

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-lumine-sage border-2 border-lumine-cream flex items-center justify-center hover:bg-lumine-lavender transition-colors duration-200 z-10"
        >
          {collapsed ? (
            <ChevronRight size={12} className="text-white" />
          ) : (
            <ChevronLeft size={12} className="text-white" />
          )}
        </button>
      </motion.aside>
    </>
  );
}
