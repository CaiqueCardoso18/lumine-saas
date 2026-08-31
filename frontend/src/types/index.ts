// ─── Auth ─────────────────────────────────────────────────────
export type UserRole = 'OWNER' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  permissions: string[];
  createdAt: string;
}

// ─── Products ─────────────────────────────────────────────────
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
export type Audience = 'ADULTO' | 'INFANTIL';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  sortOrder: number;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  categoryId: string;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  subcategoryId?: string;
  subcategory?: Pick<Subcategory, 'id' | 'name' | 'slug'> | null;
  brand?: string;
  size?: string;
  color?: string;
  audience?: Audience | null;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minStock: number;
  imageUrl?: string;
  status: ProductStatus;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ─── Sales ────────────────────────────────────────────────────
export type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'MIXED';
export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  total: number;
}

export interface SalePayment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  installments: number;
}

export interface Sale {
  id: string;
  saleNumber: number;
  userId: string;
  user: Pick<User, 'id' | 'name'>;
  subtotal: number;
  discountAmount: number;
  discountPercent?: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  notes?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  items: SaleItem[];
  payments: SalePayment[];
}

// ─── Orders ───────────────────────────────────────────────────
export type OrderStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CHECKED' | 'CANCELLED';

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Pick<Product, 'id' | 'name' | 'sku'>;
  quantityOrdered: number;
  quantityReceived?: number;
  unitCost: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  supplierId?: string;
  supplier?: Pick<Supplier, 'id' | 'name'> | null;
  status: OrderStatus;
  totalCost: number;
  notes?: string;
  sentAt?: string;
  receivedAt?: string;
  checkedAt?: string;
  createdAt: string;
  items: OrderItem[];
}

// ─── Analytics ────────────────────────────────────────────────
export interface RevenuePoint {
  date: string;
  revenue: number;
  sales: number;
  avgTicket: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  totalProfit: number;
}

// ─── Insights ─────────────────────────────────────────────────
export type InsightSeverity = 'info' | 'warning' | 'danger' | 'success';
export type InsightType = 'stock_alert' | 'slow_mover' | 'depletion_risk' | 'top_performer' | 'best_day' | 'category_growth';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

// ─── Inventory ───────────────────────────────────────────────
export type InventorySessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MovementType = 'ADJUSTMENT' | 'LOSS' | 'DAMAGE' | 'RETURN' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'INVENTORY_ADJUSTMENT' | 'OTHER';

export interface InventoryCount {
  id: string;
  sessionId: string;
  productId: string;
  product: Pick<Product, 'id' | 'sku' | 'name' | 'quantity'> & { category: { name: string } };
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  notes?: string;
  createdAt: string;
}

export interface InventorySession {
  id: string;
  name: string;
  userId: string;
  user: Pick<User, 'id' | 'name'>;
  status: InventorySessionStatus;
  notes?: string;
  totalProducts: number;
  matchedCount: number;
  divergedCount: number;
  appliedAt?: string;
  createdAt: string;
  counts?: InventoryCount[];
  _count?: { counts: number };
}

export interface StockMovement {
  id: string;
  productId: string;
  product: Pick<Product, 'id' | 'sku' | 'name'>;
  userId: string;
  user: Pick<User, 'id' | 'name'>;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
