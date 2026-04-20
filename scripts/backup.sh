#!/bin/bash
# Photostudia Database Backup Script

# Set variables
DB_CONTAINER_NAME="photostudia_db"
DB_NAME="photostudia_db"
DB_USER="photouser"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="photostudia_db_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Starting database backup for ${DB_NAME}..."

# Run pg_dump inside the container
docker exec $DB_CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > ${BACKUP_DIR}/${BACKUP_FILENAME}

# Check if the backup was successful
if [ $? -eq 0 ]; then
    echo "Backup successful: ${BACKUP_DIR}/${BACKUP_FILENAME}"
    # Optional: Keep only last 7 days of backups
    # find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
else
    echo "Error: Database backup failed!"
    exit 1
fi
