# Lumine SaaS — Roadmap de Implementação

> Documento de passo a passo para construção do projeto do zero.
> Estado atual: pastas criadas, docs prontos, código = zero.

---

## FASE 0 — Setup do Ambiente (Pré-requisitos)

### 0.1 Ferramentas necessárias na máquina
- [ ] Node.js 20 LTS instalado (`node -v`)
- [ ] Docker Desktop instalado e rodando
- [ ] Git configurado (`git config --global user.name / user.email`)
- [ ] VS Code com extensões: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense

### 0.2 Inicializar Git no monorepo
- [ ] `git init` na raiz do `lumine_saas/`
- [ ] Criar `.gitignore` na raiz (node_modules, .env, dist, .next)
- [ ] Criar repositório no GitHub
- [ ] Primeiro commit com os docs existentes

---

## FASE 1 — Backend: Setup e Infraestrutura Base

### 1.1 Inicializar projeto Node.js
- [ ] `cd backend && npm init -y`
- [ ] Instalar dependências de produção:
  ```
  express cors helmet express-rate-limit cookie-parser
  @prisma/client bcryptjs jsonwebtoken multer xlsx zod
  ```
- [ ] Instalar dependências de dev:
  ```
  typescript ts-node tsx nodemon @types/node @types/express
  @types/bcryptjs @types/jsonwebtoken @types/multer @types/cookie-parser
  prisma eslint prettier
  ```
- [ ] Criar `tsconfig.json` com strict mode
- [ ] Criar `package.json` scripts: `dev`, `build`, `start`, `lint`

### 1.2 Configurar Prisma + Banco
- [ ] `npx prisma init` → gera `prisma/schema.prisma` e `.env`
- [ ] Copiar o schema completo de `docs/DATABASE.md` para `prisma/schema.prisma`
- [ ] Criar `docker/docker-compose.dev.yml` com PostgreSQL 16
- [ ] Subir Postgres: `docker compose -f docker/docker-compose.dev.yml up -d`
- [ ] Configurar `DATABASE_URL` no `.env`
- [ ] Rodar `npx prisma migrate dev --name init`
- [ ] Criar `prisma/seed.ts` com as 11 categorias de dança
- [ ] Rodar `npx prisma db seed`

### 1.3 Estrutura de pastas do backend
- [ ] Criar toda a estrutura de módulos:
  ```
  src/
  ├── app.ts              ← Express setup, middlewares globais
  ├── server.ts           ← Entry point (listen)
  ├── config/
  │   ├── database.ts     ← Prisma client singleton
  │   └── env.ts          ← Validação de variáveis de ambiente
  ├── middleware/
  │   ├── auth.ts         ← Middleware JWT
  │   ├── errorHandler.ts ← Tratamento centralizado de erros
  │   └── validate.ts     ← Middleware de validação Zod
  ├── modules/
  │   ├── auth/
  │   ├── products/
  │   ├── upload/
  │   ├── sales/
  │   ├── orders/
  │   ├── analytics/
  │   ├── insights/
  │   └── settings/
  └── shared/
      ├── errors/         ← AppError, NotFoundError, etc.
      └── utils/          ← Response helpers, paginação
  ```

### 1.4 App.ts e Server.ts base
- [ ] Criar `app.ts` com: cors, helmet, cookie-parser, rate-limit, JSON body parser, rota de health check (`GET /api/health`)
- [ ] Criar `server.ts` com listen na porta configurável via ENV
- [ ] Testar: `npm run dev` → `GET /api/health` retorna `{ success: true }`

---

## FASE 2 — Backend: Módulo Auth

### 2.1 Implementar Auth
- [ ] `src/modules/auth/validator.ts` — schemas Zod para login e register
- [ ] `src/modules/auth/service.ts` — lógica de bcrypt + JWT
- [ ] `src/modules/auth/controller.ts` — handlers HTTP
- [ ] `src/modules/auth/routes.ts` — rotas Express

### 2.2 Rotas Auth
- [ ] `POST /api/auth/register` — criar usuário (só OWNER pode criar outros)
- [ ] `POST /api/auth/login` — retorna JWT em httpOnly cookie
- [ ] `POST /api/auth/logout` — limpa o cookie
- [ ] `GET /api/auth/me` — retorna dados do usuário logado
- [ ] `POST /api/auth/refresh` — renovar token

### 2.3 Middleware de Auth
- [ ] Criar middleware que valida o JWT do cookie em toda rota protegida
- [ ] Criar middleware de role check (`requireRole('OWNER')`)

---

## FASE 3 — Backend: Módulo Produtos & Inventário

### 3.1 CRUD de Produtos
- [ ] `validator.ts` — schemas Zod para create/update produto
- [ ] `service.ts` — lógica com soft delete, paginação, filtros
- [ ] `controller.ts` — handlers
- [ ] `routes.ts` — todas as rotas protegidas com auth middleware

