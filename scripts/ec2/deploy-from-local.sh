#!/usr/bin/env bash
# Deploy from your laptop once SSH works:
#   EC2_HOST=13.57.223.228 EC2_USER=ec2-user EC2_KEY=./yureka.pem ./scripts/ec2/deploy-from-local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

HOST="${EC2_HOST:?Set EC2_HOST (e.g. 13.57.223.228)}"
KEY="${EC2_KEY:-$ROOT/yureka.pem}"
USER="${EC2_USER:-ec2-user}"
APP_DIR="${EC2_APP_DIR:-/opt/yureka-one}"

if [[ ! -f "$KEY" ]]; then
  echo "Missing key: $KEY"
  exit 1
fi
chmod 400 "$KEY"

RSYNC_EXCLUDES=(--exclude node_modules --exclude dist --exclude venv --exclude .git --exclude data --exclude "*.pem" --exclude ".env")

echo "[deploy] Syncing to $USER@$HOST:$APP_DIR ..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" "sudo mkdir -p $APP_DIR && sudo chown -R $USER:$USER $APP_DIR"
rsync -avz --delete "${RSYNC_EXCLUDES[@]}" -e "ssh -i $KEY" ./ "$USER@$HOST:$APP_DIR/"

echo "[deploy] Building and restarting on server ..."
ssh -i "$KEY" "$USER@$HOST" bash -s <<REMOTE
set -euo pipefail
cd "$APP_DIR"
set -a && source .env && set +a
export CI=true
pnpm install --frozen-lockfile
pnpm run build
bash scripts/ensure-python-deps.sh
if ! systemctl list-unit-files | grep -q '^yureka\.service'; then
  APP_USER="$USER" bash scripts/ec2/bootstrap.sh
else
  sudo systemctl daemon-reload
fi
sudo systemctl restart yureka
sudo systemctl restart nginx
curl -fsS http://127.0.0.1/api/health && echo && echo OK
REMOTE

echo "[deploy] Live: http://$HOST/"
