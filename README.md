# Lumine — SaaS de Gestão

Sistema completo de gestão para a loja **Lumine** (artigos de dança). Cobre estoque, PDV, pedidos de reposição, analytics e insights.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Recharts |
| Backend | Node.js · Express · TypeScript · Prisma ORM |
| Banco | PostgreSQL 16 |
| Auth | JWT em httpOnly cookies · bcrypt |
| Infra | Docker · Caddy · Hetzner VPS |
| CI/CD | GitHub Actions |

## Rodando localmente

### Pré-requisitos

- Node.js 20 LTS
- Docker Desktop
- Git

### 1. Clonar e configurar

```bash
git clone https://github.com/SEU_USUARIO/lumine_saas.git
cd lumine_saas

# Copiar variáveis de ambiente
cp .env.example backend/.env
# Edite backend/.env se necessário
```

### 2. Subir o PostgreSQL

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

### 3. Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed          # Popula categorias + usuário admin
npm run dev              # Inicia em http://localhost:4000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev              # Inicia em http://localhost:3000
```

### Credenciais padrão (seed)

```
Email: admin@lumine.com.br
Senha: Lumine@2024!
```

## Estrutura

```
lumine_saas/
├── backend/          # Express API + Prisma
│   ├── src/
│   │   ├── modules/  # auth, products, sales, orders, analytics, insights, upload, settings
│   │   ├── middleware/
│   │   ├── config/
│   │   └── shared/
│   └── prisma/       # Schema + seed
├── frontend/         # Next.js 14
│   └── src/
│       ├── app/      # Rotas (App Router)
│       ├── components/
│       ├── hooks/
│       └── lib/
├── docker/           # Dockerfiles + Compose
├── docs/             # Arquitetura, banco, infra, roadmap
└── .github/workflows # CI + Deploy
```

## API Endpoints principais

| Módulo | Base |
|---|---|
| Auth | `POST /api/auth/login` · `GET /api/auth/me` |
| Produtos | `GET/POST /api/products` · `PATCH /api/products/bulk` |
| Upload | `POST /api/upload/preview` · `POST /api/upload/confirm` |
| Vendas | `GET/POST /api/sales` · `POST /api/sales/:id/cancel` |
| Pedidos | `GET/POST /api/orders` · `PATCH /api/orders/:id/status` |
| Analytics | `GET /api/analytics/revenue` · `/top-products` · `/categories` |
| Insights | `GET /api/insights` · `/stock` · `/sales` |
| Config | `GET/PUT /api/settings` · `/categories` · `/users` |

## Deploy (produção)

```bash
# 1. Setup inicial da VPS (executar uma vez como root)
bash docs/vps-setup.sh

# 2. Configurar GitHub Secrets:
#    VPS_HOST, VPS_SSH_KEY, DB_NAME, DB_USER, DB_PASSWORD,
#    JWT_SECRET, FRONTEND_URL, API_URL

# 3. Push para main dispara deploy automático via GitHub Actions
git push origin main
```

## Licença

Proprietário — Lumine © 2024
