# Rollback en producción (Railway)

No existe ningún script de rollback automatizado en este repo — este documento
es la referencia de qué hacer cuando un deploy sale mal.

## 1. Revertir el código desplegado (rápido, vía dashboard de Railway)

Railway guarda el historial de deploys de cada servicio:

1. Entra al [dashboard de Railway](https://railway.app) → proyecto → servicio **APLICATIVO**.
2. Pestaña **Deployments**.
3. Busca el último deploy que funcionaba bien (antes del que causó el
   problema) y usa la opción de **redeploy** sobre ese build anterior.

Esto vuelve a servir el código anterior sin necesidad de tocar git ni volver
a hacer build — es la opción más rápida para cortar un incidente.

## 2. Revertir en git (si además quieres que `main` refleje el estado bueno)

```bash
git log --oneline -10          # identificar el commit malo
git revert <commit-malo>       # crea un commit nuevo que deshace los cambios
git push
```

Preferir `git revert` sobre `git reset --hard` + force-push: revert no
reescribe historia, así que no rompe a nadie más que tenga el branch
clonado, y Railway vuelve a deployar automáticamente al pushear.

## ⚠️ Ojo con las migraciones de base de datos

Revertir el código de la app **no revierte migraciones de Supabase**. Si el
deploy problemático incluyó una migración SQL (`supabase/migrations/*.sql`)
que ya se aplicó manualmente (ver el flujo de este proyecto: las migraciones
se aplican a mano vía Supabase SQL Editor, no automáticamente), un rollback
del código por sí solo puede dejar el esquema de la BD desalineado con el
código que vuelve a estar activo.

Antes de revertir un deploy que incluyó una migración:
- Si la migración solo agregó (columnas, índices, políticas RLS nuevas) y el
  código viejo simplemente las ignora, el rollback de código es seguro sin
  tocar la BD.
- Si la migración modificó o eliminó algo que el código viejo todavía
  necesita (renombró una columna, cambió un tipo, borró una función), hay
  que escribir y aplicar una migración de reversión antes de o junto con el
  rollback del código — no asumir que alcanza con revertir el código.

## 3. Verificar después del rollback

- `curl https://aplicativo-production.up.railway.app/api/health` → debe
  devolver `{"status":"ok",...}` con HTTP 200. Si devuelve 503, la BD no es
  alcanzable — no es un problema del código que acabas de revertir.
- Confirmar en el dashboard de Railway que el servicio pasó el healthcheck
  y está `Online`.
- Probar login y una pantalla con datos reales (Discovery, Documentos) antes
  de dar el incidente por cerrado.
