#!/bin/bash
# Backup sensitive data files before commits
# Usage: ./scripts/backup-data.sh

set -e

BACKUP_DIR="$HOME/.cortex-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

echo "=== Cortex Freelancer — Data Backup ==="
echo "Backing up to: $BACKUP_PATH"

mkdir -p "$BACKUP_PATH"

# Backup data directory (customers, etc.)
if [ -d "data" ]; then
  cp -r data "$BACKUP_PATH/data" 2>/dev/null || true
  echo "[OK] data/ backed up"
else
  echo "[SKIP] data/ not found"
fi

# Backup .env if exists
if [ -f ".env" ]; then
  cp .env "$BACKUP_PATH/.env"
  echo "[OK] .env backed up"
fi

# Backup Firestore rules and indexes
for f in firestore.rules firestore.indexes.json; do
  if [ -f "$f" ]; then
    cp "$f" "$BACKUP_PATH/$f"
    echo "[OK] $f backed up"
  fi
done

# Cleanup old backups (keep last 10)
cd "$BACKUP_DIR"
ls -dt */ 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

echo ""
echo "Backup complete: $BACKUP_PATH"
echo "Total backups: $(ls -d */ 2>/dev/null | wc -l | tr -d ' ')"
