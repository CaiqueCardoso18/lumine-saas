'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermission, Permission } from '@/hooks/usePermission';
import { ShieldX } from 'lucide-react';

interface Props {
  /** Permissão necessária para acessar a página (opcional se ownerOnly=true) */
  permission?: Permission;
  /** Somente OWNER pode acessar */
  ownerOnly?: boolean;
  children: React.ReactNode;
}

/**
 * Envolve o conteúdo de uma página e bloqueia acesso se o usuário
 * não tiver a permissão necessária. OWNER sempre passa.
 */
export function PermissionGuard({ permission, ownerOnly = false, children }: Props) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { can, isOwner } = usePermission();

  const hasAccess = (() => {
    if (!user) return false;
    if (isOwner) return true;
    if (ownerOnly) return false;
    if (permission) return can(permission);
    return true;
  })();

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, hasAccess, router]);

  if (isLoading) return null;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-lumine-warm-gray">
        <ShieldX size={48} strokeWidth={1} className="text-lumine-lavender-pale" />
        <div className="text-center">
          <p className="font-heading text-lg text-lumine-sage-dark">Acesso restrito</p>
          <p className="text-sm mt-1">Você não tem permissão para acessar esta seção.</p>
          <p className="text-xs mt-1 opacity-70">Solicite acesso ao administrador.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
