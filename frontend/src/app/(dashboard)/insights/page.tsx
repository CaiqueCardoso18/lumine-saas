'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle, TrendingDown, TrendingUp, Clock, Star, Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { Insight } from '@/types';

const ICON_MAP: Record<string, React.ElementType> = {
  stock_alert: AlertTriangle,
  slow_mover: TrendingDown,
  depletion_risk: Zap,
  top_performer: TrendingUp,
  best_day: Star,
  category_growth: TrendingUp,
};

const SEVERITY_BADGE: Record<string, 'danger' | 'warning' | 'success' | 'default'> = {
  danger: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'default',
};

const SEVERITY_BG: Record<string, string> = {
  danger: 'border-l-lumine-danger bg-lumine-danger/3',
  warning: 'border-l-lumine-gold bg-lumine-gold/3',
  success: 'border-l-lumine-success bg-lumine-success/3',
  info: 'border-l-lumine-lavender bg-lumine-lavender/5',
};

const SEVERITY_ICON: Record<string, string> = {
  danger: 'text-lumine-danger bg-lumine-danger/10',
  warning: 'text-lumine-gold bg-lumine-gold/10',
  success: 'text-lumine-success bg-lumine-success/10',
  info: 'text-lumine-lavender bg-lumine-lavender/10',
};

export default function InsightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: () => api.get<Insight[]>('/api/insights'),
    refetchInterval: 5 * 60 * 1000,
  });

  const insights = data?.data ?? [];
  const dangerInsights = insights.filter((i) => i.severity === 'danger');
  const warningInsights = insights.filter((i) => i.severity === 'warning');
  const otherInsights = insights.filter((i) => !['danger', 'warning'].includes(i.severity));

  return (
    <PermissionGuard permission="view_analytics">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center border-lumine-danger/20">
          <p className="text-2xl font-heading font-semibold text-lumine-danger">{dangerInsights.length}</p>
          <p className="text-xs text-lumine-warm-gray mt-1">Alertas críticos</p>
        </Card>
        <Card className="p-4 text-center border-lumine-gold/20">
          <p className="text-2xl font-heading font-semibold text-lumine-gold">{warningInsights.length}</p>
          <p className="text-xs text-lumine-warm-gray mt-1">Atenção necessária</p>
        </Card>
        <Card className="p-4 text-center border-lumine-success/20">
          <p className="text-2xl font-heading font-semibold text-lumine-success">{otherInsights.length}</p>
          <p className="text-xs text-lumine-warm-gray mt-1">Informativos</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-lumine-lavender-pale animate-pulse" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <Card className="p-12 text-center">
          <Star size={40} strokeWidth={1} className="mx-auto mb-3 text-lumine-lavender opacity-40" />
          <p className="text-lumine-warm-gray">Nenhum insight disponível no momento.</p>
          <p className="text-xs text-lumine-warm-gray mt-1">Continue registrando vendas para gerar análises.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const Icon = ICON_MAP[insight.type] ?? Zap;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={`bg-white rounded-2xl border border-l-4 ${SEVERITY_BG[insight.severity]} p-4 flex items-start gap-4`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${SEVERITY_ICON[insight.severity]}`}>
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-lumine-charcoal">{insight.title}</p>
                      <Badge variant={SEVERITY_BADGE[insight.severity]}>
                        {insight.severity === 'danger' ? 'Crítico' :
                          insight.severity === 'warning' ? 'Atenção' :
                          insight.severity === 'success' ? 'Positivo' : 'Info'}
                      </Badge>
                    </div>
                    <p className="text-sm text-lumine-warm-gray mt-1">{insight.description}</p>
                    {insight.action && (
                      <p className="text-xs text-lumine-lavender mt-1.5 font-medium">→ {insight.action}</p>
                    )}
                  </div>
                  <Clock size={12} className="text-lumine-warm-gray shrink-0 mt-1" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
    </PermissionGuard>
  );
}
