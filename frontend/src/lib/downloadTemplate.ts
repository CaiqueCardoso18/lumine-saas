import { toast } from '@/hooks/use-toast';

// Mesma convenção do api.ts: em produção o Next.js proxia /api/* para o backend.
// NEXT_PUBLIC_API_URL só é definida em dev local.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Baixa o template de planilha de produtos (.xlsx).
 * Usa fetch + blob porque window.open não envia o cookie httpOnly de auth.
 */
export async function downloadTemplate() {
  try {
    const res = await fetch(`${API_BASE}/api/products/template`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-produtos-lumine.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (err) {
    toast({
      variant: 'destructive',
      title: 'Erro ao baixar template',
      description: err instanceof Error ? err.message : 'Tente novamente',
    });
  }
}
