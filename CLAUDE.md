# CLAUDE.md — Lumine SaaS

## Sobre o Projeto
SaaS de gestão completo para a loja **Lumine** (artigos de dança). Cobre estoque, inventário, vendas (PDV), pedidos de reposição, analytics, insights e importação de planilhas em massa. Monorepo com frontend e backend separados.

## Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Recharts
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Banco:** PostgreSQL 16
- **Auth:** JWT em httpOnly cookies + bcrypt
- **Upload Engine:** multer + xlsx (SheetJS) para parse de planilhas
- **Container:** Docker + Docker Compose
- **CI/CD:** GitHub Actions → deploy via SSH em VPS Hetzner
- **Reverse Proxy:** Caddy (HTTPS automático)

## Estrutura do Monorepo
```
lumine_saas/
├── frontend/          # Next.js 14 App
│   └── src/
│       ├── app/       # App Router (rotas)
│       ├── components/# UI components (shadcn/ui + custom)
│       ├── hooks/     # Custom React hooks
│       ├── lib/       # Utils, API client, formatters
│       ├── styles/    # Global CSS
│       └── types/     # TypeScript types
├── backend/
│   └── src/
│       ├── config/    # DB, env, constants
│       ├── middleware/ # Auth, error handler, validation
│       ├── modules/   # Feature modules (auth, products, sales, etc.)
│       └── shared/    # Utils, validators, errors
│   └── prisma/        # Schema + migrations + seed
├── docker/            # Dockerfiles + docker-compose
├── docs/              # Documentação de arquitetura
└── .github/workflows/ # CI + Deploy
```

## Módulos do Sistema (prioridade de implementação)

### 1. Auth (`/api/auth/*`)
- Login/registro com JWT + bcrypt
- Roles: OWNER, EMPLOYEE
- Middleware de auth para proteger rotas
- Refresh token via httpOnly cookie

### 2. Produtos & Inventário (`/api/products/*`)
- CRUD completo com soft delete (`deletedAt`)
- Campos: sku (único), nome, descrição, descrição curta (máx 200), categoria, subcategoria, marca, tamanho, cor, público (ADULTO/INFANTIL, opcional), preço de custo, preço de venda, quantidade, estoque mínimo, imagem, status, barcode
- **Busca multi-termo:** campo `searchText` (concatenação normalizada sem acento de
  sku/nome/marca/tamanho/cor/barcode/descrição curta/categoria/público) mantido por
  `buildSearchText()` em TODO write (CRUD e import). Cada termo digitado precisa
  aparecer nele, então "sapatilha rosa EUA" e "brise 38" funcionam.
- Filtros: categoria, marca, tamanho, cor, público, status, estoque baixo e **preço**
- **Filtro de preço** tem três formas: faixas prontas com contagem (Até R$ 25,
  R$ 25 a R$ 50, R$ 50 a R$ 80, R$ 80 a R$ 150, R$ 150 a R$ 300, acima de R$ 300),
  intervalo livre, ou valor exato (`minPrice === maxPrice`, acha só quem custa
  exatamente aquilo — ex: 2,30). As bordas usam `gt` no mínimo e `lte` no máximo,
  então cada preço cai em exatamente uma faixa e R$ 25,00 fica em "Até R$ 25".
- `GET /api/products/facets` — contagem por dimensão para os dropdowns. Cada facet
  ignora a própria dimensão (cross-filter estilo Power BI): escolher Categoria filtra
  as marcas disponíveis, mas o dropdown de Categoria continua listando todas.
- Paginação server-side
- **Edição em massa** (PATCH `/api/products/bulk`) — preços, estoque, estoque mínimo,
  categoria, status, público, marca, tamanho, cor e descrição curta. Só os campos
  enviados são alterados. Não usa `updateMany`: o `searchText` é por produto, então
  roda update individual dentro de uma transação.
- Histórico de alterações via AuditLog
- Endpoint de estoque baixo (`/api/products/low-stock`)
- `GET /api/products/stock-value` — dinheiro parado em estoque: a custo (capital
  imobilizado), a preço de venda, lucro potencial e quebra por categoria. Custo e
  lucro só entram na resposta para quem tem `view_cost_price` — a ausência do
  campo É a autorização, o frontend não precisa checar de novo.
