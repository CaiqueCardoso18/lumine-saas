# LUMINE — Master Context

> Documento completo sobre tudo que a plataforma Lumine oferece, como foi construída, o que está pronto e o que falta.

---

## O que é a Lumine?

A Lumine é um SaaS de gestão completo feito sob medida para a loja **Lumine** — um ateliê/loja de artigos de dança. O sistema cobre todo o ciclo operacional do negócio: desde o cadastro de produtos e controle de estoque até o ponto de venda (PDV), pedidos de reposição com fornecedores, analytics de faturamento e insights inteligentes sobre o negócio.

O projeto nasceu da necessidade de não depender mais de sistemas genéricos como Wise/Webdança, que não atendem bem o nicho de dança e cobram mensalidades caras. A Lumine é uma solução definitiva, auto-hospedada, com custo operacional de ~R$31/mês.

---

## Tech Stack Completa

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 14.1 | Framework React com App Router, SSR, rotas automáticas |
| React | 18 | Biblioteca UI base |
| TypeScript | Strict | Tipagem em todo o frontend |
| Tailwind CSS | 3.3 | Estilização utility-first com paleta custom Lumine |
| shadcn/ui | - | Componentes UI elegantes baseados em Radix Primitives |
| Radix UI | 11+ primitives | Accordion, Dialog, Select, Tabs, Toast, etc. |
| TanStack React Query | 5.18 | Cache, data fetching, invalidação automática |
| Recharts | 2.12 | Gráficos (Linha, Barra, Pizza) |
| Framer Motion | 11.0 | Micro-animações e transições fluidas |
| React Hook Form | 7.50 | Formulários com validação |
| Zod | 3.22 | Validação de schemas no runtime |
| Lucide React | - | Ícones com stroke fino |

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 20 LTS | Runtime JavaScript |
| Express | 4.18 | Framework HTTP |
| TypeScript | Strict | Tipagem em todo o backend |
| Prisma | 5.10 | ORM type-safe com migrations automáticas |
| PostgreSQL | 16 | Banco relacional principal |
| bcryptjs | 2.4 | Hash de senhas |
| jsonwebtoken | 9.0 | JWT para autenticação |
| multer | 1.4 | Upload de arquivos |
| xlsx (SheetJS) | 0.18 | Parse de planilhas .xlsx/.csv |
| Zod | 3.22 | Validação de input no servidor |
| cors | - | Cross-Origin Resource Sharing |
| helmet | - | Headers de segurança HTTP |
| express-rate-limit | - | Proteção contra DDoS/brute force |

