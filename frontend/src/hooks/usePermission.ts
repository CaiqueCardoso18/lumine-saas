'use client';

import { useAuth } from './useAuth';

/**
 * Permissões disponíveis para funcionários (EMPLOYEE).
 * OWNER sempre tem acesso total — sem restrições.
 *
 * view_orders      → Aba Pedidos de Reposição
 * view_cost_price  → Ver preço de custo nos produtos/analytics
 * manage_products  → Criar/editar/excluir produtos e importar planilhas
 * view_analytics   → Aba Analytics e Insights
 * upload           → Aba Importar planilhas
 */
export type Permission =
  | 'view_orders'
  | 'view_cost_price'
  | 'manage_products'
  | 'view_analytics'
  | 'upload';

export function usePermission() {
  const { user } = useAuth();

  const isOwner = user?.role === 'OWNER';
  const permissions: string[] = Array.isArray(user?.permissions) ? user!.permissions : [];

  /** Verifica se o usuário tem a permissão (OWNER sempre retorna true) */
  function can(permission: Permission): boolean {
    if (!user) return false;
    if (isOwner) return true;
    return permissions.includes(permission);
  }

  /** Verifica se o usuário é OWNER */
  function isAdmin(): boolean {
    return isOwner;
  }

  /**
   * Retorna true se o usuário pode acessar determinada rota.
   * Usado no Sidebar e nos guards de página.
   */
  function canAccessRoute(href: string): boolean {
    if (!user) return false;
    if (isOwner) return true;

    switch (href) {
      case '/orders':      return can('view_orders');
      case '/analytics':   return can('view_analytics');
      case '/insights':    return can('view_analytics');
      case '/upload':      return can('upload');
      case '/settings':    return false; // apenas OWNER
      default:             return true;  // dashboard, products, sales
    }
  }

  return { can, isAdmin, canAccessRoute, isOwner, permissions };
}
