import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

function getPeriodDates(period?: string, startDate?: string, endDate?: string) {
  const now = new Date();

  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate + 'T23:59:59.999Z') };
  }

  switch (period) {
    case 'day': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date() };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end: new Date() };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end: new Date() };
    }
    default: {
      // Últimos 30 dias
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date() };
    }
  }
}

const VALID_TRUNCS = ['day', 'week', 'month', 'year'] as const;

export async function getRevenue(
  period?: string,
  startDate?: string,
  endDate?: string,
  groupBy: string = 'day'
) {
  const { start, end } = getPeriodDates(period, startDate, endDate);

  // Usa Prisma.raw() para injetar o DATE_TRUNC como literal SQL (não parameterizado)
  // pois PostgreSQL não aceita DATE_TRUNC com o campo como parâmetro bind
  const trunc = VALID_TRUNCS.includes(groupBy as typeof VALID_TRUNCS[number]) ? groupBy : 'day';
  // Prisma.raw injeta como literal SQL — precisa das aspas para DATE_TRUNC reconhecer como string
  const truncRaw = Prisma.raw(`'${trunc}'`);

  const revenue = await prisma.$queryRaw<Array<{
    date: Date;
    total_revenue: string;
    total_sales: bigint;
    avg_ticket: string;
  }>>(
    Prisma.sql`
      SELECT
        DATE_TRUNC(${truncRaw}, created_at) AS date,
        SUM(total)::text AS total_revenue,
        COUNT(*) AS total_sales,
        AVG(total)::text AS avg_ticket
      FROM sales
      WHERE status = 'COMPLETED'
        AND created_at BETWEEN ${start} AND ${end}
      GROUP BY DATE_TRUNC(${truncRaw}, created_at)
      ORDER BY date ASC
    `
  );

  const [totals] = await prisma.$queryRaw<Array<{
    total: string;
    sales_count: bigint;
    avg: string;
  }>>(
    Prisma.sql`
      SELECT
        COALESCE(SUM(total), 0)::text AS total,
        COUNT(*) AS sales_count,
        COALESCE(AVG(total), 0)::text AS avg
      FROM sales
      WHERE status = 'COMPLETED'
        AND created_at BETWEEN ${start} AND ${end}
    `
  );

  return {
    period: { start, end, groupBy },
    summary: {
      totalRevenue: parseFloat(totals.total ?? '0'),
      totalSales: Number(totals.sales_count),
      avgTicket: parseFloat(totals.avg ?? '0'),
    },
    chart: revenue.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.total_revenue ?? '0'),
      sales: Number(r.total_sales),
      avgTicket: parseFloat(r.avg_ticket ?? '0'),
    })),
  };
}

export async function getTopProducts(
  period?: string,
  startDate?: string,
  endDate?: string,
  limit = 10
) {
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const products = await prisma.$queryRaw<Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    total_quantity: bigint;
    total_revenue: string;
    total_profit: string;
  }>>(
    Prisma.sql`
      SELECT
        si.product_id,
        si.product_name,
        si.product_sku,
        SUM(si.quantity) AS total_quantity,
        SUM(si.total)::text AS total_revenue,
        SUM(si.total - (si.cost_price * si.quantity))::text AS total_profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'COMPLETED'
        AND s.created_at BETWEEN ${start} AND ${end}
      GROUP BY si.product_id, si.product_name, si.product_sku
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `
  );

  return products.map((p) => ({
    productId: p.product_id,
    name: p.product_name,
    sku: p.product_sku,
    totalQuantity: Number(p.total_quantity),
    totalRevenue: parseFloat(p.total_revenue ?? '0'),
    totalProfit: parseFloat(p.total_profit ?? '0'),
  }));
}

export async function getCategoriesAnalytics(period?: string, startDate?: string, endDate?: string) {
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const categories = await prisma.$queryRaw<Array<{
    category_name: string;
    total_quantity: bigint;
    total_revenue: string;
    total_profit: string;
    product_count: bigint;
  }>>(
    Prisma.sql`
      SELECT
        c.name AS category_name,
        SUM(si.quantity) AS total_quantity,
        SUM(si.total)::text AS total_revenue,
        SUM(si.total - (si.cost_price * si.quantity))::text AS total_profit,
        COUNT(DISTINCT si.product_id) AS product_count
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE s.status = 'COMPLETED'
        AND s.created_at BETWEEN ${start} AND ${end}
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `
  );

  return categories.map((c) => ({
    category: c.category_name,
    totalQuantity: Number(c.total_quantity),
    totalRevenue: parseFloat(c.total_revenue ?? '0'),
    totalProfit: parseFloat(c.total_profit ?? '0'),
    productCount: Number(c.product_count),
  }));
}