### 3.2 Endpoints
- [ ] `GET /api/products` — listar com paginação + filtros (categoria, status, busca)
- [ ] `GET /api/products/low-stock` — produtos abaixo do estoque mínimo
- [ ] `GET /api/products/:id` — detalhe
- [ ] `GET /api/products/:id/history` — audit log do produto
- [ ] `POST /api/products` — criar
- [ ] `PUT /api/products/:id` — atualizar
- [ ] `DELETE /api/products/:id` — soft delete
- [ ] `PATCH /api/products/bulk` — atualização em massa

### 3.3 Audit Log
- [ ] Criar helper que registra no `AuditLog` a cada CREATE/UPDATE/DELETE/STOCK_CHANGE

---

## FASE 4 — Backend: Módulo Upload de Planilha

### 4.1 Engine de Import
- [ ] Configurar multer para aceitar `.xlsx` e `.csv`
- [ ] `service.ts` — parse com SheetJS, validação de colunas obrigatórias, lógica de upsert por SKU
- [ ] `controller.ts` + `routes.ts`

### 4.2 Endpoints
- [ ] `POST /api/upload/preview` — parseia arquivo, retorna preview (criar/atualizar/erros)
- [ ] `POST /api/upload/confirm` — aplica as mudanças, registra no model `Import`
- [ ] `GET /api/upload/history` — histórico de imports
- [ ] `GET /api/products/template` — download do template `.xlsx`

---

## FASE 5 — Backend: Módulo Vendas (PDV)

### 5.1 Implementar Vendas
- [ ] `validator.ts` — schema de nova venda (carrinho + pagamentos)
- [ ] `service.ts` — transação atômica: registra venda + dá baixa no estoque
- [ ] `controller.ts` + `routes.ts`

### 5.2 Endpoints
- [ ] `GET /api/sales` — listar com filtros por data/método/valor
- [ ] `GET /api/sales/summary` — resumo do dia/período
- [ ] `GET /api/sales/:id` — detalhe
- [ ] `POST /api/sales` — registrar venda (transação atômica)
- [ ] `POST /api/sales/:id/cancel` — cancelar/estornar (devolve estoque)

---

## FASE 6 — Backend: Módulo Pedidos de Reposição

### 6.1 Implementar Pedidos
- [ ] CRUD de Fornecedores (`Supplier`)
- [ ] CRUD de Pedidos (`Order` + `OrderItem`)
- [ ] Lógica de transição de status: DRAFT → SENT → RECEIVED → CHECKED
- [ ] Ao marcar CHECKED: atualizar estoque automaticamente + AuditLog

### 6.2 Endpoints
- [ ] `GET/POST /api/orders` — listar e criar
- [ ] `GET/PUT /api/orders/:id` — detalhe e atualizar
- [ ] `PATCH /api/orders/:id/status` — transição de status
- [ ] `GET/POST /api/settings/suppliers` — CRUD de fornecedores

---

## FASE 7 — Backend: Analytics

### 7.1 Queries Analíticas
- [ ] `service.ts` com queries SQL otimizadas via Prisma
- [ ] Todos os endpoints com suporte a `startDate`/`endDate` via query params

### 7.2 Endpoints
- [ ] `GET /api/analytics/revenue` — faturamento por período
- [ ] `GET /api/analytics/top-products` — ranking de produtos mais vendidos
- [ ] `GET /api/analytics/categories` — vendas por categoria
- [ ] `GET /api/analytics/margins` — margens de lucro
- [ ] `GET /api/analytics/trends` — comparativo de períodos
- [ ] `GET /api/analytics/stock-turn` — giro de estoque

---

## FASE 8 — Backend: Insights + Configurações

### 8.1 Insights (regras simples)
- [ ] Produtos sem venda há X dias
- [ ] Previsão de esgotamento por ritmo de vendas
- [ ] Crescimento/queda por categoria
- [ ] Melhor dia e horário de vendas

### 8.2 Configurações
- [ ] `GET/PUT /api/settings` — perfil da loja
- [ ] `GET/POST/DELETE /api/settings/categories` — CRUD de categorias
- [ ] `POST /api/settings/backup` — gera e retorna dump SQL

---

## FASE 9 — Frontend: Setup e Design System

### 9.1 Inicializar Next.js
- [ ] `cd frontend && npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"`
- [ ] Instalar dependências adicionais:
  ```
  @tanstack/react-query axios react-hook-form @hookform/resolvers
  zod framer-motion lucide-react recharts
  next-themes
  ```
- [ ] Instalar e configurar shadcn/ui: `npx shadcn@latest init`
- [ ] Adicionar componentes shadcn necessários: button, input, dialog, table, badge, card, select, dropdown-menu, toast, skeleton, avatar

