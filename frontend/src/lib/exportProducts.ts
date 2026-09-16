import { toast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Baixa a planilha de produtos respeitando os filtros da tela.
 *
 * Usa fetch + blob em vez de window.open porque o endpoint exige autenticação
 * e uma aba nova não carrega o cookie httpOnly em contexto cross-origin.
 */
export async function exportProducts(filterQuery: string) {
  try {
    const res = await fetch(`${API_BASE}/api/products/export?${filterQuery}`, {
      credentials: 'include',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const data = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos-lumine-${data}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: 'Planilha exportada!' });
  } catch (err) {
    toast({
      variant: 'destructive',
      title: 'Erro ao exportar',
      description: err instanceof Error ? err.message : 'Tente novamente',
    });
  }
}
