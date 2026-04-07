# Lumine SaaS — Arquitetura do Sistema

## 1. Visão Geral

Sistema de gestão completo para a loja **Lumine** (artigos de dança), cobrindo estoque, inventário, vendas, pedidos, analytics e insights. Arquitetura monorepo com frontend e backend separados, containerizado com Docker e hospedado em VPS.

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│            Next.js 14 + Tailwind CSS                 │
│     (Dashboard, Analytics, Produtos, Uploads)        │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (JSON)
┌──────────────────────▼──────────────────────────────┐
│                    BACKEND                           │
│              Node.js + Express                       │
│   (Auth, CRUD, Upload Engine, Analytics Engine)      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  PostgreSQL 16                        │
│     (Produtos, Vendas, Estoque, Histórico)           │
└─────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológica

| Camada        | Tecnologia                          | Justificativa                                     |
|---------------|-------------------------------------|---------------------------------------------------|
| Frontend      | Next.js 14 + Tailwind CSS           | SSR, rotas automáticas, DX excelente              |
| UI Components | shadcn/ui + Radix Primitives        | Componentes elegantes, acessíveis, customizáveis  |
| Backend       | Node.js + Express + TypeScript      | Full-stack JS, grande ecossistema                 |
| ORM           | Prisma                              | Type-safe, migrations automáticas, ótima DX       |
| Banco de Dados| PostgreSQL 16                       | Robusto, gratuito, excelente para analytics       |
| Auth          | JWT + bcrypt (sessions via cookies) | Simples, seguro, sem dependência externa          |
| Upload Engine | multer + xlsx (SheetJS)             | Parse de planilhas .xlsx/.csv no servidor          |
| Charts        | Recharts                            | Leve, React-native, boa customização              |
| Container     | Docker + Docker Compose             | Ambiente consistente, fácil deploy                |
| CI/CD         | GitHub Actions                      | Gratuito, integrado ao repo                       |
| VPS           | Hetzner Cloud (CX22)               | €4.35/mês, 2vCPU, 4GB RAM, 40GB SSD              |
| Reverse Proxy | Caddy                               | HTTPS automático, config simples                  |
| Monitoring    | UptimeRobot (free) + pg_stat        | Monitoramento básico sem custo                    |

---

## 3. Módulos do Sistema

### 3.1 Dashboard (Home)
- Resumo de vendas do dia/semana/mês
- Produtos com estoque baixo (alertas)
- Últimas vendas registradas
- Gráfico de faturamento (últimos 30 dias)
- Quick actions: nova venda, novo produto, importar planilha

### 3.2 Produtos & Inventário
- CRUD completo de produtos
- Campos: nome, SKU (ID interno), categoria, subcategoria, marca, tamanho, cor, preço de custo, preço de venda, margem (calculada), quantidade em estoque, foto, status (ativo/inativo)
- **Categorias sugeridas para dança:** Collants, Sapatilhas, Meias, Saias, Tutus, Shorts, Tops, Acessórios, Figurinos, Bolsas
- Filtros e busca avançada
- Edição em massa (selecionar múltiplos → alterar preço/estoque)
- Histórico de alterações por produto (audit log)
- Alertas de estoque mínimo configurável

### 3.3 Upload de Planilha (Bulk Import/Update)
- **Flow:**
  1. Usuário faz upload de `.xlsx` ou `.csv`
  2. Sistema lê as colunas e mapeia automaticamente
  3. Para cada linha:
     - Se o `sku` (ID interno) **existe** → atualiza `quantidade` e `preço`
     - Se o `sku` **não existe** → cria novo produto
  4. Tela de preview mostrando o que será criado vs. atualizado
  5. Confirmação antes de aplicar
  6. Relatório pós-import com sucesso/erros
- Template de planilha disponível para download

### 3.4 Vendas
- Registro de nova venda (PDV simplificado)
- Buscar produto por nome/SKU/barcode
- Carrinho com múltiplos itens
- Métodos de pagamento: Dinheiro, PIX, Cartão Débito, Cartão Crédito, Misto
- Desconto por item ou por venda total
- Venda gera baixa automática no estoque
- Histórico de vendas com filtros por data, método, valor
- Possibilidade de estorno/cancelamento (devolve estoque)

### 3.5 Pedidos (Compras/Reposição)
- Criar pedido de reposição para fornecedores
- Status do pedido: Rascunho → Enviado → Recebido → Conferido
- Ao marcar "Conferido", estoque é atualizado automaticamente
- Histórico de pedidos por fornecedor

### 3.6 Analytics
- **Visão temporal:** diário, semanal, mensal, anual, custom range
- Faturamento bruto e líquido
- Ticket médio
- Produtos mais vendidos (ranking)
- Categorias mais vendidas
- Margem de lucro por produto/categoria
- Comparativo de períodos (este mês vs. mês anterior)
- Giro de estoque por produto
- Gráficos: linha (tendência), barra (comparativo), pizza (distribuição por categoria)