export async function getMargins(period?: string, startDate?: string, endDate?: string) {
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const margins = await prisma.$queryRaw<Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    total_revenue: string;
    total_cost: string;
    total_profit: string;
    margin_percent: string;
  }>>(
    Prisma.sql`
      SELECT
        si.product_id,
        si.product_name,
        si.product_sku,
        SUM(si.total)::text AS total_revenue,
        SUM(si.cost_price * si.quantity)::text AS total_cost,
        SUM(si.total - (si.cost_price * si.quantity))::text AS total_profit,
        CASE
          WHEN SUM(si.total) > 0
          THEN ROUND((SUM(si.total - (si.cost_price * si.quantity)) / SUM(si.total) * 100)::numeric, 2)::text
          ELSE '0'
        END AS margin_percent
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'COMPLETED'
        AND s.created_at BETWEEN ${start} AND ${end}
      GROUP BY si.product_id, si.product_name, si.product_sku
      ORDER BY margin_percent DESC
      LIMIT 50
    `
  );

  return margins.map((m) => ({
    productId: m.product_id,
    name: m.product_name,
    sku: m.product_sku,
    totalRevenue: parseFloat(m.total_revenue ?? '0'),
    totalCost: parseFloat(m.total_cost ?? '0'),
    totalProfit: parseFloat(m.total_profit ?? '0'),
    marginPercent: parseFloat(m.margin_percent ?? '0'),
  }));
}

export async function getTrends(period = 'month') {
  const now = new Date();
  let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

  if (period === 'month') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    currentEnd = new Date();
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else {
    currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 7);
    currentEnd = new Date();
    previousStart = new Date(now);
    previousStart.setDate(previousStart.getDate() - 14);
    previousEnd = new Date(now);
    previousEnd.setDate(previousEnd.getDate() - 7);
  }

  const getMetrics = async (start: Date, end: Date) => {
    const [result] = await prisma.$queryRaw<Array<{
      revenue: string;
      count: bigint;
      avg_ticket: string;
    }>>(
      Prisma.sql`
        SELECT
          COALESCE(SUM(total), 0)::text AS revenue,
          COUNT(*) AS count,
          COALESCE(AVG(total), 0)::text AS avg_ticket
        FROM sales
        WHERE status = 'COMPLETED' AND created_at BETWEEN ${start} AND ${end}
      `
    );
    return {
      revenue: parseFloat(result.revenue ?? '0'),
      count: Number(result.count),
      avgTicket: parseFloat(result.avg_ticket ?? '0'),
    };
  };

  const [current, previous] = await Promise.all([
    getMetrics(currentStart, currentEnd),
    getMetrics(previousStart, previousEnd),
  ]);

  const revenueGrowth = previous.revenue > 0
    ? ((current.revenue - previous.revenue) / previous.revenue) * 100
    : 0;

  return {
    period,
    current,
    previous,
    growth: { revenuePercent: Math.round(revenueGrowth * 100) / 100 },
  };
}

export async function getStockTurnover() {
  const turnover = await prisma.$queryRaw<Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    current_stock: number;
    sold_30d: bigint;
    sold_90d: bigint;
    days_of_stock: string;
  }>>(
    Prisma.sql`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        p.quantity AS current_stock,
        COALESCE(SUM(si.quantity) FILTER (
          WHERE s.created_at >= NOW() - INTERVAL '30 days' AND s.status = 'COMPLETED'
        ), 0) AS sold_30d,
        COALESCE(SUM(si.quantity) FILTER (
          WHERE s.created_at >= NOW() - INTERVAL '90 days' AND s.status = 'COMPLETED'
        ), 0) AS sold_90d,
        CASE
          WHEN COALESCE(SUM(si.quantity) FILTER (
            WHERE s.created_at >= NOW() - INTERVAL '30 days' AND s.status = 'COMPLETED'
          ), 0) > 0
          THEN ROUND((p.quantity::float / (COALESCE(SUM(si.quantity) FILTER (
            WHERE s.created_at >= NOW() - INTERVAL '30 days' AND s.status = 'COMPLETED'
          ), 0)::float / 30))::numeric, 1)::text
          ELSE '999'
        END AS days_of_stock
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON s.id = si.sale_id
      WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE'
      GROUP BY p.id, p.name, p.sku, p.quantity
      ORDER BY days_of_stock ASC
      LIMIT 50
    `
  );

  return turnover.map((t) => ({
    productId: t.product_id,
    name: t.product_name,
    sku: t.product_sku,
    currentStock: Number(t.current_stock),
    sold30d: Number(t.sold_30d),
    sold90d: Number(t.sold_90d),
    daysOfStock: parseFloat(t.days_of_stock ?? '999'),
  }));
}
