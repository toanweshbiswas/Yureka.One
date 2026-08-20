#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

HOST="${EC2_HOST:-13.57.223.228}"
USER="${EC2_USER:-ec2-user}"
KEY="${EC2_KEY:-$ROOT/yureka.pem}"
APP_DIR="${EC2_APP_DIR:-/opt/yureka-one}"

if [[ ! -f "$KEY" ]]; then
  echo "Missing key: $KEY"
  exit 1
fi

chmod 400 "$KEY"

echo "[1/5] Ensuring remote app directory exists..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" \
  "sudo mkdir -p '$APP_DIR' && sudo chown -R '$USER:$USER' '$APP_DIR'"

echo "[2/5] Syncing project files..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude venv \
  --exclude .git \
  --exclude data \
  --exclude '*.pem' \
  --exclude '.env' \
  -e "ssh -i $KEY" \
  ./ "$USER@$HOST:$APP_DIR/"

echo "[3/5] Uploading .env ..."
scp -i "$KEY" "$ROOT/.env" "$USER@$HOST:$APP_DIR/.env"

echo "[4/5] Building + installing deps on server..."
ssh -i "$KEY" "$USER@$HOST" "APP_DIR='$APP_DIR' bash -s" <<'REMOTE'
set -euo pipefail

cd "$APP_DIR"

# Ensure Node/pnpm exist
if ! command -v node >/dev/null; then
  echo "Node.js is missing on server"
  exit 1
fi

if ! command -v pnpm >/dev/null; then
  sudo npm install -g pnpm@9.15.0
fi

export CI=true
export PNPM_CONFIRM_MODULES_PURGE=false

pnpm install --frozen-lockfile
pnpm run build
bash scripts/ensure-python-deps.sh

# Install/update systemd unit
sudo cp scripts/ec2/yureka.service /etc/systemd/system/yureka.service
sudo sed -i "s|User=ubuntu|User=ec2-user|g" /etc/systemd/system/yureka.service
sudo systemctl daemon-reload
sudo systemctl enable yureka
sudo systemctl restart yureka

# Ensure helper TLS files + temporary origin cert (Cloudflare Full / anti-521)
sudo mkdir -p /etc/ssl/yureka-origin /etc/letsencrypt
if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
  sudo tee /etc/letsencrypt/options-ssl-nginx.conf >/dev/null <<'EOF'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
EOF
fi
if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
  sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
fi
if [[ ! -f /etc/ssl/yureka-origin/fullchain.pem ]]; then
  sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout /etc/ssl/yureka-origin/privkey.pem \
    -out /etc/ssl/yureka-origin/fullchain.pem \
    -subj "/CN=yureka.one" \
    -addext "subjectAltName=DNS:yureka.one,DNS:www.yureka.one,DNS:app.yureka.one,DNS:admin.yureka.one"
fi

# Install nginx config (includes :443). Prefer real LE certs when present.
sudo cp scripts/ec2/nginx-yureka.conf /etc/nginx/conf.d/yureka.conf
if [[ -d /etc/letsencrypt/live/yureka.one ]]; then
  sudo sed -i \
    's|/etc/ssl/yureka-origin/fullchain.pem|/etc/letsencrypt/live/yureka.one/fullchain.pem|; s|/etc/ssl/yureka-origin/privkey.pem|/etc/letsencrypt/live/yureka.one/privkey.pem|' \
    /etc/nginx/conf.d/yureka.conf
fi
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo
echo "[health] local app:"
curl -fsS http://127.0.0.1:3000/api/health
echo
echo "[health] nginx:"
curl -fsS -H 'Host: yureka.one' http://127.0.0.1/api/health
echo
REMOTE

echo "[5/5] Done."
echo "Public URLs:"
echo "  https://yureka.one/            (landing)"
echo "  https://app.yureka.one/        (product)"
echo "  https://admin.yureka.one/      (admin)"
echo "  https://13-57-223-228.sslip.io/ (temporary fallback)"
echo "DNS guide: docs/CLOUDFLARE_DNS.md"