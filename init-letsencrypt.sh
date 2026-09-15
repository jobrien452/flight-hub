#!/usr/bin/env bash
set -euo pipefail

# one-time bootstrap for a real TLS cert, run this once before the normal
# `docker compose up -d`. needs DOMAIN and CERTBOT_EMAIL set in .env, and DOMAIN's
# DNS must already point at this machine's public IP, since Let's Encrypt has to
# reach it over the internet on port 80 to verify it.

source .env

if [ -z "${DOMAIN:-}" ] || [ -z "${CERTBOT_EMAIL:-}" ]; then
  echo "set DOMAIN and CERTBOT_EMAIL in .env first (see .env.example)"
  exit 1
fi

# nginx refuses to start pointing at a cert that doesn't exist yet, so give it a
# throwaway one just to get it running
if ! docker compose run --rm --entrypoint sh certbot -c "test -d /etc/letsencrypt/live/$DOMAIN"; then
  echo "creating a dummy cert for $DOMAIN so nginx can start"
  docker compose run --rm --entrypoint sh certbot -c "
    mkdir -p /etc/letsencrypt/live/$DOMAIN &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
      -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
      -subj /CN=localhost
  "
fi

echo "starting nginx"
docker compose up -d frontend

echo "deleting the dummy cert"
docker compose run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN \
    /etc/letsencrypt/archive/$DOMAIN \
    /etc/letsencrypt/renewal/$DOMAIN.conf
"

echo "requesting a real cert from let's encrypt"
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email

echo "reloading nginx with the real cert"
docker compose exec frontend nginx -s reload