### Infraestrutura
| Tecnologia | Uso |
|---|---|
| Docker + Docker Compose | Containerização (dev + prod) |
| Caddy | Reverse proxy + HTTPS automático (Let's Encrypt) |
| GitHub Actions | CI (lint + test em PRs) + CD (deploy automático em push para main) |
| Hetzner CX22 | VPS: 2vCPU, 4GB RAM, 40GB SSD NVMe — €4.35/mês |
| UptimeRobot | Monitoramento de uptime (gratuito) |
| pg_dump + cron | Backup diário com retenção de 30 dias |

### Testes
| Tecnologia | Uso |
|---|---|
| Jest | Test runner backend |
| supertest | Testes HTTP de integração |

---

## Módulos do Sistema — O que cada um faz

### 1. Auth (Autenticação & Autorização)
**Status: ✅ Completo**

O que oferece:
- Login com email + senha (bcrypt hash)
- Registro de novos usuários
- JWT armazenado em httpOnly cookies (proteção contra XSS)
- Refresh token com rotação automática (30 dias)
- Endpoint `/me` para verificar sessão atual
- Duas roles: **OWNER** (acesso total) e **EMPLOYEE** (acesso restrito)
- Middleware de auth que protege todas as rotas da API
- Permissions JSON por usuário para controle granular
- Frontend com `useAuth` hook + middleware Next.js para proteção de rotas
- `PermissionGuard` component para esconder UI baseado em role

**Credenciais padrão (seed):** `admin@lumine.com.br` / `Lumine@2024!`

---

### 2. Produtos & Inventário
**Status: ✅ Completo**

O que oferece:
- CRUD completo de produtos (criar, ler, atualizar, deletar)
- **Soft delete** — produtos nunca são removidos fisicamente do banco, apenas marcados com `deletedAt`
- Campos completos: SKU (único), nome, descrição, categoria, subcategoria, marca, tamanho, cor, preço de custo, preço de venda, quantidade em estoque, estoque mínimo, imagem, status, barcode
- Busca por nome, SKU ou categoria
- Filtros por categoria, status (Ativo/Inativo/Descontinuado)
- Paginação server-side
- **Edição em massa** via `PATCH /api/products/bulk` — alterar preço e/ou estoque de múltiplos produtos de uma vez
- **Endpoint de estoque baixo** (`GET /api/products/low-stock`) — lista produtos abaixo do estoque mínimo
- **Audit Log** em toda alteração — quem mudou, o quê mudou, valor antigo e novo
- Frontend com tabela interativa, checkboxes para seleção, badges de status, e `ProductFormDialog` para criar/editar

**Categorias pré-cadastradas (seed):**
Collants, Sapatilhas, Meias e Acessórios para Pés, Saias e Tutus, Shorts e Leggings, Tops e Bodys, Aquecedores e Agasalhos, Acessórios, Figurinos, Bolsas e Mochilas, Calçados

---

### 3. Upload de Planilha (Importação em Massa)
**Status: ✅ Completo**

O que oferece:
- Upload de arquivos `.xlsx` ou `.csv` (máx. 10MB)
- **Flow de 3 etapas:**
  1. **Upload + Preview:** sistema lê a planilha e mostra exatamente o que vai acontecer
  2. **Para cada linha:** se o SKU já existe → atualiza quantidade e preço; se não existe → cria produto novo
  3. **Confirm:** aplica todas as mudanças de uma vez
- Contadores em tempo real: X novos, Y atualizados, Z erros
- Registro de cada importação no model `Import` (histórico completo)
- Template de planilha disponível para download
- Colunas obrigatórias: `sku`, `nome`, `quantidade`, `preco_venda`
- Colunas opcionais: `categoria`, `preco_custo`, `marca`, `tamanho`, `cor`
- Frontend com dropzone (arrastar e soltar), tabela de preview com badges "Criar"/"Atualizar", sidebar com histórico de imports

---

### 4. Vendas / PDV (Ponto de Venda)
**Status: ✅ Completo**

O que oferece:
- Registro de nova venda com múltiplos itens (carrinho)
- Busca de produto por nome, SKU ou barcode
- **5 métodos de pagamento:** Dinheiro, PIX, Cartão Débito, Cartão Crédito, Misto
- **Pagamento misto:** via model `SalePayment`, uma venda pode ter parte PIX + parte cartão, inclusive com parcelas
- Desconto por item individual ou desconto total na venda
- **Baixa automática no estoque** — a venda gera transação atômica que deduz o estoque de cada item vendido
- **Cancelamento/estorno** — ao cancelar uma venda, o estoque é automaticamente devolvido
- Número sequencial automático por venda (`saleNumber`)
- Histórico completo com filtros por data, método de pagamento, valor
- Endpoint de resumo (`GET /api/sales/summary`) — vendas do dia, faturamento, ticket médio
- Frontend com lista de vendas, KPI cards resumo, `NewSaleDialog` para registrar venda, `SaleDetailDialog` para ver detalhes, botão de cancelamento

---

### 5. Pedidos de Reposição (Compras)
**Status: ✅ Completo**

O que oferece:
- CRUD de fornecedores (nome, contato, telefone, email, notas)
- CRUD de pedidos de compra com itens
- **Status flow automático:** DRAFT → SENT → RECEIVED → CHECKED
- Ao marcar o pedido como **CHECKED**, o estoque é atualizado automaticamente com as quantidades recebidas
- Cada item do pedido registra: quantidade pedida vs. quantidade recebida
- Custo total calculado automaticamente
- Timestamps automáticos: `sentAt`, `receivedAt`, `checkedAt`
- Número sequencial por pedido (`orderNumber`)
- Frontend com filtro por status, `NewOrderDialog`, `OrderDetailDialog`, display de fornecedor

---

### 6. Analytics
**Status: ✅ Completo**

O que oferece:
- **Faturamento por período** — dia, semana, mês, ano, range custom
- **Top 10 produtos** por quantidade vendida e por faturamento
- **Vendas por categoria** — distribuição percentual
- **Margens de lucro** por produto e por categoria (custo vs. venda)
- **Tendências** — comparativo entre períodos (este mês vs. anterior)
- **Giro de estoque** — quais produtos vendem rápido vs. estagnados
- **Ticket médio** — valor médio por venda
- Queries otimizadas com índices no PostgreSQL
- Frontend com seletor de período, KPI cards (faturamento, vendas, ticket médio, margem), gráfico de linha (tendência de faturamento), gráfico de barras horizontal (top produtos), gráfico de pizza (categorias), tabela de margens

---

### 7. Insights (Inteligência de Negócio)
**Status: ✅ Completo (Fase 1 — regras simples)**

O que oferece:
- **Alertas de estoque:**
  - Produto com estoque abaixo do mínimo → alerta crítico
  - Previsão de esgotamento baseada no ritmo de vendas ("acaba em X dias")
- **Produtos parados:** item sem venda há X dias → sugestão de promoção
- **Crescimento por categoria:** "Collants cresceu 32% este mês"
- **Melhores dias/horários:** "Melhor dia de vendas: Sábado, 14h-17h"
- **Top performers:** produtos com melhor desempenho
- Cards de insight com severidade visual (danger/warning/success/info)
- Cada insight tem metadados (produto, categoria, período, valores)

**Fase 2 (futuro):** Integração com LLM para insights em linguagem natural e previsão de demanda.

---

### 8. Configurações
**Status: ⚙️ Parcial (backend completo, frontend stub)**

O que oferece:
- Perfil da loja (nome, logo, endereço, telefone, email)
- CRUD de categorias e subcategorias
- Gerenciar usuários (criar, editar roles/permissões)
- Configurações padrão: moeda, fuso horário, estoque mínimo default
- Backup manual do banco (download SQL dump)

**Settings pré-cadastrados (seed):** nome da loja, email, telefone, moeda (BRL), fuso horário (America/Sao_Paulo), estoque mínimo padrão (5), formato de SKU (LUM-{CAT}-{SEQ})

---

## Banco de Dados

### 13 Models (Prisma)

```
User              → Usuários do sistema (OWNER/EMPLOYEE)
Category          → Categorias de produto (com ícone e ordem)
Subcategory       → Subcategorias vinculadas a Category
Product           → Produtos completos com soft delete
Sale              → Vendas registradas
SaleItem          → Itens de cada venda (snapshot de preço)
SalePayment       → Pagamentos por venda (suporta misto + parcelas)
Supplier          → Fornecedores
Order             → Pedidos de reposição
OrderItem         → Itens de cada pedido (pedido vs. recebido)
Import            → Histórico de importações de planilha
AuditLog          → Rastro completo de alterações
Setting           → Configurações da loja (key-value)
```

### Regras de Negócio no Banco
- **Soft delete:** Produtos nunca são removidos fisicamente (`deletedAt`)
- **Campos monetários:** `Decimal(10, 2)` para precisão
- **IDs:** `cuid()` para todos os models
- **Audit log:** Registra CREATE, UPDATE, DELETE, STOCK_CHANGE, PRICE_CHANGE, BULK_UPDATE, IMPORT, SALE, SALE_CANCEL, ORDER_STATUS_CHANGE
- **Transações atômicas:** Vendas e status de pedidos usam `$transaction` do Prisma
- **Índices:** sku, name, status, categoryId, createdAt para performance

### Migrations Aplicadas
1. `20260407080520_init` — Schema completo inicial
2. `20260407115427_add_installments_and_permissions` — Parcelas + permissões por usuário

---

## Design System

### Identidade Visual
A identidade é inspirada no universo da **dança**: elegante, delicado, feminino, fluido. As cores foram extraídas diretamente do logo da Lumine (lavanda sobre sage green).

### Paleta de Cores
```
#B8A9C9  lumine-lavender        → Cor principal (botões, links, destaques)
#D4C8E2  lumine-lavender-light  → Hover states, backgrounds suaves
#EDE7F4  lumine-lavender-pale   → Borders, badges, separadores
#5C6B63  lumine-sage            → Textos na sidebar, labels
#4A5750  lumine-sage-dark       → Headings, textos fortes
#FAF8F5  lumine-cream           → Background geral da aplicação
#3D3935  lumine-charcoal        → Texto principal do corpo
#8B8680  lumine-warm-gray       → Texto secundário, placeholders
#D4A0A0  lumine-rose            → Acentos, badges decorativos
#C9B97A  lumine-gold            → Destaques, valores monetários
#7FB88B  lumine-success         → Confirmações, estoque OK
#D47B7B  lumine-danger          → Erros, estoque crítico, alertas
```

### Tipografia
- **Headings:** Cormorant Garamond (Google Fonts) — serifada, elegante
- **Body:** Inter (Google Fonts) — sans-serif, legível, moderna
- **Accent/Logo:** Playfair Display — sofisticada, para destaques

### Princípios de UI
- Visual minimalista com muito espaço em branco
- Bordas arredondadas (rounded-xl, rounded-2xl)
- Sombras suaves (shadow-sm)
- Micro-animações com Framer Motion que remetem à fluidez da dança
- Ícones Lucide React com stroke fino
- Sidebar recolhível com logo no topo
- Cards com hover sutil (translateY + shadow)
- Badges coloridos para status e categorias

---

## Arquitetura de Código

### Backend — Padrão Modular
```
src/modules/{feature}/
├── routes.ts       → Definição de rotas Express
├── controller.ts   → Parsing de request/response HTTP
├── service.ts      → Lógica de negócio (Prisma queries)
├── validator.ts    → Schemas Zod para validação de input
└── __tests__/      → Testes unitários/integração
```

**Padrões seguidos:**
- Response padronizada: `{ success: boolean, data?: T, error?: string, meta?: { page, total } }`
- Error handling centralizado via middleware (`AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`)
- Validação de input com Zod antes de chegar no controller
- Variáveis de ambiente via `.env` (nunca commitado)

### Frontend — Padrão Next.js App Router
```
src/app/{rota}/page.tsx          → Páginas
src/components/{feature}/         → Componentes por feature
src/components/ui/                → shadcn/ui components
src/components/layout/            → Sidebar, Header, PermissionGuard
src/hooks/use{Feature}.ts         → Custom hooks (data fetching)
src/lib/api.ts                    → Fetch wrapper centralizado
src/lib/formatters.ts             → Formatadores (moeda, data, labels)
src/types/index.ts                → Tipos TypeScript compartilhados
```

**Padrões seguidos:**
- `"use client"` apenas quando necessário
- React Query para cache e data fetching
- React Hook Form + Zod para formulários
- Componentes shadcn/ui como base do design system

---

## Infraestrutura & Deploy

### Ambiente de Desenvolvimento
```bash
# 1. Subir PostgreSQL
docker compose -f docker/docker-compose.dev.yml up -d

# 2. Backend (porta 4000)
cd backend && npm install && npx prisma migrate dev && npm run db:seed && npm run dev

# 3. Frontend (porta 3000)
cd frontend && npm install && npm run dev
```

### Ambiente de Produção
- **VPS Hetzner CX22:** Ubuntu 24.04, Docker + Docker Compose
- **Caddy:** HTTPS automático, config em 5 linhas
- **Docker Compose prod:** 4 containers (Postgres, Backend, Frontend, Caddy)
- **Deploy:** push para `main` → GitHub Actions faz SSH na VPS, pull, build, up

### CI/CD
- **CI (Pull Requests):** lint backend + lint frontend + test backend + build frontend
- **CD (Push para main):** deploy automático via SSH com `docker compose build && up -d`

### Backups
- Cron diário às 3h com `pg_dump`
- Retenção de 30 dias (últimos 30 backups mantidos)
- Backup manual disponível pela interface (Settings)

### Segurança
- SSH apenas via key (password desabilitado)
- Firewall (ufw): apenas portas 22, 80, 443
- PostgreSQL não exposto externamente (só Docker network)
- HTTPS automático via Caddy
- JWT em httpOnly cookies + rate limiting
- Helmet.js para headers de segurança
- Fail2ban contra brute force

### Custo Mensal
| Item | Valor |
|---|---|
| Hetzner CX22 | €4.35 (~R$25) |
| Domínio .com.br | ~R$3/mês |
| UptimeRobot | R$0 |
| GitHub | R$0 |
| Backups Hetzner | ~R$3 |
| **TOTAL** | **~R$31/mês** |

---

## Status de Implementação

### ✅ Completo e Funcional
- Sistema de autenticação (JWT + refresh + roles)
- CRUD de produtos com soft delete e audit log
- Upload de planilhas com preview + confirm
- PDV com carrinho, múltiplos pagamentos, baixa atômica de estoque
- Pedidos de reposição com workflow de status
- Analytics completo (faturamento, top produtos, categorias, margens, tendências)
- Insights inteligentes (alertas estoque, produtos parados, crescimento)
- Sidebar recolhível + Header com busca global
- Todas as páginas do frontend construídas e funcionais
- Design system Lumine aplicado (cores, tipografia, componentes)
- Docker dev + prod
- GitHub Actions CI/CD
- Schema Prisma com 13 models + 2 migrations + seed data
- Testes de auth (Jest + supertest)

### ⚙️ Parcialmente Implementado
- Página de Settings (backend pronto, frontend ainda é stub)

### ❌ Não Implementado (Roadmap Futuro)
- Testes E2E do frontend (Playwright/Cypress)
- Testes unitários de todos os módulos backend
- Integração com Mercado Livre (interface `MarketplaceIntegration` preparada)
- Integração com Shopee
- Integração com TikTok Shop
- Insights Fase 2 com IA/LLM (linguagem natural, previsão de demanda)
- Notificações por email (estoque baixo, vendas do dia)
- PWA / modo offline
- App mobile
- Multi-tenancy (atualmente single-store)

---

## Integrações Futuras (Marketplace Ready)

A arquitetura já prevê integração com marketplaces. A pasta `backend/src/modules/integrations/` está preparada com interface base:

```typescript
interface MarketplaceIntegration {
  authenticate(): Promise<void>;
  syncProducts(products: Product[]): Promise<SyncResult>;
  syncStock(updates: StockUpdate[]): Promise<SyncResult>;
  syncPrices(updates: PriceUpdate[]): Promise<SyncResult>;
  fetchOrders(): Promise<MarketplaceOrder[]>;
  getStatus(): Promise<ConnectionStatus>;
}
```

Cada marketplace (ML, Shopee, TikTok) implementará essa interface, permitindo adicionar novos canais sem alterar o core do sistema.

---

## Documentos de Referência

| Documento | Caminho | Conteúdo |
|---|---|---|
| CLAUDE.md | `/CLAUDE.md` | System prompt para Claude Code (contexto completo) |
| ARCHITECTURE.md | `/docs/ARCHITECTURE.md` | Stack, módulos, API routes, design system, ADRs |
| DATABASE.md | `/docs/DATABASE.md` | Schema Prisma completo, ERD, índices, seed data |
| INFRASTRUCTURE.md | `/docs/INFRASTRUCTURE.md` | Docker, CI/CD, VPS setup, backups, segurança |
| Wireframe | `/wireframe-dashboard.jsx` | Protótipo interativo do frontend (React + Recharts) |
