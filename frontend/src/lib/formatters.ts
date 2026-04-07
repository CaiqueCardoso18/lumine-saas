export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT_CARD: 'Cartão de Débito',
  CREDIT_CARD: 'Cartão de Crédito',
  MIXED: 'Misto',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado',
  RECEIVED: 'Recebido',
  CHECKED: 'Conferido',
  CANCELLED: 'Cancelado',
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  DISCONTINUED: 'Descontinuado',
};
