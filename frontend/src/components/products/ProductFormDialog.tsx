'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { Product, Category } from '@/types';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  sku: z.string().min(1, 'SKU obrigatório'),
  name: z.string().min(1, 'Nome obrigatório'),
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  costPrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0.01, 'Preço de venda obrigatório'),
  quantity: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  brand: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  barcode: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductFormDialog({ open, onOpenChange, product }: Props) {
  const qc = useQueryClient();
  const isEdit = !!product;

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/settings/categories'),
    enabled: open,
  });

  const categories = categoriesData?.data ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'ACTIVE',
      quantity: 0,
      minStock: 5,
      costPrice: 0,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        quantity: product.quantity,
        minStock: product.minStock,
        brand: product.brand ?? '',
        size: product.size ?? '',
        color: product.color ?? '',
        barcode: product.barcode ?? '',
        status: product.status,
      });
    } else {
      reset({ status: 'ACTIVE', quantity: 0, minStock: 5, costPrice: 0 });
    }
  }, [product, reset, open]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? api.put(`/api/products/${product!.id}`, data)
        : api.post('/api/products', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: isEdit ? 'Produto atualizado!' : 'Produto criado!', variant: 'default' });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao salvar produto',
        variant: 'destructive',
      });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-lumine-lavender-pale">
          <h2 className="font-heading text-xl text-lumine-sage-dark">
            {isEdit ? 'Editar Produto' : 'Novo Produto'}
          </h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input {...register('sku')} placeholder="SKU-001" disabled={isEdit} />
              {errors.sku && <p className="text-xs text-lumine-danger">{errors.sku.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select {...register('status')} className="flex h-10 w-full rounded-xl border border-lumine-lavender-pale bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumine-lavender">
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="DISCONTINUED">Descontinuado</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input {...register('name')} placeholder="Nome do produto" />
            {errors.name && <p className="text-xs text-lumine-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <select {...register('categoryId')} className="flex h-10 w-full rounded-xl border border-lumine-lavender-pale bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumine-lavender">
              <option value="">Selecionar categoria...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-lumine-danger">{errors.categoryId.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Preço de Custo (R$)</Label>
              <Input {...register('costPrice')} type="number" step="0.01" placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Preço de Venda (R$) *</Label>
              <Input {...register('salePrice')} type="number" step="0.01" placeholder="0,00" />
              {errors.salePrice && <p className="text-xs text-lumine-danger">{errors.salePrice.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input {...register('quantity')} type="number" placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Est. Mínimo</Label>
              <Input {...register('minStock')} type="number" placeholder="5" />
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input {...register('brand')} placeholder="Marca" />
            </div>
            <div className="space-y-1.5">
              <Label>Tamanho</Label>
              <Input {...register('size')} placeholder="P/M/G" />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Input {...register('color')} placeholder="Cor" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Código de Barras</Label>
            <Input {...register('barcode')} placeholder="EAN-13..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {isEdit ? 'Salvar Alterações' : 'Criar Produto'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
