import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { requireRole, assertProyectoAccess } from '@/lib/auth/tenant'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'
import {
  generarArtefacto,
  ORDEN_GENERACION,
  type ContextoProceso,
  type DocumentoResumen,
} from '@/lib/ai/artefactos'
import type { TipoArtefacto } from '@/types/database'
import { errorResponse } from '@/lib/api/error-response'

// GET: listar artefactos de un proceso
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('artefacto')
      .select('*')
      .eq('proceso_id', params.id)
      .order('tipo')
    if (error) return jsonError(error)
    return NextResponse.json({ artefactos: data ?? [] })
  } catch (err) {
    return errorResponse(err, 500)
  }
}

// POST: generar artefactos para un proceso (todos o uno específico)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos para generar artefactos' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const tipoSolicitado: TipoArtefacto | undefined = body.tipo

  // Cargar proyecto_id para el job
  const { data: proceso } = await admin.from('proceso').select('proyecto_id').eq('id', params.id).single()

  if (!proceso?.proyecto_id || !(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  if (proceso?.proyecto_id) {
    const limite = await verificarLimiteIA(proceso.proyecto_id, 'generacion')
    if (!limite.permitido) {
      return NextResponse.json({ error: limite.mensaje }, { status: 429 })
    }
  }

  // Crear job para tracking
  const { data: job } = await admin.from('jobs').insert({
    tipo: 'discovery_procesos',  // tipo más cercano disponible en el enum
    estado: 'procesando',
    proyecto_id: proceso?.proyecto_id ?? null,
    payload: { proceso_id: params.id, tipo: tipoSolicitado ?? 'todos' },
  }).select().single()

  // Usar waitUntil si está disponible (Edge runtime) para sobrevivir al fin de la respuesta
  const bgPromise = procesarArtefactosEnBackground(params.id, user.id, tipoSolicitado, job?.id)
  // waitUntil mantiene viva la función serverless hasta que el job termina
  const globalWithWaitUntil = globalThis as typeof globalThis & { waitUntil?: (promise: Promise<unknown>) => void }
  if (typeof globalWithWaitUntil.waitUntil === 'function') {
    globalWithWaitUntil.waitUntil(bgPromise)
  }

  return NextResponse.json({ ok: true, job_id: job?.id })
}

async function procesarArtefactosEnBackground(
  proceso_id: string,
  usuarioId: string,
  tipoSolicitado: TipoArtefacto | undefined,
  jobId?: string
) {
  const admin = createAdminClient()
  try {
    // Cargar proceso con proyecto y cliente
    const { data: proceso } = await admin
      .from('proceso')
      .select('*, proyecto(nombre, cliente(razon_social, industria))')
      .eq('id', proceso_id)
      .single()

    if (!proceso) throw new Error('Proceso no encontrado')

    const proyectoRaw = proceso.proyecto as Record<string, unknown>
    const clienteRaw = proyectoRaw?.cliente as Record<string, unknown>

    const ctx: ContextoProceso = {
      nombre: proceso.nombre,
      descripcion: proceso.descripcion,
      nivel: proceso.nivel,
      origen: proceso.origen,
      roles_involucrados: proceso.roles_involucrados,
      riesgos_detectados: proceso.riesgos_detectados,
      metadata_ia: proceso.metadata_ia as Record<string, unknown> | null,
      proyecto_nombre: String(proyectoRaw?.nombre ?? ''),
      cliente_razon_social: String(clienteRaw?.razon_social ?? ''),
      cliente_industria: clienteRaw?.industria ? String(clienteRaw.industria) : null,
    }

    // Cargar documentos con análisis IA (sin filtrar por estado_procesamiento — algunos quedan en 'procesando')
    const { data: documentos } = await admin
      .from('documento')
      .select('nombre_archivo, resumen_ejecutivo, analisis_ia, clasificacion')
      .eq('proyecto_id', proceso.proyecto_id)
      .not('analisis_ia', 'is', null)

    const docs: DocumentoResumen[] = (documentos ?? []).map(d => {
      const ia = (d.analisis_ia as { analisis?: Record<string, unknown> } | null)?.analisis ?? (d.analisis_ia as Record<string, unknown> | null)
      const resumen = ia?.resumen_ejecutivo ?? d.resumen_ejecutivo ?? null
      return {
        nombre_archivo: d.nombre_archivo,
        resumen_ejecutivo: resumen,
        clasificacion: d.clasificacion as Record<string, unknown> | null,
      }
    })

    const tipos = tipoSolicitado ? [tipoSolicitado] : ORDEN_GENERACION
    const generados: Record<string, unknown> = {}

    for (const tipo of tipos) {
      // Cargar artefactos previos para los tipos dependientes
      const existentes: Record<string, Record<string, unknown>> = {}
      if (['to_be', 'dashboard_brechas', 'cierre_ejecutivo'].includes(tipo)) {
        const { data: previos } = await admin
          .from('artefacto')
          .select('tipo, contenido')
          .eq('proceso_id', proceso_id)
          .in('tipo', ['as_is', 'diagnostico', 'to_be', 'dashboard_brechas'])

        for (const p of previos ?? []) {
          existentes[p.tipo] = p.contenido as Record<string, unknown>
        }
        // También usar los generados en este mismo batch
        Object.assign(existentes, generados)
      }

      const contenido = await generarArtefacto(tipo, ctx, docs, existentes)
      generados[tipo] = contenido

      // generarArtefacto no expone el usage real del completion (su firma
      // retorna solo el contenido parseado) — se estima el output a partir
      // del tamaño del JSON generado. Igual que otras estimaciones de este
      // módulo: sirve para las alertas de límite mensual, no es facturación exacta.
      await registrarUsoIA({
        proyecto_id: proceso.proyecto_id,
        usuario_id: usuarioId,
        tipo: 'generacion',
        tokens_output: Math.ceil(JSON.stringify(contenido).length / 4),
      }).catch(() => {})

      // Upsert en BD (único por proceso_id + tipo)
      const { data: existing } = await admin
        .from('artefacto')
        .select('id, version')
        .eq('proceso_id', proceso_id)
        .eq('tipo', tipo)
        .single()

      if (existing) {
        await admin.from('artefacto').update({
          contenido,
          version: existing.version + 1,
          estado_validacion: 'pendiente',
          generado_por_ia: true,
        }).eq('id', existing.id)
      } else {
        await admin.from('artefacto').insert({
          proceso_id,
          proyecto_id: proceso.proyecto_id,
          tipo,
          contenido,
          estado_validacion: 'pendiente',
          generado_por_ia: true,
        })
      }
    }

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'artefacto',
      entidad_id: proceso_id,
      detalle: { tipos_generados: tipos, proceso_nombre: ctx.nombre },
      usuarioId,
    })

    if (jobId) {
      await admin.from('jobs').update({ estado: 'listo', resultado: { tipos_generados: tipos } }).eq('id', jobId)
    }
  } catch (err) {
    console.error(`[artefactos-generar] Falló job para proceso_id=${proceso_id}:`, err instanceof Error ? err.message : err)
    if (jobId) {
      await admin.from('jobs').update({
        estado: 'error',
        error_mensaje: err instanceof Error ? err.message : String(err),
      }).eq('id', jobId)
    }
  }
}
