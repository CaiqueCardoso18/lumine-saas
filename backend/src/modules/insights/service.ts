import { prisma } from '../../config/database';

export interface Insight {
  id: string;
  type: 'stock_alert' | 'slow_mover' | 'depletion_risk' | 'top_performer' | 'best_day' | 'category_growth';
  severity: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  description: string;
  action?: string;
  metadata?: object;
}

export async function getStockInsights(): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Produtos com estoque crítico (0 unidades)
  const zeroStock = await prisma.$queryRaw<Array<{ id: string; name: string; sku: string }>>`
    SELECT id, name, sku FROM products
    WHERE deleted_at IS NULL AND status = 'ACTIVE' AND quantity = 0
    LIMIT 10
  `;

  for (const p of zeroStock) {
    insights.push({
      id: `zero-stock-${p.id}`,
      type: 'stock_alert',
      severity: 'danger',
      title: `Estoque zerado: ${p.name}`,
      description: `O produto ${p.sku} está sem estoque. Crie um pedido de reposição.`,
      action: 'Criar pedido de reposição',
      metadata: { productId: p.id, sku: p.sku },
    });
  }

  // Produtos abaixo do estoque mínimo
  const lowStock = await prisma.$queryRaw<Array<{
    id: string; name: string; sku: string; quantity: number; min_stock: number;
  }>>`
    SELECT id, name, sku, quantity, min_stock FROM products
    WHERE deleted_at IS NULL AND status = 'ACTIVE' AND quantity > 0 AND quantity <= min_stock
    ORDER BY (quantity::float / NULLIF(min_stock, 0)) ASC
    LIMIT 10
  `;

  for (const p of lowStock) {
    insights.push({
      id: `low-stock-${p.id}`,
      type: 'stock_alert',
      severity: 'warning',
      title: `Estoque baixo: ${p.name}`,
      description: `Restam apenas ${p.quantity} unidades (mínimo: ${p.min_stock}).`,
      action: 'Ver produto',
      metadata: { productId: p.id, sku: p.sku, quantity: p.quantity, minStock: p.min_stock },
    });
  }

  return insights;
}

export async function getSalesInsights(): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Produtos sem venda há mais de 30 dias
  const slowMovers = await prisma.$queryRaw<Array<{
    id: string; name: string; sku: string; last_sale: Date | null; quantity: number;
  }>>`
    SELECT
      p.id, p.name, p.sku, p.quantity,
      MAX(s.created_at) as last_sale
    FROM products p
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON s.id = si.sale_id AND s.status = 'COMPLETED'
    WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE' AND p.quantity > 0
    GROUP BY p.id, p.name, p.sku, p.quantity
    HAVING MAX(s.created_at) < NOW() - INTERVAL '30 days' OR MAX(s.created_at) IS NULL
    ORDER BY last_sale ASC NULLS FIRST
    LIMIT 5
  `;

  for (const p of slowMovers) {
    const daysSince = p.last_sale
      ? Math.floor((Date.now() - new Date(p.last_sale).getTime()) / 86400000)
      : null;

    insights.push({
      id: `slow-mover-${p.id}`,
      type: 'slow_mover',
      severity: 'warning',
      title: `Produto parado: ${p.name}`,
      description: daysSince
        ? `Sem vendas há ${daysSince} dias. Considere uma promoção.`
        : `Nunca vendido. Avalie remover ou promover.`,
      action: 'Criar promoção',
      metadata: { productId: p.id, daysSince },
    });
  }

  // Previsão de esgotamento
  const depletionRisk = await prisma.$queryRaw<Array<{
    id: string; name: string; sku: string; quantity: number;
    daily_avg: number; days_remaining: number;
  }>>`
    SELECT
      p.id, p.name, p.sku, p.quantity,
      COALESCE(SUM(si.quantity)::float / 30, 0) as daily_avg,
      CASE
        WHEN COALESCE(SUM(si.quantity)::float / 30, 0) > 0
        THEN ROUND(p.quantity::float / (SUM(si.quantity)::float / 30))
        ELSE 9999
      END as days_remaining
    FROM products p
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON s.id = si.sale_id
      AND s.status = 'COMPLETED'
      AND s.created_at >= NOW() - INTERVAL '30 days'
    WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE' AND p.quantity > 0
    GROUP BY p.id, p.name, p.sku, p.quantity
    HAVING CASE
      WHEN COALESCE(SUM(si.quantity)::float / 30, 0) > 0
      THEN ROUND(p.quantity::float / (SUM(si.quantity)::float / 30))
      ELSE 9999
    END < 14
    ORDER BY days_remaining ASC
    LIMIT 5
  `;

  for (const p of depletionRisk) {
    insights.push({
      id: `depletion-${p.id}`,
      type: 'depletion_risk',
      severity: p.days_remaining <= 7 ? 'danger' : 'warning',
      title: `Vai esgotar em ~${Math.round(p.days_remaining)} dias: ${p.name}`,
      description: `Vendendo ${p.daily_avg.toFixed(1)} unidades/dia. Estoque atual: ${p.quantity}.`,
      action: 'Criar pedido de reposição',
      metadata: { productId: p.id, daysRemaining: p.days_remaining, dailyAvg: p.daily_avg },
    });
  }

  // Melhor dia da semana
  const [bestDay] = await prisma.$queryRaw<Array<{
    day_name: string; avg_revenue: number; count: bigint;
  }>>`
    SELECT
      TO_CHAR(created_at, 'Day') as day_name,
      AVG(total) as avg_revenue,
      COUNT(*) as count
    FROM sales
    WHERE status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
    ORDER BY avg_revenue DESC
    LIMIT 1
  `;

  if (bestDay) {
    insights.push({
      id: 'best-day',
      type: 'best_day',
      severity: 'success',
      title: `Melhor dia: ${bestDay.day_name.trim()}`,
      description: `${bestDay.day_name.trim()} tem o maior faturamento médio: R$ ${Number(bestDay.avg_revenue).toFixed(2)}`,
      metadata: { dayName: bestDay.day_name.trim(), avgRevenue: Number(bestDay.avg_revenue) },
    });
  }

  return insights;
}

export async function getAllInsights() {
  const [stockInsights, salesInsights] = await Promise.all([
    getStockInsights(),
    getSalesInsights(),
  ]);

  const all = [...stockInsights, ...salesInsights];

  // Ordenar por severidade
  const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 };
  all.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return all;
}