- `GET /api/products/export` — exporta .xlsx com os MESMOS filtros da listagem.
  As colunas base são as do template de import, então o arquivo pode ser editado
  e reimportado; as colunas de conferência (valor total, status) vêm depois e o
  import ignora o que não reconhece. Tem linha de TOTAL no fim.

### 3. Upload de Planilha (`/api/upload/*`)
- **Flow crítico:**
  1. POST `/api/upload/preview` — recebe .xlsx/.csv, parseia, retorna preview
  2. Usuário escolhe o **modo de estoque** para os produtos que já existem:
     `replace` (estoque vira o valor da planilha, padrão) ou `add` (soma ao atual).
     Produtos novos sempre entram com a quantidade da planilha nos dois modos.
  3. Para cada variante: se o SKU composto existe → atualiza qty/preço; se não → cria
  4. POST `/api/upload/confirm` — aplica as mudanças
  5. Registra tudo no model Import (contadores de criado/atualizado/erro)
- Template de planilha disponível para download
- Colunas obrigatórias: sku, nome, quantidade, preco_venda
- Colunas opcionais: categoria, preco_custo, marca, tamanho, cor, publico, descricao_curta, descricao
- **SKU composto por variante:** o SKU da planilha identifica o MODELO; tamanho e
  cor variam entre linhas. O import agrupa por (sku, tamanho, cor) e gera SKU
  composto (`400-38-ROSAEUA`). Linhas repetidas da mesma variante somam quantidade.
- **Público** (`publico`) aceita variações (Adulto/adt/Infantil/kids/criança) e é
  apenas informativo — NÃO entra no SKU composto.
- **Categoria** casa ignorando acento/caixa/plural; se não existir, é criada.

### 4. Vendas / PDV (`/api/sales/*`)
- Registro de venda com múltiplos itens (carrinho)
- Busca de produto multi-termo (mesma do módulo de produtos)
- Métodos: CASH, PIX, DEBIT_CARD, CREDIT_CARD, CREDIARIO, MIXED
- **Pagamento misto:** o array `payments` divide o total entre formas. O backend
  exige que a soma feche com o total (tolerância de 1 centavo) — antes a venda
  entrava com valores que não batiam com o caixa. Cada forma pode ter parcelas
  próprias no cartão de crédito.
- **Desconto** em valor ou percentual. Quando vem `discountPercent`, o valor em
  reais é derivado dele no servidor; desconto maior que o subtotal é rejeitado.
- **Cliente opcional** (`customerId`) — venda de balcão não exige
- Observação livre por venda (até 1000 caracteres)
- Venda gera baixa automática no estoque (transação atômica)
- Cancelamento/estorno devolve estoque; exige permissão `cancel_sale`
- **Preço por item** só pode divergir do cadastro se quem vende for OWNER

### 5. Pedidos de Reposição (`/api/orders/*`)
- CRUD de pedidos para fornecedores
- Status flow: DRAFT → SENT → RECEIVED → CHECKED
- Ao marcar CHECKED, estoque atualizado automaticamente
- Model Supplier para cadastro de fornecedores

### 6. Inventário (`/api/inventory/*`)
- **Sessões de Contagem Física:**
  - CRUD de sessões (IN_PROGRESS → COMPLETED | CANCELLED)
  - Contagem de produtos com diff automático (systemQuantity vs countedQuantity)
  - Batch upsert de contagens (@@unique sessionId+productId)
  - Aplicar sessão: transação atômica que ajusta estoque, cria StockMovement e AuditLog para cada divergência
- **Movimentações Manuais de Estoque:**
  - Tipos: ADJUSTMENT, LOSS, DAMAGE, RETURN, TRANSFER_IN, TRANSFER_OUT, INVENTORY_ADJUSTMENT, OTHER
  - Validação contra estoque negativo
  - Registro atômico: atualiza produto + cria AuditLog na mesma transação
  - Histórico por produto e por tipo
- Models: InventorySession, InventoryCount, StockMovement
- Frontend: página /inventory com tabs (Sessões de Contagem + Movimentações)

