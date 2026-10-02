import { PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS, type Permission } from '../permissions';

/**
 * A lista de permissões vive em três lugares: aqui, em
 * `frontend/src/hooks/usePermission.ts` e na tela de Configurações. Este teste
 * trava o backend, que é a fonte da verdade — se alguém adicionar uma
 * permissão sem espelhar nos outros dois, o frontend libera o que o servidor
 * barra (ou o contrário).
 */
describe('PERMISSIONS', () => {
  it('não tem duplicatas', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('contém exatamente as permissões esperadas', () => {
    expect([...PERMISSIONS].sort()).toEqual([
      'cancel_sale',
      'manage_inventory',
      'manage_products',
      'upload',
      'view_analytics',
      'view_audit',
      'view_cost_price',
      'view_financials',
      'view_orders',
    ]);
  });
});

describe('DEFAULT_EMPLOYEE_PERMISSIONS', () => {
  it('só contém permissões que existem', () => {
    for (const p of DEFAULT_EMPLOYEE_PERMISSIONS) {
      expect(PERMISSIONS).toContain(p);
    }
  });

  /**
   * Cada item abaixo já foi uma decisão consciente: a vendedora precisa
   * conseguir vender e contar estoque, e nada além disso por padrão.
   */
  const negadasPorPadrao: Permission[] = [
    'view_financials', // faturamento, ticket médio, dinheiro em estoque
    'view_cost_price', // margem é informação do dono
    'cancel_sale',     // estorno mexe em estoque e caixa
    'manage_products', // cadastro de produto
    'view_analytics',
    'view_audit',
    'upload',
    'view_orders',
  ];

  it.each(negadasPorPadrao)('não concede %s por padrão', (p) => {
    expect(DEFAULT_EMPLOYEE_PERMISSIONS).not.toContain(p);
  });

  it('concede apenas inventário por padrão', () => {
    expect(DEFAULT_EMPLOYEE_PERMISSIONS).toEqual(['manage_inventory']);
  });
});
