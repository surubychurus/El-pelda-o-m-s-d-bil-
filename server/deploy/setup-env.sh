#!/usr/bin/env bash
# Crea server/.env pidiéndote la cadena de Neon sin mostrarla en pantalla
# y generando el JWT_SECRET por ti. Ejecútalo desde la carpeta server/.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  read -r -p ".env ya existe. ¿Sobrescribirlo? [s/N] " ans
  [ "${ans:-N}" = "s" ] || { echo "Cancelado."; exit 0; }
fi

read -r -s -p "Pega tu DATABASE_URL de Neon (no se verá al escribir): " DB
echo
case "$DB" in
  postgres://*|postgresql://*) ;;
  *) echo "Eso no parece una cadena de Postgres (debe empezar por postgresql://)"; exit 1 ;;
esac

umask 077
cat > .env <<ENV
DATABASE_URL=$DB
JWT_SECRET=$(openssl rand -hex 32)
PORT=3100
HOST=127.0.0.1
ENV
echo "Listo: server/.env creado (permisos 600)."