### 7. Analytics (`/api/analytics/*`)
- Faturamento por período (dia/semana/mês/ano/custom)
- Top produtos e categorias por vendas
- Margem de lucro por produto/categoria
- Ticket médio
- Comparativo de períodos
- Giro de estoque
- Queries otimizadas com índices no PostgreSQL

### 8. Insights (`/api/insights/*`)
- Fase 1 — regras simples (sem IA):
  - Produto sem venda há X dias → sugerir promoção
  - Previsão de esgotamento baseado em ritmo de vendas
  - Crescimento/queda por categoria
  - Melhor dia/horário de vendas
  - Combos frequentes (produtos vendidos juntos)

### 9. Clientes (`/api/customers/*`)
- CRUD com soft delete e busca por nome/telefone/CPF (searchText normalizado,
  inclui a versão só-dígitos para achar "11987654321" com o telefone formatado)
- Ficha com histórico de compras, parcelas e saldo devedor
- Não é possível remover cliente com parcela em aberto
- No PDV o cliente é opcional e pode ser cadastrado sem sair da venda

### 10. Crediário (`/api/crediario/*`)
- Venda no crediário gera parcelas (`Installment`) dentro da mesma transação
- **Divisão das parcelas:** `splitInstallments()` distribui os centavos que sobram
  nas primeiras parcelas, senão R$ 100 em 3x fecharia 99,99. `monthlyDueDates()`
  trata fim de mês — vencimento dia 31 cai no último dia de fevereiro em vez de
  escorregar para março.
- `GET /summary` — em aberto, em atraso, recebido no mês, nº de devedores
- `GET /debtors` — agrupado por cliente, ordenado por quem tem mais atraso
- `POST /:id/pay` — baixa da parcela (valor, forma e observação)
- `POST /:id/reopen` — desfaz a baixa; exige `cancel_sale`
- Crediário sempre exige cliente — sem ele não há de quem cobrar

### 11. Auditoria (`/api/audit/*`)
- Leitura do AuditLog, que já era gravado por todos os módulos mas não tinha consulta
- `GET /api/audit` — paginado, filtros por ação, tipo de entidade, usuário e período
- `GET /api/audit/facets` — contagem por dimensão para os dropdowns
- Frontend `/audit`: cada linha expande mostrando o diff antes/depois dos campos
  que realmente mudaram, mais o metadata bruto
- Exige permissão `view_audit`

### 12. Configurações (`/api/settings/*`)
- Perfil da loja (nome, logo, endereço)
- CRUD de categorias e subcategorias
- Estoque mínimo padrão
- Gerenciar usuários
- Backup manual (download SQL dump)

## Permissões

`PERMISSIONS` em `backend/src/middleware/requirePermission.ts` é a fonte da verdade.
`frontend/src/hooks/usePermission.ts` e a lista em Configurações espelham ela — as
três precisam andar juntas.

| Permissão | O que libera |
|---|---|
| `view_orders` | Aba Pedidos de Reposição |
| `view_cost_price` | Preço de custo e margem |
| `manage_products` | Criar/editar/excluir produto, edição em massa |
| `view_analytics` | Analytics e Insights |
| `upload` | Importar planilha |
| `manage_inventory` | Contagens e movimentações de estoque |
| `cancel_sale` | Estornar venda (mexe em estoque e caixa) |
| `view_audit` | Tela de Auditoria |

**Regras:**
- OWNER ignora as permissões — acesso total
- `requirePermission()` valida no SERVIDOR. Antes as permissões só existiam no
  frontend, então um EMPLOYEE conseguia chamar a API direto e fazer qualquer coisa.
- Permissões ficam em cache por 30s; `invalidatePermissionCache(userId)` é chamado
  ao salvar as permissões de um usuário
- **Alterar preço na venda NÃO é permissão** — é restrito ao role OWNER.
  `createSale` compara o `unitPrice` recebido com o preço cadastrado e devolve 403
  se quem enviou não for OWNER. Overrides ficam no metadata do AuditLog.

## Design System

