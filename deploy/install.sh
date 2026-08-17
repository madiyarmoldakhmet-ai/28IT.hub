#!/usr/bin/env bash
# ===================================================================
# Gitea Installation & Auto-Deployment Script for Raspberry Pi 5
# Platform: Linux ARM64 (Raspberry Pi OS 64-bit) + PostgreSQL
# ===================================================================

set -euo pipefail

# Color Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== [1/6] Checking Privileges & Dependencies ===${NC}"
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run this installation script as root (sudo ./deploy/install.sh)${NC}"
  exit 1
fi

apt-get update
apt-get install -y git postgresql postgresql-contrib curl unzip rsync openssl

echo -e "${BLUE}=== [2/6] Creating System User 'git' ===${NC}"
if ! id -u git >/dev/null 2>&1; then
  adduser \
    --system \
    --shell /bin/bash \
    --gecos 'Gitea Service Account' \
    --group \
    --disabled-password \
    --home /home/git \
    git
  echo -e "${GREEN}System user 'git' created successfully.${NC}"
else
  echo -e "${GREEN}System user 'git' already exists.${NC}"
fi

echo -e "${BLUE}=== [3/6] Setting Up Directory Structure ===${NC}"
mkdir -p /var/lib/gitea/{custom,data,log,git/repositories,data/lfs,data/attachments}
mkdir -p /etc/gitea
mkdir -p /var/log/gitea

chown -R git:git /var/lib/gitea/
chown -R git:git /etc/gitea
chown -R git:git /var/log/gitea
chmod 750 /etc/gitea
chmod 750 /var/lib/gitea

echo -e "${BLUE}=== [4/6] Provisioning PostgreSQL Database ===${NC}"
DB_PASS="${POSTGRES_GITEA_PASSWORD:-gitea_secure_school_pass_2026}"

sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='gitea';" | grep -q 1 || \
sudo -u postgres psql -c "CREATE USER gitea WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='gitea';" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE gitea OWNER gitea ENCODING 'UTF8';"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gitea TO gitea;"

echo -e "${BLUE}=== [5/6] Downloading & Installing Gitea ARM64 Binary ===${NC}"
GITEA_VERSION="1.22.1"
GITEA_BIN_URL="https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-linux-arm64"

echo "Downloading Gitea v${GITEA_VERSION} (linux-arm64)..."
curl -sL "${GITEA_BIN_URL}" -o /tmp/gitea
mv /tmp/gitea /usr/local/bin/gitea
chmod +x /usr/local/bin/gitea

echo -e "${BLUE}=== [6/6] Applying Configuration & Systemd Service ===${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy app.ini and substitute database password
cp "${SCRIPT_DIR}/app.ini" /etc/gitea/app.ini
sed -i "s/%POSTGRES_GITEA_PASSWORD%/${DB_PASS}/g" /etc/gitea/app.ini

# Generate secret keys if default placeholder remains
RANDOM_SECRET=$(openssl rand -hex 16)
RANDOM_INTERNAL_TOKEN=$(openssl rand -hex 32)
sed -i "s/CHANGE_THIS_TO_A_SECURE_RANDOM_KEY_IN_PRODUCTION/${RANDOM_SECRET}/g" /etc/gitea/app.ini
sed -i "s/CHANGE_THIS_TO_INTERNAL_TOKEN_IN_PRODUCTION/${RANDOM_INTERNAL_TOKEN}/g" /etc/gitea/app.ini

chown git:git /etc/gitea/app.ini
chmod 600 /etc/gitea/app.ini

# Install Systemd service
cp "${SCRIPT_DIR}/gitea.service" /etc/systemd/system/gitea.service
systemctl daemon-reload
systemctl enable --now gitea

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN} Gitea School Git-Forge (28IT.hub) Deployed Successfully!${NC}"
echo -e "${GREEN} Access Web Interface: http://raspberrypi.local:3000/ ${NC}"
echo -e "${GREEN} SSH Access Port: 2222 ${NC}"
echo -e "${GREEN} Service Status: sudo systemctl status gitea ${NC}"
echo -e "${GREEN}=======================================================${NC}"
