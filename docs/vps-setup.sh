#!/bin/bash
# Script de setup inicial da VPS Hetzner para o Lumine SaaS
# Execute como root após criar o servidor Ubuntu 24.04
# Uso: bash vps-setup.sh

set -e

echo "🚀 Iniciando setup da VPS Lumine..."

# ─── 1. Atualizar sistema ─────────────────────────────────────
apt update && apt upgrade -y
apt install -y git curl wget ufw fail2ban

# ─── 2. Criar usuário deploy ──────────────────────────────────
if ! id -u deploy &>/dev/null; then
  adduser --gecos "" --disabled-password deploy
  echo "deploy:$(openssl rand -base64 32)" | chpasswd
  usermod -aG sudo deploy
  mkdir -p /home/deploy/.ssh
  cp -r ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys 2>/dev/null || true
  chown -R deploy:deploy /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
fi

# ─── 3. Instalar Docker ───────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker deploy
fi

# ─── 4. Instalar Caddy ───────────────────────────────────────
if ! command -v caddy &>/dev/null; then
  apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
  apt update && apt install -y caddy
fi

# ─── 5. Firewall ─────────────────────────────────────────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✅ Firewall configurado"

# ─── 6. Fail2ban ─────────────────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban
echo "✅ Fail2ban ativo"

# ─── 7. Desabilitar login por senha SSH ───────────────────────
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd
echo "✅ Login por senha SSH desabilitado"

# ─── 8. Clonar repositório ───────────────────────────────────
su - deploy -c "
  if [ ! -d /home/deploy/lumine_saas ]; then
    git clone https://github.com/SEU_USUARIO/lumine_saas.git /home/deploy/lumine_saas
    echo '✅ Repositório clonado'
  else
    echo 'Repositório já existe'
  fi
"

# ─── 9. Configurar backup automático ─────────────────────────
mkdir -p /home/deploy/scripts /home/deploy/backups
chown -R deploy:deploy /home/deploy/scripts /home/deploy/backups

cat > /home/deploy/scripts/backup.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
mkdir -p "$BACKUP_DIR"

CONTAINER_NAME=$(docker ps --filter "name=lumine-postgres" --format "{{.Names}}" | head -1)

if [ -n "$CONTAINER_NAME" ]; then
  docker exec "$CONTAINER_NAME" pg_dump -U lumine lumine_prod > "$BACKUP_DIR/lumine_${TIMESTAMP}.sql"
  gzip "$BACKUP_DIR/lumine_${TIMESTAMP}.sql"
  echo "✅ Backup criado: lumine_${TIMESTAMP}.sql.gz"
  # Manter apenas os últimos 30 backups
  ls -t "$BACKUP_DIR"/lumine_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm
else
  echo "❌ Container postgres não encontrado"
fi
EOF

chmod +x /home/deploy/scripts/backup.sh
chown deploy:deploy /home/deploy/scripts/backup.sh

# Crontab: backup diário às 3h da manhã
(crontab -u deploy -l 2>/dev/null; echo "0 3 * * * /home/deploy/scripts/backup.sh >> /home/deploy/backups/backup.log 2>&1") | crontab -u deploy -
echo "✅ Backup automático configurado (3h diário)"

# ─── 10. Configurar Caddy ────────────────────────────────────
# Copiar Caddyfile após editar com o domínio correto
echo ""
echo "⚠️  PRÓXIMOS PASSOS MANUAIS:"
echo "   1. Edite /home/deploy/lumine_saas/docker/Caddyfile com seu domínio"
echo "   2. Copie o Caddyfile: sudo cp /home/deploy/lumine_saas/docker/Caddyfile /etc/caddy/Caddyfile"
echo "   3. Reinicie Caddy: sudo systemctl restart caddy"
echo "   4. Crie .env.prod em /home/deploy/lumine_saas/ com as variáveis de produção"
echo "   5. Adicione os GitHub Secrets: VPS_HOST, VPS_SSH_KEY, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET"
echo "   6. Faça push para main para disparar o deploy automático"
echo ""
echo "🎉 Setup base concluído!"
