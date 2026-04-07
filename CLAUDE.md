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
- Campos: sku (único), nome, categoria, subcategoria, marca, tamanho, cor, preço de custo, preço de venda, quantidade, estoque mínimo, imagem, status, barcode
- Filtros: categoria, status, busca por nome/SKU
- Paginação server-side
- Edição em massa (PATCH `/api/products/bulk`) — alterar preço/estoque de múltiplos produtos
- Histórico de alterações via AuditLog
- Endpoint de estoque baixo (`/api/products/low-stock`)

### 3. Upload de Planilha (`/api/upload/*`)
- **Flow crítico:**
  1. POST `/api/upload/preview` — recebe .xlsx/.csv, parseia, retorna preview
  2. Para cada linha: se SKU existe → atualiza qty/preço; se não existe → cria produto
  3. POST `/api/upload/confirm` — aplica as mudanças
  4. Registra tudo no model Import (contadores de criado/atualizado/erro)
- Template de planilha disponível para download
- Colunas obrigatórias: sku, nome, quantidade, preco_venda
- Colunas opcionais: categoria, preco_custo, marca, tamanho, cor

### 4. Vendas / PDV (`/api/sales/*`)
- Registro de venda com múltiplos itens (carrinho)
- Busca de produto por nome/SKU/barcode
- Métodos: CASH, PIX, DEBIT_CARD, CREDIT_CARD, MIXED
- Pagamento misto via SalePayment (ex: parte PIX, parte cartão)
- Desconto por item ou por venda total
- Venda gera baixa automática no estoque (transação atômica)
- Cancelamento/estorno devolve estoque
- Histórico com filtros por data, método, valor

### 5. Pedidos de Reposição (`/api/orders/*`)
- CRUD de pedidos para fornecedores
- Status flow: DRAFT → SENT → RECEIVED → CHECKED
- Ao marcar CHECKED, estoque atualizado automaticamente
- Model Supplier para cadastro de fornecedores

### 6. Analytics (`/api/analytics/*`)
- Faturamento por período (dia/semana/mês/ano/custom)
- Top produtos e categorias por vendas
- Margem de lucro por produto/categoria
- Ticket médio
- Comparativo de períodos
- Giro de estoque
- Queries otimizadas com índices no PostgreSQL

### 7. Insights (`/api/insights/*`)
- Fase 1 — regras simples (sem IA):
  - Produto sem venda há X dias → sugerir promoção
  - Previsão de esgotamento baseado em ritmo de vendas
  - Crescimento/queda por categoria
  - Melhor dia/horário de vendas
  - Combos frequentes (produtos vendidos juntos)

### 8. Configurações (`/api/settings/*`)
- Perfil da loja (nome, logo, endereço)
- CRUD de categorias e subcategorias
- Estoque mínimo padrão
- Gerenciar usuários
- Backup manual (download SQL dump)

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
