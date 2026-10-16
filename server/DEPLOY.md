# Desplegar el servidor en el VPS (Ubuntu + nginx)

El dominio es `man.diferentt.cloud` y su registro DNS ya apunta a la IP del VPS. El VPS ya tiene **nginx** en los puertos 80 y 443, así que se usa nginx como proxy (no Caddy).

```bash
# 1. Node 22, git y certbot (nginx ya está instalado)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git certbot python3-certbot-nginx

# 2. Usuario y código
sudo useradd -r -m manhunt
sudo mkdir -p /opt/manhunt && sudo chown manhunt /opt/manhunt
sudo -u manhunt git clone -b ccr-cbe32dbd-uiuaay https://github.com/surubychurus/El-pelda-o-m-s-d-bil-.git /opt/manhunt
cd /opt/manhunt/server

# 3. Configuración: te pide la cadena de Neon (sin mostrarla) y genera el JWT_SECRET
sudo -u manhunt ./deploy/setup-env.sh

# 4. Instalar, migrar y compilar
sudo -u manhunt npm ci
sudo -u manhunt npm run db:migrate      # las tablas ya existen en tu Neon: no repite nada
sudo -u manhunt npm run build

# 5. Servicio
sudo cp deploy/manhunt.service /etc/systemd/system/
sudo systemctl enable --now manhunt
curl http://127.0.0.1:3000/health        # → {"ok":true}

# 6. nginx: proxy hacia el servidor, con soporte de WebSocket
sudo cp deploy/nginx-manhunt.conf /etc/nginx/sites-available/manhunt
sudo ln -s /etc/nginx/sites-available/manhunt /etc/nginx/sites-enabled/manhunt
sudo nginx -t && sudo systemctl reload nginx

# 7. HTTPS (certificado gratis de Let's Encrypt; certbot edita la config de nginx)
sudo certbot --nginx -d man.diferentt.cloud

# Comprobar desde fuera
curl https://man.diferentt.cloud/health  # → {"ok":true}
```

Notas:
- Si en el paso 6 `nginx -t` avisa de un `server_name` repetido, ya hay otro sitio usando ese dominio: dime qué sale.
- Las apps de Android e iOS bloquean el tráfico sin cifrar, por eso hace falta el paso 7.

Actualizar después de cambios:

```bash
cd /opt/manhunt && sudo -u manhunt git pull
cd server && sudo -u manhunt npm ci && sudo -u manhunt npm run db:migrate && sudo -u manhunt npm run build
sudo systemctl restart manhunt
```

Logs: `journalctl -u manhunt -f`
