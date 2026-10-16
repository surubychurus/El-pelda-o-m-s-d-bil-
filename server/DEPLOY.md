# Desplegar el servidor en el VPS (Ubuntu)

Sustituye `api.tudominio.com` por tu subdominio y haz que su registro DNS `A` apunte a la IP del VPS.

```bash
# 1. Node 22, Caddy y git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git caddy

# 2. Usuario y código
sudo useradd -r -m manhunt
sudo mkdir -p /opt/manhunt && sudo chown manhunt /opt/manhunt
sudo -u manhunt git clone -b ccr-cbe32dbd-uiuaay https://github.com/surubychurus/El-pelda-o-m-s-d-bil-.git /opt/manhunt
cd /opt/manhunt/server

# 3. Configuración
sudo -u manhunt cp .env.example .env
sudo -u manhunt nano .env          # pon DATABASE_URL de Neon y un JWT_SECRET (openssl rand -hex 32)

# 4. Instalar, migrar y compilar
sudo -u manhunt npm ci
sudo -u manhunt npm run db:migrate
sudo -u manhunt npm run build

# 5. Servicio
sudo cp deploy/manhunt.service /etc/systemd/system/
sudo systemctl enable --now manhunt

# 6. HTTPS con Caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # pon tu subdominio
sudo systemctl reload caddy

# Comprobar
curl https://api.tudominio.com/health
```

Actualizar después de cambios:

```bash
cd /opt/manhunt && sudo -u manhunt git pull
cd server && sudo -u manhunt npm ci && sudo -u manhunt npm run db:migrate && sudo -u manhunt npm run build
sudo systemctl restart manhunt
```

Logs: `journalctl -u manhunt -f`
