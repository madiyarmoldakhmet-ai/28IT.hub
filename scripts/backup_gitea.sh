#!/usr/bin/env bash
# ===================================================================
# Automated Backup Script for Gitea on Raspberry Pi 5
# ===================================================================

set -euo pipefail

# Configuration
GITEA_USER="git"
GITEA_CONF="/etc/gitea/app.ini"
GITEA_WORK_DIR="/var/lib/gitea"
BACKUP_DEST_DIR="/var/backups/gitea"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="gitea-dump-${TIMESTAMP}.zip"

echo "=== [$(date)] Starting Gitea Backup Process ==="

# 1. Ensure backup directory exists
mkdir -p "${BACKUP_DEST_DIR}"
chown "${GITEA_USER}:${GITEA_USER}" "${BACKUP_DEST_DIR}"

# 2. Run Gitea built-in dump command as 'git' user
echo "[INFO] Running gitea dump..."
sudo -u "${GITEA_USER}" gitea dump \
    --config "${GITEA_CONF}" \
    --tempdir /tmp \
    --file "${BACKUP_DEST_DIR}/${BACKUP_FILENAME}"

echo "[SUCCESS] Backup created at ${BACKUP_DEST_DIR}/${BACKUP_FILENAME}"

# 3. Clean up old backups exceeding retention period
echo "[INFO] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DEST_DIR}" -name "gitea-dump-*.zip" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "=== Backup Process Completed Successfully ==="