### 9.2 Configurar Design System
- [ ] Adicionar fontes Google (Cormorant Garamond, Inter, Playfair Display) no `layout.tsx`
- [ ] Configurar `tailwind.config.ts` com as cores customizadas `lumine-*`
- [ ] Criar `src/styles/globals.css` com variáveis CSS e estilos base

### 9.3 Estrutura de pastas frontend
- [ ] Criar toda a estrutura de `src/`:
  ```
  app/
  ├── (auth)/login/page.tsx
  ├── (dashboard)/
  │   ├── layout.tsx          ← Layout com sidebar
  │   ├── page.tsx            ← Dashboard home
  │   ├── products/page.tsx
  │   ├── sales/page.tsx
  │   ├── orders/page.tsx
  │   ├── analytics/page.tsx
  │   ├── insights/page.tsx
  │   ├── upload/page.tsx
  │   └── settings/page.tsx
  components/
  ├── layout/Sidebar.tsx
  ├── layout/Header.tsx
  lib/
  ├── api.ts                  ← fetch wrapper base
  ├── formatters.ts           ← moeda, data, etc.
  └── queryClient.ts          ← TanStack Query setup
  types/
  └── index.ts                ← tipos globais
  ```

### 9.4 API Client e Auth
- [ ] Criar `src/lib/api.ts` — fetch wrapper com base URL, cookies, error handling
- [ ] Criar `src/hooks/useAuth.ts` — hook de autenticação com React Query
- [ ] Criar middleware Next.js para redirecionar não-autenticados

---

## FASE 10 — Frontend: Componentes de Layout

### 10.1 Sidebar
- [ ] Sidebar recolhível com logo Lumine no topo
- [ ] Itens: Dashboard, Produtos, Vendas, Pedidos, Analytics, Insights, Upload, Configurações
- [ ] Indicador de rota ativa
- [ ] Micro-animação com Framer Motion ao recolher/expandir

### 10.2 Header
- [ ] Nome da página atual
- [ ] Avatar do usuário logado + menu dropdown (perfil, logout)
- [ ] Notificações de estoque baixo (badge)

### 10.3 Layout principal
- [ ] Integrar Sidebar + Header no `(dashboard)/layout.tsx`
- [ ] Providers: QueryClientProvider, ThemeProvider

---

## FASE 11 — Frontend: Tela de Login

- [ ] Página `/login` com formulário (email + senha)
- [ ] Validação com React Hook Form + Zod
- [ ] Chamar `POST /api/auth/login`
- [ ] Redirecionar para dashboard após login
- [ ] Exibir erros de validação/autenticação
- [ ] Visual com logo Lumine, fundo cream, formulário centralizado

---

## FASE 12 — Frontend: Dashboard (Home)

- [ ] Cards de KPIs: vendas do dia, faturamento, total de produtos, estoque baixo
- [ ] Gráfico de linha com faturamento dos últimos 30 dias (Recharts)
- [ ] Tabela das últimas 10 vendas
- [ ] Lista de produtos com estoque baixo (alertas)
- [ ] Quick actions: "Nova Venda", "Novo Produto", "Importar Planilha"
- [ ] Skeleton loading em todos os componentes

---

## FASE 13 — Frontend: Produtos & Inventário

- [ ] Tabela paginada de produtos com filtros (categoria, status, busca)
- [ ] Modal/drawer de criar produto (formulário completo)
- [ ] Modal/drawer de editar produto
- [ ] Confirmação de soft delete
- [ ] Seleção múltipla → edição em massa (preço/estoque)
- [ ] Drawer de histórico de alterações (audit log)
- [ ] Badge de estoque baixo nos produtos críticos

---

## FASE 14 — Frontend: Upload de Planilha

- [ ] Dropzone de arquivo (drag & drop ou click)
- [ ] Preview dos dados parseados em tabela (criar vs. atualizar vs. erro)
- [ ] Botão de confirmar import
- [ ] Relatório pós-import com contadores
- [ ] Botão de download do template `.xlsx`
- [ ] Histórico de imports anteriores

---

## FASE 15 — Frontend: PDV / Vendas

### 15.1 Nova Venda
- [ ] Campo de busca de produto (por nome/SKU/barcode)
- [ ] Carrinho com itens, quantidades, descontos por item
- [ ] Desconto total na venda
- [ ] Seletor de método de pagamento (incluindo MISTO)
- [ ] Painel de pagamento misto (dividir entre 2+ métodos)
- [ ] Botão finalizar venda → chama API → limpa carrinho

### 15.2 Histórico de Vendas
- [ ] Tabela paginada com filtros por data/método/valor
- [ ] Modal de detalhe da venda (itens, pagamentos)
- [ ] Botão de cancelar/estornar venda