### Paleta de Cores (Tailwind custom)
```
lumine-lavender:       #B8A9C9  (cor principal)
lumine-lavender-light: #D4C8E2  (hover, backgrounds)
lumine-lavender-pale:  #EDE7F4  (borders, badges)
lumine-sage:           #5C6B63  (textos, sidebar)
lumine-sage-dark:      #4A5750  (headings)
lumine-cream:          #FAF8F5  (background geral)
lumine-charcoal:       #3D3935  (texto principal)
lumine-warm-gray:      #8B8680  (texto secundário)
lumine-rose:           #D4A0A0  (acentos)
lumine-gold:           #C9B97A  (destaques, valores)
lumine-success:        #7FB88B  (confirmações)
lumine-danger:         #D47B7B  (erros, alertas)
```

### Tipografia
- Headings: `Cormorant Garamond` (Google Fonts)
- Body: `Inter` (Google Fonts)
- Logo accent: `Playfair Display`

### Princípios de UI
- Visual minimalista, delicado, feminino — combina com DANÇA
- Muito espaço em branco
- Bordas arredondadas (rounded-xl, rounded-2xl)
- Sombras suaves (shadow-sm)
- Micro-animações com Framer Motion (transições fluidas como dança)
- Ícones: Lucide React (stroke fino)
- Sidebar recolhível com logo Lumine no topo

## Banco de Dados

O schema Prisma completo está em `docs/DATABASE.md`. Models principais:
- User, Category, Subcategory, Product
- Sale, SaleItem, SalePayment
- Order, OrderItem, Supplier
- Import, AuditLog, Setting

**Regras importantes:**
- NUNCA deletar fisicamente dados de negócio (soft delete via `deletedAt`)
- Campos monetários: `Decimal(10, 2)`
- Todos os IDs são `cuid()`
- Audit log em toda alteração de produto (preço, estoque, criação, deleção)
- Transações atômicas em vendas (baixa de estoque + registro de venda)

## Convenções de Código

### Backend
- Estrutura modular: `src/modules/{feature}/` com `controller.ts`, `service.ts`, `routes.ts`, `validator.ts`
- Validação de input com Zod
- Error handling centralizado via middleware
- Responses padronizadas: `{ success: boolean, data?: T, error?: string, meta?: { page, total } }`
- Variáveis de ambiente via `.env` (nunca commitar)

### Frontend
- App Router (Next.js 14) — arquivos em `src/app/{rota}/page.tsx`
- Client components marcados com `"use client"` apenas quando necessário
- API calls via fetch wrapper em `src/lib/api.ts`
- Componentes shadcn/ui em `src/components/ui/`
- Feature components em `src/components/{feature}/`
- React Query (TanStack Query) para cache e data fetching
- Formulários com React Hook Form + Zod

### Geral
- TypeScript strict em tudo
- ESLint + Prettier
- Commits em português (convenção do time)
- Branch strategy: `main` (prod) ← `develop` ← `feature/*`

## Infraestrutura

- **VPS:** Hetzner CX22 (2vCPU, 4GB RAM, €4.35/mês)
- **Docker Compose** para orquestrar frontend + backend + postgres
- **Caddy** como reverse proxy com HTTPS automático
- **GitHub Actions:** CI em PRs (lint + test + build), deploy automático em push para main
- **Backups:** cron diário com pg_dump, retenção de 30 dias

Detalhes completos em `docs/INFRASTRUCTURE.md`.

## Integrações Futuras (NÃO implementar agora)

Pasta `backend/src/modules/integrations/` preparada com interface base:
- Mercado Livre
- Shopee
- TikTok Shop

Cada marketplace implementa `MarketplaceIntegration` interface (authenticate, syncProducts, syncStock, syncPrices, fetchOrders).

## Referências
- `docs/ARCHITECTURE.md` — Arquitetura completa, API routes, ADRs
- `docs/DATABASE.md` — Schema Prisma completo
- `docs/INFRASTRUCTURE.md` — Docker, CI/CD, VPS setup, backups
- `wireframe-dashboard.jsx` — Wireframe interativo do frontend (React)

## Seed Data
Ao rodar `prisma db seed`, popular com categorias de dança:
Collants, Sapatilhas, Meias e Acessórios para Pés, Saias e Tutus, Shorts e Leggings, Tops e Bodys, Aquecedores e Agasalhos, Acessórios, Figurinos, Bolsas e Mochilas, Calçados
