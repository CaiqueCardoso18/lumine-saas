-- Adiciona CREDIARIO ao enum de forma de pagamento.
--
-- Fica numa migration separada de propósito: o Postgres não deixa usar um valor
-- de enum recém-criado na mesma transação em que ele foi adicionado, e a
-- migration seguinte cria uma coluna que referencia esse tipo.
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIARIO';
