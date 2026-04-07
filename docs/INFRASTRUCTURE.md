# Lumine SaaS — Infraestrutura & CI/CD

## 1. Ambiente de Desenvolvimento (Local)

```bash
# Pré-requisitos
- Node.js 20 LTS
- Docker + Docker Compose
- Git

# Subir tudo localmente
docker-compose up -d          # Postgres + Redis (se necessário)
cd backend && npm run dev     # Express em hot-reload (nodemon/tsx)
cd frontend && npm run dev    # Next.js em hot-reload
```

### Docker Compose (dev)
```yaml
# docker/docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: lumine_dev
      POSTGRES_USER: lumine
      POSTGRES_PASSWORD: lumine_dev_2024
    ports:
      - "5432:5432"
    volumes:
      - pgdata_dev:/var/lib/postgresql/data

volumes:
  pgdata_dev:
```

---

## 2. VPS — Hetzner Cloud

### Servidor Recomendado
| Spec           | Valor                |
|----------------|----------------------|
| Plano          | CX22                 |
| vCPU           | 2 (AMD EPYC)        |
| RAM            | 4 GB                 |
| SSD            | 40 GB NVMe           |
| Tráfego        | 20 TB/mês            |
| SO             | Ubuntu 24.04 LTS     |
| Localização    | Ashburn, US (ou Nuremberg, DE) |
| Custo          | €4.35/mês            |

### Setup Inicial do Servidor
```bash
# 1. Criar SSH key e adicionar à Hetzner
ssh-keygen -t ed25519 -C "lumine-deploy"

# 2. Acesso ao servidor
ssh root@<IP_DO_SERVIDOR>

# 3. Criar usuário deploy
adduser deploy
usermod -aG sudo deploy
cp -r ~/.ssh /home/deploy/.ssh
chown -R deploy:deploy /home/deploy/.ssh

# 4. Instalar Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# 5. Instalar Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# 6. Firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## 3. Docker Compose (Produção)

```yaml
# docker/docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - lumine-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ../backend
      dockerfile: ../docker/Dockerfile.backend
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 4000
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - lumine-net
    ports:
      - "4000:4000"

  frontend:
    build:
      context: ../frontend
      dockerfile: ../docker/Dockerfile.frontend
    restart: always
    environment:
      NEXT_PUBLIC_API_URL: https://api.lumine.com.br
    depends_on:
      - backend
    networks:
      - lumine-net
    ports:
      - "3000:3000"

volumes:
  pgdata:

networks:
  lumine-net:
    driver: bridge
```

---

## 4. Dockerfiles

### Backend
```dockerfile
# docker/Dockerfile.backend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S express -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
USER express
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### Frontend
```dockerfile
# docker/Dockerfile.frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

---

## 5. Caddy — Reverse Proxy + HTTPS

```
# /etc/caddy/Caddyfile

lumine.com.br {
    reverse_proxy localhost:3000
}

api.lumine.com.br {
    reverse_proxy localhost:4000
}
```

> Caddy gera e renova certificados HTTPS automaticamente via Let's Encrypt. Zero configuração adicional.

---

## 6. CI/CD com GitHub Actions

### Pipeline de CI (Pull Requests)
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: lumine_test
          POSTGRES_USER: lumine
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install backend deps
        working-directory: ./backend
        run: npm ci

      - name: Lint backend
        working-directory: ./backend
        run: npm run lint

      - name: Test backend
        working-directory: ./backend
        run: npm test
        env:
          DATABASE_URL: postgresql://lumine:test_password@localhost:5432/lumine_test

      - name: Install frontend deps
        working-directory: ./frontend
        run: npm ci

      - name: Lint frontend
        working-directory: ./frontend
        run: npm run lint

      - name: Build frontend
        working-directory: ./frontend
        run: npm run build
```

### Pipeline de Deploy (Merge em main)
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/deploy/lumine_saas
            git pull origin main
            cd docker
            docker compose -f docker-compose.prod.yml build
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
            docker image prune -f
```

---

## 7. Backup Strategy

### Backup automático do PostgreSQL
```bash
# /home/deploy/scripts/backup.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
mkdir -p $BACKUP_DIR

docker exec lumine-postgres pg_dump -U lumine lumine_prod > "$BACKUP_DIR/lumine_$TIMESTAMP.sql"

# Manter apenas últimos 30 backups
ls -t $BACKUP_DIR/lumine_*.sql | tail -n +31 | xargs -r rm

# Opcional: enviar para storage externo (Hetzner Storage Box ~€1/mês)
# rsync -az "$BACKUP_DIR/" u123456@u123456.your-storagebox.de:backups/
```

```bash
# Crontab — backup diário às 3h
crontab -e
0 3 * * * /home/deploy/scripts/backup.sh
```

### Backup manual via SaaS
- Endpoint `POST /api/settings/backup` gera dump SQL e retorna como download
- Permite a dona da loja fazer backup quando quiser pela interface

---

## 8. Monitoramento

| O quê              | Ferramenta        | Custo  |
|--------------------|-------------------|--------|
| Uptime             | UptimeRobot       | Free   |
| Métricas Docker    | docker stats      | Free   |
| Logs               | Docker logs + journalctl | Free |
| DB Performance     | pg_stat_statements | Free  |
| Alertas            | UptimeRobot → Email/Telegram | Free |

---

## 9. Segurança

- SSH apenas via key (password login desabilitado)
- Firewall (ufw) com apenas portas 22, 80, 443
- PostgreSQL não exposto externamente (só via Docker network)
- HTTPS automático via Caddy + Let's Encrypt
- JWT em httpOnly cookies + CSRF token
- Rate limiting no Express (express-rate-limit)
- Helmet.js para headers de segurança
- Inputs sanitizados via Zod + Prisma (parameterized queries)
- .env nunca commitado (secrets no GitHub Actions)
- Fail2ban para proteção contra brute force SSH
