'use client';

import { useAuth } from './useAuth';

/**
 * Permissões disponíveis para funcionários (EMPLOYEE).
 * OWNER sempre tem acesso total — sem restrições.
 *
 * Espelha PERMISSIONS em backend/src/middleware/requirePermission.ts —
 * as duas listas precisam andar juntas.
 *
 * view_orders       → Aba Pedidos de Reposição
 * view_cost_price   → Ver preço de custo e margem
 * manage_products   → Criar/editar/excluir produtos
 * view_analytics    → Abas Analytics e Insights
 * upload            → Aba Importar planilhas
 * manage_inventory  → Contagens e movimentações de estoque
 * cancel_sale       → Cancelar/estornar venda
 * view_audit        → Tela de Auditoria
 * view_financials   → Dashboard, faturamento e dinheiro em estoque
 */
export type Permission =
  | 'view_orders'
  | 'view_cost_price'
  | 'manage_products'
  | 'view_analytics'
  | 'upload'
  | 'manage_inventory'
  | 'cancel_sale'
  | 'view_audit'
  | 'view_financials';

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
      case '/inventory':   return can('manage_inventory');
      case '/audit':       return can('view_audit');
      // Calendário e Configurações mostram o caixa e os ajustes da loja
      case '/finance':     return false; // apenas OWNER
      // Dashboard é só número de negócio: faturamento do dia, ticket médio e
      // quanto a loja tem parado em estoque. Sem view_financials ela nem entra.
      case '/dashboard':   return can('view_financials');
      case '/settings':    return false; // apenas OWNER
      default:             return true;  // produtos e vendas
    }
  }

  /**
   * Primeira tela do usuário ao entrar.
   *
   * Sem o dashboard, mandar para `/dashboard` jogaria a vendedora num redirect
   * logo após o login. O PDV é onde ela trabalha.
   */
  function homeRoute(): string {
    return canAccessRoute('/dashboard') ? '/dashboard' : '/sales';
  }

  return { can, isAdmin, canAccessRoute, homeRoute, isOwner, permissions };
}
