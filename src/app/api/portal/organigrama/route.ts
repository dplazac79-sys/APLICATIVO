import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file       = formData.get('file') as File | null
  const proyectoId = formData.get('proyecto_id') as string | null

  if (!file || !proyectoId) return NextResponse.json({ error: 'Falta archivo o proyecto_id' }, { status: 400 })

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })

  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar acceso al proyecto
  const { data: acceso } = await admin.from('usuario_proyecto')
    .select('id').eq('usuario_id', user.id).eq('proyecto_id', proyectoId).maybeSingle()
  if (!acceso) return NextResponse.json({ error: 'Sin acceso al proyecto' }, { status: 403 })

  const ext  = file.name.split('.').pop()
  const path = `${proyectoId}/organigrama-${Date.now()}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage.from('glosario-roles').upload(path, buf, {
    contentType: file.type, upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Extraer texto — solo sabemos leer PDF con texto real embebido (pdf-parse
  // lee la capa de texto del PDF, no hace OCR). Antes, subir una imagen, un
  // PDF escaneado o un .doc/.docx quedaba "aceptado" sin ningún aviso y el
  // registro se quedaba en estado 'pendiente' para siempre — el análisis de
  // Glosario de Roles nunca podía correr y nadie entendía por qué.
  let textoExtraido: string | null = null
  let advertencia: string | null = null

  if (file.type !== 'application/pdf') {
    advertencia = 'Solo se puede leer el texto de archivos PDF con texto seleccionable (exportados desde Word, Excel o Google Docs). Este archivo se guardó, pero no se pudo analizar — vuelve a subirlo como PDF.'
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const extraido = (await pdfParse(buf)).text
      if (extraido.trim().length >= 20) {
        textoExtraido = extraido
      } else {
        advertencia = 'No se pudo leer texto en este PDF — probablemente es un documento escaneado o una foto guardada como PDF, sin texto seleccionable. Exporta el organigrama como PDF desde Word, Excel o Google Docs (no una imagen) y vuelve a subirlo.'
      }
    } catch {
      advertencia = 'No se pudo leer texto en este PDF. Exporta el organigrama como PDF desde Word, Excel o Google Docs (no una imagen ni un escaneo) y vuelve a subirlo.'
    }
  }

  const { data: org, error: dbError } = await admin.from('organigrama_cliente').insert({
    proyecto_id: proyectoId,
    storage_path: path,
    nombre_archivo: file.name,
    texto_extraido: textoExtraido,
    estado: textoExtraido ? 'listo' : 'error',
    subido_por: user.id,
  }).select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Auto-trigger: si hay documentos procesados, recolectar roles y lanzar análisis IA
  if (textoExtraido) {
    try {
      // documento no tiene columna proceso_id (ver nota igual en
      // glosario-roles/route.ts) — ese embed hacía fallar esta consulta en
      // silencio y el auto-trigger nunca recolectaba roles.
      const { data: documentos } = await admin
        .from('documento')
        .select('nombre_archivo, analisis_ia')
        .eq('proyecto_id', proyectoId)
        .eq('estado_procesamiento', 'listo')
        .not('analisis_ia', 'is', null)

      if (documentos && documentos.length > 0) {
        const rolesMap = new Map<string, { rol: string; descripcion: string; procesos: string[] }>()
        for (const doc of documentos) {
          const ia = doc.analisis_ia as Record<string, unknown>
          const rolesDoc = ia?.roles_y_responsabilidades as Record<string, unknown> | undefined
          const docName = doc.nombre_archivo
          const rolesId = (rolesDoc?.roles_identificados as string[] | undefined) ?? []
          for (const rol of rolesId) {
            if (!rol?.trim()) continue
            const key = rol.toLowerCase().trim()
            if (rolesMap.has(key)) { rolesMap.get(key)!.procesos.push(docName) }
            else rolesMap.set(key, { rol: rol.trim(), descripcion: '', procesos: [docName] })
          }
        }

        const rolesEnProcesos = Array.from(rolesMap.values()).slice(0, 30)
        if (rolesEnProcesos.length > 0) {
          const { data: analisis } = await admin.from('glosario_roles_analisis').insert({
            proyecto_id: proyectoId, organigrama_id: org.id,
            roles_en_procesos: rolesEnProcesos, estado: 'generando',
          }).select('id').single()

          if (analisis) {
            await inngest.send({
              name: 'portal/analizar-glosario-roles',
              data: { analisis_id: analisis.id, proyecto_id: proyectoId },
            })
          }
        }
      }
    } catch { /* best effort — no bloquear la respuesta al usuario */ }
  }

  return NextResponse.json({ ok: true, organigrama: org, advertencia })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('organigrama_cliente')
    .select('id, nombre_archivo, estado, created_at')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ organigramas: data ?? [] })
}
