/**
 * Lista de permissões da role EMPLOYEE.
 *
 * Fica em arquivo próprio, sem importar Prisma, para poder ser testada e
 * importada sem subir conexão de banco — `requirePermission.ts` precisa do
 * client, mas a lista em si é só dado.
 *
 * `frontend/src/hooks/usePermission.ts` e a tela de Configurações espelham
 * esta lista: as três precisam andar juntas.
 */
export const PERMISSIONS = [
  'view_orders',      // aba Pedidos de Reposição
  'view_cost_price',  // ver preço de custo e margem
  'manage_products',  // criar/editar/excluir produtos
  'view_analytics',   // abas Analytics e Insights
  'upload',           // importar planilha
  'manage_inventory', // sessões de contagem e movimentações de estoque
  'cancel_sale',      // cancelar/estornar venda
  'view_audit',       // tela de auditoria
  'view_financials',  // dashboard, faturamento, dinheiro em estoque
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissões que uma vendedora recebe por padrão ao ser criada.
 *
 * Critério: ela precisa vender e consultar produto. Não precisa ver custo
 * (margem é informação do dono), nem mexer no cadastro, nem cancelar venda —
 * estorno mexe em estoque e caixa, então passa pelo dono.
 *
 * `view_financials` fica de fora pelo mesmo motivo: faturamento do dia, ticket
 * médio e o quanto a loja tem parado em estoque são números do negócio, não
 * ferramentas de trabalho. Antes o dashboard inteiro era aberto a qualquer
 * usuário logado.
 */
export const DEFAULT_EMPLOYEE_PERMISSIONS: Permission[] = ['manage_inventory'];
