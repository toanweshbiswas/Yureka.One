#!/usr/bin/env bash
# First-time EC2 setup for Yureka.One.
# Supports Amazon Linux 2023 and Ubuntu 22.04/24.04.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/yureka-one}"
REPO="${REPO:-https://github.com/Sakshikhade/Yureka.One.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"   # e.g. yureka.one — leave empty to use IP-only HTTP
APP_USER="${APP_USER:-$(id -un)}"

echo "[bootstrap] Yureka.One EC2 bootstrap → $APP_DIR"

if [[ $EUID -ne 0 ]]; then
  SUDO=sudo
else
  SUDO=
fi

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
else
  echo "Unsupported OS: missing /etc/os-release"
  exit 1
fi

if [[ "${ID:-}" == "amzn" ]]; then
  $SUDO dnf install -y --allowerasing git curl ca-certificates nginx python3 python3-pip gcc-c++ make rsync
  if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO dnf install -y --allowerasing nodejs
  fi
else
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq git curl ca-certificates nginx python3 python3-venv python3-pip build-essential rsync
  if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y -qq nodejs
  fi
fi

# pnpm
if ! command -v pnpm >/dev/null; then
  $SUDO corepack enable || true
  $SUDO corepack prepare pnpm@9.15.0 --activate || $SUDO npm install -g pnpm@9.15.0
fi

$SUDO mkdir -p "$APP_DIR"
$SUDO chown -R "$APP_USER:$APP_USER" "$APP_DIR" 2>/dev/null || true

if [[ ! -d "$APP_DIR/.git" && -z "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
  git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "[bootstrap] Copy .env.example → .env and fill secrets before starting."
  cp .env.example .env
  echo "[bootstrap] REQUIRED: edit $APP_DIR/.env (Supabase, Hubble, ADMIN_*, APP_ORIGIN)"
fi

# shellcheck disable=SC1091
set -a
source .env 2>/dev/null || true
set +a

export CI=true
pnpm install --frozen-lockfile
pnpm run build
bash scripts/ensure-python-deps.sh

# systemd
$SUDO cp scripts/ec2/yureka.service /etc/systemd/system/yureka.service
$SUDO sed -i "s|/opt/yureka-one|$APP_DIR|g" /etc/systemd/system/yureka.service
$SUDO sed -i "s|User=ubuntu|User=$APP_USER|g" /etc/systemd/system/yureka.service
$SUDO systemctl daemon-reload
$SUDO systemctl enable yureka
$SUDO systemctl restart yureka

# nginx
if [[ "${ID:-}" == "amzn" ]]; then
  NGINX_CONF=/etc/nginx/conf.d/yureka.conf
  $SUDO cp scripts/ec2/nginx-yureka.conf "$NGINX_CONF"
else
  NGINX_CONF=/etc/nginx/sites-available/yureka
  $SUDO cp scripts/ec2/nginx-yureka.conf "$NGINX_CONF"
  $SUDO ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/yureka
  $SUDO rm -f /etc/nginx/sites-enabled/default
fi
if [[ -n "$DOMAIN" ]]; then
  $SUDO sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/" "$NGINX_CONF"
fi
$SUDO nginx -t
$SUDO systemctl enable nginx
$SUDO systemctl restart nginx

echo "[bootstrap] Done. Check:"
echo "  curl -s http://127.0.0.1:3000/api/health"
echo "  curl -s http://127.0.0.1/api/health"
if [[ -n "$DOMAIN" ]]; then
  echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi
