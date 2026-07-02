#!/usr/bin/env bash
# deploy.sh — empuja cambios a GitHub y espera confirmación de Railway
# Uso: ./deploy.sh "mensaje del commit"

set -e

MSG="${1:-deploy}"

echo "🔍 Verificando TypeScript..."
npx tsc --noEmit

echo "📦 Committing y pusheando a GitHub..."
git add -A
git diff --cached --quiet && echo "Sin cambios que commitear." || git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main

echo "⏳ Railway detectará el push y construirá automáticamente."
echo "   Monitorea en: https://railway.com/project/05bd327d-f733-41d6-8576-be6d767702a8"
echo ""
echo "🔁 Esperando que la nueva versión esté lista..."

for i in {1..30}; do
  sleep 15
  OUT=$(railway logs --service APLICATIVO 2>&1 | tail -3)
  echo "   $OUT"
  echo "$OUT" | grep -q "Ready in" && echo "✅ DEPLOY LISTO — https://aplicativo-production.up.railway.app" && exit 0
done

echo "⚠️  Timeout — revisa Railway manualmente."
