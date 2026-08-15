#!/usr/bin/env bash
# ===================================================================
# Disaster Recovery / Restore Script for Gitea on Raspberry Pi 5
# Usage: ./scripts/restore_gitea.sh /path/to/gitea-dump-YYYYMMDD_HHMMSS.zip
# ===================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Error: Backup zip file path required."
    echo "Usage: $0 /path/to/gitea-dump-*.zip"
    exit 1
fi

BACKUP_FILE="$1"
TEMP_RESTORE_DIR="/tmp/gitea_restore_temp"
GITEA_WORK_DIR="/var/lib/gitea"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' does not exist."
    exit 1
fi

echo "=== Starting Gitea Restore Process ==="

# 1. Stop Gitea Service
echo "[INFO] Stopping gitea.service..."
sudo systemctl stop gitea || true

# 2. Extract dump file
echo "[INFO] Extracting archive ${BACKUP_FILE}..."
rm -rf "${TEMP_RESTORE_DIR}"
mkdir -p "${TEMP_RESTORE_DIR}"
unzip -q "${BACKUP_FILE}" -d "${TEMP_RESTORE_DIR}"

# 3. Restore Repositories & Data
echo "[INFO] Restoring Gitea data files..."
if [ -d "${TEMP_RESTORE_DIR}/repos" ]; then
    rsync -avz "${TEMP_RESTORE_DIR}/repos/" "${GITEA_WORK_DIR}/git/repositories/"
fi

if [ -d "${TEMP_RESTORE_DIR}/data" ]; then
    rsync -avz "${TEMP_RESTORE_DIR}/data/" "${GITEA_WORK_DIR}/data/"
fi

# 4. Restore Database (PostgreSQL dump if present)
if [ -f "${TEMP_RESTORE_DIR}/gitea-db.sql" ]; then
    echo "[INFO] Restoring PostgreSQL database from SQL dump..."
    sudo -u postgres psql -d gitea -f "${TEMP_RESTORE_DIR}/gitea-db.sql"
fi

# 5. Restore Permissions
echo "[INFO] Resetting ownership permissions..."
chown -R git:git "${GITEA_WORK_DIR}"

# 6. Cleanup & Restart Service
rm -rf "${TEMP_RESTORE_DIR}"
echo "[INFO] Starting gitea.service..."
sudo systemctl start gitea

echo "=== Gitea Restore Completed Successfully ==="
