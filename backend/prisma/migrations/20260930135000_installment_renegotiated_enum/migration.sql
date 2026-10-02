-- Migration separada de propósito: no Postgres um valor novo de enum não pode
-- ser USADO na mesma transação em que é criado. Isolando o ADD VALUE aqui, a
-- migration seguinte já pode referenciar 'RENEGOTIATED' sem risco.
ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'RENEGOTIATED';
