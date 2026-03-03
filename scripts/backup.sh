#!/bin/bash
# Backup script for PostgreSQL database

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$TIMESTAMP.dump"

# Environment variables POSTGRES_USER and POSTGRES_DB should be available
echo "Starting backup of $POSTGRES_DB..."
pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c > "$FILENAME"

if [ $? -eq 0 ]; then
  echo "Backup successful: $FILENAME"
else
  echo "Error during backup."
  exit 1
fi

# Optional: keep only last 7 days of backups
# find "$BACKUP_DIR" -type f -name "*.dump" -mtime +7 -delete