---

## FASE 16 — Frontend: Pedidos de Reposição

- [ ] Lista de pedidos com status e filtros
- [ ] Formulário de criar pedido (selecionar fornecedor, adicionar itens)
- [ ] Visualização do pedido com progresso de status
- [ ] Botões de transição de status (Enviar, Confirmar Recebimento, Conferir)
- [ ] Ao confirmar CHECKED: atualizar estoque (feedback visual)
- [ ] CRUD de fornecedores

---

## FASE 17 — Frontend: Analytics

- [ ] Seletor de período (dia/semana/mês/ano/custom range)
- [ ] Cards: faturamento bruto, ticket médio, total de vendas, margem média
- [ ] Gráfico de linha — faturamento no período
- [ ] Gráfico de barras — top 10 produtos mais vendidos
- [ ] Gráfico de pizza — distribuição por categoria
- [ ] Tabela de margens por produto
- [ ] Comparativo vs. período anterior

---

## FASE 18 — Frontend: Insights + Configurações

### 18.1 Insights
- [ ] Cards de insights com ícone + título + descrição + ação sugerida
- [ ] Filtro por tipo (estoque, vendas, tendências)
- [ ] Visual com cores indicativas (alerta, positivo, neutro)

### 18.2 Configurações
- [ ] Formulário de perfil da loja
- [ ] CRUD de categorias e subcategorias
- [ ] Gerenciar usuários (listar, convidar, desativar)
- [ ] Botão de backup manual

---

## FASE 19 — Docker & Infra

### 19.1 Dockerfiles
- [ ] Criar `docker/Dockerfile.backend` (multi-stage build)
- [ ] Criar `docker/Dockerfile.frontend` (multi-stage build com standalone output)
- [ ] Criar `docker/docker-compose.prod.yml`

### 19.2 GitHub Actions
- [ ] Criar `.github/workflows/ci.yml` — lint + build em PRs
- [ ] Criar `.github/workflows/deploy.yml` — deploy automático em push para main

### 19.3 VPS Hetzner
- [ ] Provisionar servidor CX22 no Hetzner Cloud
- [ ] Setup inicial: usuário deploy, Docker, Caddy, firewall
- [ ] Configurar DNS do domínio → IP da VPS
- [ ] Criar Caddyfile para `lumine.com.br` e `api.lumine.com.br`
- [ ] Configurar GitHub Secrets: `VPS_HOST`, `VPS_SSH_KEY`, envs de produção
- [ ] Script de backup automático + crontab

---

## FASE 20 — Testes e Qualidade

- [ ] Testes de integração no backend (módulos Auth, Products, Sales)
- [ ] Configurar banco de teste no CI (PostgreSQL service no GitHub Actions)
- [ ] Lint e Prettier configurados e passando em ambos os projetos
- [ ] Variáveis de ambiente documentadas no `.env.example`
- [ ] `README.md` com instruções de setup local

---

## Ordem de Execução Recomendada

```
FASE 0 → FASE 1 → FASE 2 → FASE 3 → FASE 4 → FASE 5
→ FASE 6 → FASE 7 → FASE 8 (backend completo e testável via Postman/Insomnia)
→ FASE 9 → FASE 10 → FASE 11 → FASE 12 (frontend base funcionando)
→ FASE 13 → FASE 14 → FASE 15 → FASE 16 → FASE 17 → FASE 18
→ FASE 19 → FASE 20 (deploy e entrega)
```

## Status Atual

| Fase | Descrição                        | Status       |
|------|----------------------------------|--------------|
| 0    | Setup do Ambiente                | Concluído    |
| 1    | Backend Base                     | Concluído    |
| 2    | Auth                             | Concluído    |
| 3    | Produtos & Inventário            | Concluído    |
| 4    | Upload de Planilha               | Concluído    |
| 5    | Vendas / PDV                     | Concluído    |
| 6    | Pedidos de Reposição             | Concluído    |
| 7    | Analytics                        | Concluído    |
| 8    | Insights + Configurações         | Concluído    |
| 9    | Frontend Setup + Design System   | Concluído    |
| 10   | Componentes de Layout            | Concluído    |
| 11   | Tela de Login                    | Concluído    |
| 12   | Dashboard                        | Concluído    |
| 13   | Produtos (Frontend)              | Concluído    |
| 14   | Upload (Frontend)                | Concluído    |
| 15   | PDV / Vendas (Frontend)          | Concluído    |
| 16   | Pedidos (Frontend)               | Concluído    |
| 17   | Analytics (Frontend)             | Concluído    |
| 18   | Insights + Config (Frontend)     | Concluído    |
| 19   | Docker & Infra & CI/CD           | Concluído    |
| 20   | Testes e Qualidade               | Concluído    |
