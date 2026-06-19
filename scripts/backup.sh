#!/bin/bash
# Backup manual APAC — correr desde la raíz del proyecto
# Uso: bash scripts/backup.sh

set -e

SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY ".env.local" | cut -d= -f2)
BASE_URL="https://dzfduqhuerfsbjmjpgyu.supabase.co/rest/v1"
BACKUP_DIR="$HOME/Desktop/APIP_backups"
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.json"

mkdir -p "$BACKUP_DIR"

TABLES=(cliente proyecto usuario usuario_proyecto documento proceso artefacto entregable reunion simulacion kg_recomendacion kpi notificacion audit_log)

echo "Iniciando backup $DATE..."
echo "{" > "$BACKUP_FILE"
FIRST=true

for TABLE in "${TABLES[@]}"; do
  DATA=$(curl -s "$BASE_URL/$TABLE?select=*&limit=10000" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
  COUNT=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null || echo "?")
  if [ "$FIRST" = true ]; then FIRST=false; else echo "," >> "$BACKUP_FILE"; fi
  echo "  \"$TABLE\": $DATA" >> "$BACKUP_FILE"
  echo "  ✓ $TABLE: $COUNT registros"
done

echo "}" >> "$BACKUP_FILE"
SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo ""
echo "✅ Backup guardado en: $BACKUP_FILE ($SIZE)"