### 3.7 Insights (IA-ready, fase 2)
- **Fase 1 (regras simples):**
  - "Produto X está sem venda há 30 dias" → sugerir promoção
  - "Estoque de Y vai acabar em ~7 dias baseado no ritmo de vendas"
  - "Categoria Z teve crescimento de 25% este mês"
  - "Melhor dia de vendas: sábado" / "Melhor horário: 14h-17h"
- **Fase 2 (futuro):**
  - Integração com LLM para insights em linguagem natural
  - Previsão de demanda

### 3.8 Configurações
- Perfil da loja (nome, logo, endereço)
- Gerenciar usuários (multi-user: dona, funcionária)
- Categorias e subcategorias customizáveis
- Estoque mínimo padrão
- Configurar métodos de pagamento
- Backup manual do banco (download SQL)

---

## 4. Estrutura de Pastas (Monorepo)

```
lumine_saas/
├── docs/                          # Documentação do projeto
│   ├── ARCHITECTURE.md
│   ├── INFRASTRUCTURE.md
│   └── DATABASE.md
├── frontend/                      # Next.js App
│   ├── public/
│   │   └── assets/               # Logo, imagens estáticas
│   ├── src/
│   │   ├── app/                  # App Router (Next.js 14)
│   │   │   ├── (auth)/           # Grupo de rotas: login, registro
│   │   │   ├── dashboard/        # Página principal
│   │   │   ├── products/         # Produtos e inventário
│   │   │   ├── sales/            # Vendas e PDV
│   │   │   ├── orders/           # Pedidos de reposição
│   │   │   ├── analytics/        # Analytics e gráficos
│   │   │   ├── insights/         # Insights e sugestões
│   │   │   ├── upload/           # Upload de planilhas
│   │   │   ├── settings/         # Configurações
│   │   │   └── layout.tsx        # Layout principal (sidebar)
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui components
│   │   │   ├── layout/           # Sidebar, Header, etc.
│   │   │   ├── charts/           # Componentes de gráficos
│   │   │   ├── products/         # Componentes de produtos
│   │   │   ├── sales/            # Componentes de vendas
│   │   │   └── shared/           # Componentes reutilizáveis
│   │   ├── hooks/                # Custom hooks
│   │   ├── lib/                  # Utils, API client, formatters
│   │   ├── styles/               # Global CSS, Tailwind config
│   │   └── types/                # TypeScript types
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/               # DB, env, constants
│   │   ├── middleware/            # Auth, error handler, validation
│   │   ├── modules/
│   │   │   ├── auth/             # Login, registro, JWT
│   │   │   ├── products/         # CRUD produtos
│   │   │   ├── inventory/        # Gestão de estoque, audit log
│   │   │   ├── sales/            # Registro e histórico de vendas
│   │   │   ├── orders/           # Pedidos de reposição
│   │   │   ├── analytics/        # Queries analíticas
│   │   │   ├── insights/         # Engine de insights
│   │   │   ├── upload/           # Engine de importação de planilhas
│   │   │   ├── settings/         # Configurações da loja
│   │   │   └── integrations/     # 🔮 Futuro: Mercado Livre, Shopee, TikTok
│   │   ├── shared/
│   │   │   ├── utils/
│   │   │   ├── validators/
│   │   │   └── errors/
│   │   ├── app.ts                # Express app setup
│   │   └── server.ts             # Entry point
│   ├── prisma/
│   │   ├── schema.prisma         # Schema do banco
│   │   └── seed.ts               # Dados iniciais
│   ├── tests/
│   ├── tsconfig.json
│   └── package.json
├── database/
│   └── schema.sql                # Schema SQL de referência
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint + test em PRs
│       └── deploy.yml            # Deploy automático na VPS
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. Design System — Identidade Visual

### Paleta de Cores (baseada no logo Lumine)
```
--lumine-lavender:     #B8A9C9    (roxo lavanda — cor principal do logo)
--lumine-lavender-light: #D4C8E2  (hover states, backgrounds suaves)
--lumine-sage:         #5C6B63    (verde sage — background do logo)
--lumine-sage-dark:    #4A5750    (textos sobre fundo claro)
--lumine-cream:        #FAF8F5    (background principal — delicado)
--lumine-white:        #FFFFFF    (cards, modais)
--lumine-warm-gray:    #8B8680    (textos secundários)
--lumine-charcoal:     #3D3935    (textos principais)
--lumine-rose:         #D4A0A0    (acentos, badges de alerta suave)
--lumine-gold:         #C9B97A    (destaques, valores monetários)
--lumine-success:      #7FB88B    (confirmações, estoque ok)
--lumine-danger:       #D47B7B    (erros, estoque crítico)
```

### Tipografia
- **Headings:** `Cormorant Garamond` (elegante, feminino, combina com dança)
- **Body:** `Inter` (legível, moderno, limpo)
- **Accent/Logo:** `Playfair Display` (sofisticado, para destaques)

### Princípios de UI
- **Minimalismo:** muito espaço em branco, poucos elementos por tela
- **Suavidade:** bordas arredondadas, sombras suaves, transições smooth
- **Delicadeza:** ícones com stroke fino (Lucide), hover states com fade
- **Movimento:** micro-animações sutis (Framer Motion) que remetem à fluidez da dança
- **Sidebar recolhível** com ícones + texto, logo Lumine no topo

---

## 6. API Routes (Backend)

### Auth
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/refresh
```

