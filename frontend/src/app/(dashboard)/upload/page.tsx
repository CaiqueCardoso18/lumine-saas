'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, Download, AlertCircle,
  Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import { toast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/layout/PermissionGuard';

interface PreviewItem {
  row: number;
  sku: string;
  name: string;
  quantity: number;
  salePrice: number;
  action: 'create' | 'update';
  currentData?: { name: string; quantity: number; salePrice: number } | null;
}

interface PreviewData {
  fileName: string;
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  errorCount: number;
  preview: PreviewItem[];
  errors: string[];
}

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<{
    createdCount: number; updatedCount: number; errorCount: number;
  } | null>(null);

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['import-history'],
    queryFn: () => api.get<Array<{
      id: string; fileName: string; totalRows: number;
      createdCount: number; updatedCount: number; errorCount: number;
      status: string; createdAt: string;
    }>>('/api/upload/history'),
  });

  const history = historyData?.data ?? [];

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setPreview(null);
    setResult(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await api.upload<PreviewData>('/api/upload/preview', formData);
      setPreview(data.data ?? null);
    } catch (err) {
      toast({
        title: 'Erro ao processar arquivo',
        description: err instanceof Error ? err.message : 'Arquivo inválido',
        variant: 'destructive',
      });
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleConfirm = async () => {
    if (!selectedFile) return;
    setIsConfirming(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const data = await api.upload<{
        createdCount: number; updatedCount: number; errorCount: number;
      }>('/api/upload/confirm', formData);

      setResult(data.data ?? null);
      setPreview(null);
      setSelectedFile(null);
      refetchHistory();

      toast({ title: 'Importação concluída!', variant: 'default' });
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <PermissionGuard permission="upload">
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upload Zone */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Planilha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer ${
                  isDragging
                    ? 'border-lumine-lavender bg-lumine-lavender-pale'
                    : 'border-lumine-lavender-pale hover:border-lumine-lavender hover:bg-lumine-lavender-pale/30'
                }`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={40} className="text-lumine-lavender animate-spin" />
                    <p className="text-sm text-lumine-warm-gray">Processando arquivo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-lumine-lavender-pale flex items-center justify-center">
                      <Upload size={24} strokeWidth={1.5} className="text-lumine-lavender" />
                    </div>
                    <div>
                      <p className="font-medium text-lumine-charcoal">
                        Arraste o arquivo aqui ou clique para selecionar
                      </p>
                      <p className="text-sm text-lumine-warm-gray mt-1">
                        Aceita .xlsx e .csv · Máximo 10MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/products/template`, '_blank')}
                >
                  <Download size={14} className="mr-2" />
                  Baixar Template
                </Button>
              </div>

              {/* Preview */}
              <AnimatePresence>
                {preview && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-lumine-success/10 border border-lumine-success/20 rounded-xl p-3 text-center">
                        <p className="text-2xl font-heading font-semibold text-lumine-success">{preview.toCreate}</p>
                        <p className="text-xs text-lumine-success mt-0.5">Criar</p>
                      </div>
                      <div className="bg-lumine-gold/10 border border-lumine-gold/20 rounded-xl p-3 text-center">
                        <p className="text-2xl font-heading font-semibold text-lumine-gold">{preview.toUpdate}</p>
                        <p className="text-xs text-lumine-gold mt-0.5">Atualizar</p>
                      </div>
                      <div className="bg-lumine-danger/10 border border-lumine-danger/20 rounded-xl p-3 text-center">
                        <p className="text-2xl font-heading font-semibold text-lumine-danger">{preview.errorCount}</p>
                        <p className="text-xs text-lumine-danger mt-0.5">Erros</p>
                      </div>
                    </div>

                    {/* Errors */}
                    {preview.errors.length > 0 && (
                      <div className="bg-lumine-danger/5 border border-lumine-danger/20 rounded-xl p-3 space-y-1">
                        {preview.errors.slice(0, 5).map((err, i) => (
                          <p key={i} className="text-xs text-lumine-danger flex items-center gap-1.5">
                            <AlertCircle size={12} /> {err}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Preview table */}
                    <div className="rounded-xl border border-lumine-lavender-pale overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-lumine-lavender-pale sticky top-0">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-lumine-sage-dark">SKU</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-lumine-sage-dark">Nome</th>
                            <th className="text-center px-4 py-2 text-xs font-medium text-lumine-sage-dark">Qty</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-lumine-sage-dark">Preço</th>
                            <th className="text-center px-4 py-2 text-xs font-medium text-lumine-sage-dark">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.preview.slice(0, 50).map((item) => (
                            <tr key={`${item.sku}-${item.row}`} className="border-t border-lumine-lavender-pale hover:bg-lumine-lavender-pale/20">
                              <td className="px-4 py-2 font-mono text-xs">{item.sku}</td>
                              <td className="px-4 py-2 truncate max-w-[150px]">{item.name}</td>
                              <td className="px-4 py-2 text-center">{item.quantity}</td>
                              <td className="px-4 py-2 text-right">R$ {item.salePrice.toFixed(2)}</td>
                              <td className="px-4 py-2 text-center">
                                <Badge variant={item.action === 'create' ? 'success' : 'warning'}>
                                  {item.action === 'create' ? 'Criar' : 'Atualizar'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setPreview(null); setSelectedFile(null); }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleConfirm}
                        disabled={isConfirming || preview.toCreate + preview.toUpdate === 0}
                      >
                        {isConfirming ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                        Confirmar Importação
                      </Button>
                    </div>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-lumine-success/10 border border-lumine-success/20 rounded-2xl p-6 text-center"
                  >
                    <CheckCircle size={40} className="text-lumine-success mx-auto mb-3" />
                    <p className="font-heading text-lg text-lumine-sage-dark">Importação concluída!</p>
                    <div className="flex justify-center gap-6 mt-3 text-sm">
                      <span className="text-lumine-success">{result.createdCount} criados</span>
                      <span className="text-lumine-gold">{result.updatedCount} atualizados</span>
                      {result.errorCount > 0 && (
                        <span className="text-lumine-danger">{result.errorCount} erros</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setResult(null)}
                    >
                      Nova importação
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Histórico */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Histórico</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => refetchHistory()} className="h-7 w-7">
              <RefreshCw size={14} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {history.length === 0 ? (
              <p className="text-sm text-lumine-warm-gray text-center py-6">Nenhuma importação</p>
            ) : (
              history.slice(0, 15).map((imp) => (
                <div key={imp.id} className="rounded-xl border border-lumine-lavender-pale p-3 hover:bg-lumine-lavender-pale/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate text-lumine-charcoal flex items-center gap-1.5">
                      <FileSpreadsheet size={14} className="text-lumine-lavender shrink-0" />
                      <span className="truncate">{imp.fileName}</span>
                    </p>
                    <Badge variant={imp.status === 'COMPLETED' ? 'success' : 'danger'}>
                      {imp.status === 'COMPLETED' ? <CheckCircle size={10} className="mr-1" /> : <XCircle size={10} className="mr-1" />}
                      {imp.status === 'COMPLETED' ? 'OK' : 'Erro'}
                    </Badge>
                  </div>
                  <p className="text-xs text-lumine-warm-gray">
                    {imp.createdCount} criados · {imp.updatedCount} atualizados
                    {imp.errorCount > 0 && ` · ${imp.errorCount} erros`}
                  </p>
                  <p className="text-xs text-lumine-warm-gray mt-0.5">{formatDateTime(imp.createdAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </PermissionGuard>
  );
}
