import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import { registrarAudit } from '@/lib/audit'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'
import { regenerarDocumentoConCambios } from '@/lib/ai/claude'
import { extraerTextoPDF, extraerTextoDOCX } from '@/lib/extract-text'
import { generarVersionDocumentoDocx } from '@/lib/exportar/generarDocx'

// Consolidar una versión ya no es una acción de la consultora sobre un
// documento que ella misma edita a mano — la reescritura la hace la IA a
// partir de las decisiones que el cliente fue registrando en Hallazgos, así
// que cualquier miembro del proyecto (incluido el cliente) puede disparar
// la consolidación. El control de calidad está en que la IA solo aplica lo
// que el cliente explícitamente aceptó, nunca inventa cambios.
const ROLES_AUTORIZADOS = ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente'] as const

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: usuarioActual } = await admin.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuarioActual || !ROLES_AUTORIZADOS.includes(usuarioActual.rol as typeof ROLES_AUTORIZADOS[number])) {
    return NextResponse.json({ error: 'Sin permisos para consolidar una nueva versión' }, { status: 403 })
  }

  const { data: proceso } = await admin
    .from('proceso')
    .select('nombre, codigo, metadata_ia, documento_origen_id, proyecto_id, proyecto:proyecto_id (nombre, cliente:cliente_id (razon_social))')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, proceso.proyecto_id as string))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  const limite = await verificarLimiteIA(proceso.proyecto_id as string, 'generacion')
  if (!limite.permitido) return NextResponse.json({ error: limite.mensaje }, { status: 429 })

  const meta = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const correcciones = (meta.correcciones ?? []) as Array<{
    tipo: string; indice: number; observacion: string; estado: string; fecha: string
    tipoAceptacion?: 'tal_cual' | 'con_observacion'
  }>
  const versionesActuales = (meta.versiones ?? []) as Array<Record<string, unknown>>

  if (!proceso.documento_origen_id) {
    return NextResponse.json({ error: 'Este proceso no tiene un documento de origen para regenerar.' }, { status: 400 })
  }

  const { data: documentoOrigen } = await admin
    .from('documento')
    .select('nombre_archivo, url_storage, analisis_ia')
    .eq('id', proceso.documento_origen_id)
    .single()

  if (!documentoOrigen) return NextResponse.json({ error: 'Documento de origen no encontrado' }, { status: 404 })

  const docAnalisisIA = (documentoOrigen.analisis_ia ?? {}) as Record<string, unknown>

  const LISTAS: Record<string, string> = {
    riesgo: 'riesgos_criticos',
    hallazgo: 'hallazgos_criticos',
    brecha: 'brechas_documentacion',
    rol: 'roles_y_responsabilidades',
  }

  const atendidas = correcciones.filter(c => c.estado === 'atendido')
  if (atendidas.length === 0) {
    return NextResponse.json({ error: 'No hay hallazgos resueltos para consolidar.' }, { status: 400 })
  }

  // Snapshot detallado: tipo + texto original del documento + observación del cliente
  const detalleCorrecciones = atendidas.map(c => {
    const lista = (docAnalisisIA[LISTAS[c.tipo]] ?? []) as Array<unknown>
    const item = lista[c.indice]
    let textoOriginal = ''
    if (typeof item === 'string') textoOriginal = item
    else if (item && typeof item === 'object') {
      const obj = item as Record<string, string>
      textoOriginal = obj.riesgo ?? obj.hallazgo ?? obj.rol ?? obj.nombre ?? JSON.stringify(item)
    }
    return {
      tipo: c.tipo,
      indice: c.indice,
      texto_original: textoOriginal.slice(0, 300),
      observacion: c.observacion,
      tipoAceptacion: c.tipoAceptacion ?? 'con_observacion' as const,
      fecha: c.fecha,
    }
  })

  // Re-extraer el texto del documento original desde Storage — el texto
  // crudo no se conserva en la base de datos tras el procesamiento inicial
  // (solo el resumen/análisis), así que se vuelve a leer el archivo real.
  const { data: fileData, error: errorDescarga } = await admin.storage.from('documentos').download(documentoOrigen.url_storage)
  if (errorDescarga || !fileData) {
    return NextResponse.json({ error: 'No se pudo leer el documento original desde Storage.' }, { status: 500 })
  }
  const buffer = Buffer.from(await fileData.arrayBuffer())
  const nombreArchivo = documentoOrigen.nombre_archivo.toLowerCase()
  const textoOriginal = nombreArchivo.endsWith('.docx') || nombreArchivo.endsWith('.doc')
    ? await extraerTextoDOCX(buffer)
    : nombreArchivo.endsWith('.pdf')
    ? await extraerTextoPDF(buffer)
    : await fileData.text()

  if (!textoOriginal?.trim()) {
    return NextResponse.json({ error: 'No se pudo extraer el contenido del documento original.' }, { status: 500 })
  }

  let regenerado
  try {
    regenerado = await regenerarDocumentoConCambios(
      textoOriginal,
      detalleCorrecciones.map(c => ({
        tipo: c.tipo, texto_original: c.texto_original, observacion: c.observacion, tipoAceptacion: c.tipoAceptacion,
      })),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al regenerar el documento con IA'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await registrarUsoIA({ proyecto_id: proceso.proyecto_id as string, usuario_id: user.id, tipo: 'generacion', tokens_input: 10000, tokens_output: 3000 })

  const maxNumero = versionesActuales.reduce((max, v) => Math.max(max, (v as Record<string, unknown>).numero as number ?? 0), 0)
  const numeroNuevaVersion = Math.max(versionesActuales.length === 0 ? 2 : maxNumero + 1, 2)

  const proyectoInfo = proceso.proyecto as unknown as { nombre: string; cliente: { razon_social: string } | null } | null
  const codigo = proceso.codigo ?? documentoOrigen.nombre_archivo.replace(/\.[^.]+$/, '').toUpperCase()

  // Aplica cada reemplazo devuelto por la IA sobre el texto real del
  // documento — la IA nunca escribe el documento completo, solo indica qué
  // fragmento exacto buscar y por qué reemplazarlo. Si el fragmento no
  // aparece literalmente (la IA parafraseó en vez de copiar textual), el
  // cambio queda marcado como no aplicado automáticamente en el registro,
  // en vez de fallar silenciosamente o corromper el documento.
  let textoActualizado = textoOriginal
  const cambiosConEstado = (regenerado.cambios_aplicados ?? []).map(c => {
    if (!c.buscar) return { ...c, aplicado: true as const } // "aceptado tal cual" — sin cambio de texto
    if (textoActualizado.includes(c.buscar)) {
      textoActualizado = textoActualizado.replace(c.buscar, c.reemplazar_por)
      return { ...c, aplicado: true as const }
    }
    return { ...c, aplicado: false as const }
  })

  const docxBuffer = await generarVersionDocumentoDocx({
    codigo,
    nombre: proceso.nombre,
    numero: numeroNuevaVersion,
    proyecto: proyectoInfo?.cliente?.razon_social ? `${proyectoInfo.cliente.razon_social} — ${proyectoInfo.nombre}` : (proyectoInfo?.nombre ?? 'Proyecto'),
    fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
    textoCompleto: textoActualizado,
    cambiosAplicados: cambiosConEstado,
    resumenCambios: regenerado.resumen_cambios ?? '',
  })

  const pathStorage = `${proceso.proyecto_id}/versiones/${params.id}-v${numeroNuevaVersion}.docx`
  const { error: errorUpload } = await admin.storage.from('documentos').upload(pathStorage, docxBuffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  })
  if (errorUpload) {
    return NextResponse.json({ error: `No se pudo guardar el documento generado: ${errorUpload.message}` }, { status: 500 })
  }

  const nuevaVersion = {
    numero: numeroNuevaVersion,
    fecha: new Date().toISOString(),
    correcciones_aplicadas: atendidas.length,
    descripcion: regenerado.resumen_cambios || 'Nueva versión generada por IA',
    detalle_correcciones: detalleCorrecciones,
    cambios_aplicados: cambiosConEstado,
    documento_id: proceso.documento_origen_id ?? null,
    url_storage_version: pathStorage,
    generado_por_ia: true,
  }

  const correccionesArchivadas = correcciones.map(c =>
    c.estado === 'atendido' ? { ...c, estado: 'archivado' } : c
  )

  const versionesNuevas = versionesActuales.length === 0
    ? [
        { numero: 1, fecha: (meta.fecha_creacion as string) ?? new Date().toISOString(), correcciones_aplicadas: 0, descripcion: 'Versión inicial', detalle_correcciones: [], documento_id: proceso.documento_origen_id ?? null },
        nuevaVersion,
      ]
    : [...versionesActuales, nuevaVersion]

  const { error } = await admin
    .from('proceso')
    .update({
      metadata_ia: {
        ...meta,
        correcciones: correccionesArchivadas,
        versiones: versionesNuevas,
        version_actual: nuevaVersion.numero,
      },
    })
    .eq('id', params.id)

  if (error) return jsonError(error)

  await admin.from('proceso_historial').insert({
    proceso_id: params.id,
    proyecto_id: proceso.proyecto_id,
    version: nuevaVersion.numero,
    tipo_cambio: 'nueva_version',
    descripcion: `Nueva versión v${nuevaVersion.numero} generada por IA: ${nuevaVersion.descripcion}`,
    detalle: { correcciones_aplicadas: atendidas.length, detalle_correcciones: detalleCorrecciones },
    modificado_por: user.id,
  }).then(() => null, () => null)

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'proceso',
    entidad_id: params.id,
    detalle: { accion_detalle: 'version_regenerada_ia', version: nuevaVersion.numero },
    usuarioId: user.id,
  })

  return NextResponse.json({ ok: true, version: nuevaVersion, versiones: versionesNuevas })
}
