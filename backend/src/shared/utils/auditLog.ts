import { AuditAction } from '@prisma/client';
import { prisma } from '../../config/database';

type AuditLogInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma?: any; // Aceita tanto o cliente normal quanto o transacional do Prisma
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string;
  productId?: string;
  oldValue?: object;
  newValue?: object;
  metadata?: object;
};

export async function createAuditLog({
  prisma: txPrisma,
  action,
  entityType,
  entityId,
  userId,
  productId,
  oldValue,
  newValue,
  metadata,
}: AuditLogInput) {
  const client = txPrisma ?? prisma;
  await client.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      userId,
      productId,
      oldValue: oldValue ? oldValue : undefined,
      newValue: newValue ? newValue : undefined,
      metadata: metadata ? metadata : undefined,
    },
  });
}