### Produtos
```
GET    /api/products              # Listar (paginado, filtros, busca)
GET    /api/products/:id          # Detalhe
POST   /api/products              # Criar
PUT    /api/products/:id          # Atualizar
DELETE /api/products/:id          # Soft delete
PATCH  /api/products/bulk         # Atualização em massa (preço/estoque)
GET    /api/products/:id/history  # Histórico de alterações
GET    /api/products/low-stock    # Produtos com estoque baixo
GET    /api/products/template     # Download template planilha
```

### Upload/Import
```
POST   /api/upload/preview        # Upload + preview das mudanças
POST   /api/upload/confirm        # Confirmar import
GET    /api/upload/history        # Histórico de imports
```

### Vendas
```
GET    /api/sales                 # Listar vendas (paginado, filtros)
GET    /api/sales/:id             # Detalhe da venda
POST   /api/sales                 # Registrar nova venda
POST   /api/sales/:id/cancel      # Cancelar/estornar venda
GET    /api/sales/summary         # Resumo do dia/período
```

### Pedidos (Reposição)
```
GET    /api/orders                # Listar pedidos
GET    /api/orders/:id            # Detalhe
POST   /api/orders                # Criar pedido
PUT    /api/orders/:id            # Atualizar pedido
PATCH  /api/orders/:id/status     # Mudar status (→ estoque)
```

### Analytics
```
GET    /api/analytics/revenue     # Faturamento por período
GET    /api/analytics/top-products # Produtos mais vendidos
GET    /api/analytics/categories  # Vendas por categoria
GET    /api/analytics/margins     # Margens de lucro
GET    /api/analytics/trends      # Tendências/comparativos
GET    /api/analytics/stock-turn  # Giro de estoque
```

### Insights
```
GET    /api/insights              # Lista de insights gerados
GET    /api/insights/stock        # Alertas de estoque
GET    /api/insights/sales        # Insights de vendas
```

### Configurações
```
GET    /api/settings              # Configurações da loja
PUT    /api/settings              # Atualizar configurações
GET    /api/settings/categories   # Listar categorias
POST   /api/settings/categories   # Criar categoria
POST   /api/settings/backup       # Gerar backup SQL
```

---

## 7. Integrações Futuras (Marketplace Ready)

A pasta `backend/src/modules/integrations/` será estruturada assim:

```
integrations/
├── base/
│   ├── marketplace.interface.ts   # Interface comum para todos
│   └── sync.service.ts           # Serviço de sincronização base
├── mercadolivre/
├── shopee/
└── tiktokshop/
```

**Interface padrão de marketplace:**
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

Cada marketplace implementa essa interface, permitindo adicionar novos canais sem alterar o core do sistema.

---

## 8. Estimativa de Custos Mensais

| Serviço                | Custo             |
|------------------------|-------------------|
| Hetzner CX22 (VPS)    | €4.35/mês (~R$25) |
| Domínio .com.br        | ~R$40/ano (~R$3)  |
| UptimeRobot (free)     | R$0               |
| GitHub (free)          | R$0               |
| Backups (Hetzner)      | €0.60/mês (~R$3)  |
| **TOTAL**              | **~R$31/mês**     |

---

## 9. Decisões de Arquitetura — ADRs

### ADR-001: Monorepo com pastas separadas (não Turborepo)
- **Contexto:** Projeto pequeno, 1-2 devs
- **Decisão:** Monorepo simples com `frontend/` e `backend/`
- **Justificativa:** Complexidade do Turborepo não se justifica; Docker Compose unifica o dev environment

### ADR-002: Prisma como ORM
- **Decisão:** Usar Prisma ao invés de Knex/TypeORM
- **Justificativa:** Schema declarativo, migrations automáticas, type-safety excelente, Prisma Studio para debug visual

### ADR-003: JWT em httpOnly cookies
- **Decisão:** Auth via JWT armazenado em cookies httpOnly + Secure
- **Justificativa:** Mais seguro que localStorage, protege contra XSS

### ADR-004: Caddy como reverse proxy
- **Decisão:** Caddy ao invés de Nginx
- **Justificativa:** HTTPS automático via Let's Encrypt, config em 5 linhas, performance equivalente

### ADR-005: Soft delete para produtos e vendas
- **Decisão:** Nunca deletar fisicamente dados de negócio
- **Justificativa:** Integridade de analytics, auditoria, possibilidade de recovery
