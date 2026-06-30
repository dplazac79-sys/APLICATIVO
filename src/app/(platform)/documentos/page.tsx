import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, FileImage, FileSpreadsheet, File, ExternalLink, Download, ShieldCheck, User } from 'lucide-react'
import Link from 'next/link'
import DocumentUploader from '@/components/documentos/DocumentUploader'
import DocumentoAcciones from '@/components/documentos/DocumentoAcciones'
import BuscadorSemantico from '@/components/documentos/BuscadorSemantico'
import type { Documento } from '@/types/database'

export const dynamic = 'force-dynamic'

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente IA', labelCliente: 'Disponible', class: 'bg-amber-950 text-amber-400 border-amber-800', classCliente: 'bg-slate-800 text-slate-400 border-slate-700' },
  procesando: { label: 'Procesando...', labelCliente: 'Procesando...', class: 'bg-blue-950 text-blue-400 border-blue-800', classCliente: 'bg-blue-950 text-blue-400 border-blue-800' },
  listo: { label: 'Procesado', labelCliente: 'Disponible', class: 'bg-emerald-950 text-emerald-400 border-emerald-800', classCliente: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
  error: { label: 'Error', labelCliente: 'Disponible', class: 'bg-red-950 text-red-400 border-red-800', classCliente: 'bg-slate-800 text-slate-400 border-slate-700' },
} as const

const BLOQUE_LABELS: Record<string, string> = {
  estrategico: 'Estratégico',
  procesos: 'Procesos',
  riesgos: 'Riesgos',
  financiero: 'Financiero',
  rrhh: 'RRHH',
  tecnologia: 'Tecnología',
  legal_normativo: 'Legal/Normativo',
  comercial: 'Comercial',
  otro: 'Otro',
}

const ROL_INTERNO = ['super_admin', 'director_proyecto', 'consultor']

function FileIcon({ tipo }: { tipo: string | null }) {
  if (tipo === 'pdf') return <FileText className="w-4 h-4 text-red-400" />
  if (tipo === 'xlsx') return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
  if (tipo === 'imagen') return <FileImage className="w-4 h-4 text-blue-400" />
  return <File className="w-4 h-4 text-slate-400" />
}

export default async function DocumentosPage({ searchParams }: { searchParams: { proyecto_id?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuario } = await supabase
    .from('usuario')
    .select('rol')
    .eq('id', user!.id)
    .single()

  const rolActual = usuario?.rol ?? 'usuario_cliente'
  const esInterno = ROL_INTERNO.includes(rolActual)
  const esCliente = !esInterno

  const admin = createAdminClient()
  const proyectoFiltro = searchParams.proyecto_id ?? null

  const { data: proyectosRaw } = await admin
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')

  const proyectos = (proyectosRaw ?? []).map(p => ({
    id: p.id as string,
    nombre: p.nombre as string,
    cliente: Array.isArray(p.cliente) ? (p.cliente[0] ?? null) : p.cliente,
  }))

  const proyectoActivo = proyectoFiltro ? proyectos.find(p => p.id === proyectoFiltro) : null

  // Traer documentos incluyendo subido_por para resolver permisos
  let query = admin
    .from('documento')
    .select('*, proyecto(nombre), subido_por:subido_por(rol)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (proyectoFiltro) query = query.eq('proyecto_id', proyectoFiltro)

  const { data: documentosRaw } = await query

  // Generar URLs firmadas (1 hora) para todos los documentos
  const documentos = await Promise.all(
    (documentosRaw ?? []).map(async (doc) => {
      const { data: signed } = await admin.storage
        .from('documentos')
        .createSignedUrl(doc.url_storage, 3600)
      return { ...doc, signedUrl: signed?.signedUrl ?? null }
    })
  )

  type DocConProyecto = Documento & {
    proyecto: { nombre: string } | null
    subido_por: { rol: string } | null
    signedUrl: string | null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro Documental</h1>
          {proyectoActivo ? (
            <p className="text-slate-400 text-sm mt-1">
              Proyecto: <span className="text-indigo-300 font-medium">{proyectoActivo.nombre}</span>
              {(proyectoActivo.cliente as any)?.razon_social && (
                <> · <span className="text-slate-300">{(proyectoActivo.cliente as any).razon_social}</span></>
              )}
            </p>
          ) : (
            <p className="text-slate-400 text-sm mt-1">Ingesta, búsqueda y análisis IA de documentos</p>
          )}
        </div>
        {proyectoFiltro && (
          <a href="/documentos" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1">
            Ver todos los proyectos →
          </a>
        )}
      </div>

      {/* Solo roles internos y sponsor_cliente pueden subir documentos */}
      {(esInterno || rolActual === 'sponsor_cliente') && (
        <DocumentUploader proyectos={proyectos} proyectoPreseleccionado={proyectoFiltro} />
      )}

      <BuscadorSemantico />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Documentos cargados ({documentos?.length ?? 0})
        </h2>

        {documentos?.length === 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No hay documentos cargados aún.</p>
            </CardContent>
          </Card>
        )}

        {(documentos as DocConProyecto[] ?? []).map((doc) => {
          const estadoKey = (doc.estado_procesamiento ?? 'pendiente') as keyof typeof ESTADO_CONFIG
          const estadoCfg = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.pendiente
          const estadoLabel = esCliente ? estadoCfg.labelCliente : estadoCfg.label
          const estadoClass = esCliente ? estadoCfg.classCliente : estadoCfg.class
          const clasificacion = doc.clasificacion as Record<string, unknown> | null
          const bloque = clasificacion?.bloque as string | undefined
          const industria = clasificacion?.industria_detectada as string | undefined
          const tipoDoc = clasificacion?.tipo_documento as string | undefined

          const resumenData = doc.resumen_ejecutivo ? (() => {
            try { return JSON.parse(doc.resumen_ejecutivo ?? '{}') } catch { return null }
          })() : null
          const resumenTexto = typeof doc.resumen_ejecutivo === 'string' && !doc.resumen_ejecutivo.startsWith('{')
            ? doc.resumen_ejecutivo
            : resumenData?.resumen_ejecutivo ?? null

          // El doc fue subido por un rol interno → cliente no puede eliminar ni analizar
          const docSubidoPorInterno = ROL_INTERNO.includes(doc.subido_por?.rol ?? '')
          const puedeEliminar = esInterno || (!docSubidoPorInterno)
          const puedeAnalizar = esInterno || (!docSubidoPorInterno)

          // Estilo visual según quién subió el documento
          const cardStyle = docSubidoPorInterno
            ? 'bg-indigo-950/20 border-indigo-800/50 hover:border-indigo-700/60'
            : 'bg-emerald-950/15 border-emerald-800/40 hover:border-emerald-700/50'
          const iconBg = docSubidoPorInterno ? 'bg-indigo-900/50' : 'bg-emerald-900/40'
          const stripColor = docSubidoPorInterno ? 'bg-indigo-600' : 'bg-emerald-500'

          return (
            <Card key={doc.id} className={`border transition-colors overflow-hidden ${cardStyle}`}>
              <CardContent className="p-0">
                {/* Franja de color lateral que identifica el origen */}
                <div className="flex">
                  <div className={`w-1 shrink-0 ${stripColor}`} />
                  <div className="flex-1 p-4 space-y-3">

                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                        <FileIcon tipo={doc.tipo} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-slate-500 text-xs">
                            {doc.proyecto?.nombre ?? 'Sin proyecto'} · {new Date(doc.created_at).toLocaleDateString('es-CL')}
                          </span>
                          {/* Badge de origen — quién subió el doc */}
                          {docSubidoPorInterno ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                              <ShieldCheck className="w-3 h-3" />
                              AICOUNTS Consultores
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
                              <User className="w-3 h-3" />
                              Subido por cliente
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {industria && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                            {industria}
                          </span>
                        )}
                        {bloque && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-800/80 text-slate-300 border-slate-700">
                            {BLOQUE_LABELS[bloque] ?? bloque}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${estadoClass}`}>
                          {estadoLabel}
                        </span>
                      </div>
                    </div>

                {tipoDoc && (
                  <p className="text-slate-500 text-xs pl-12 italic">{tipoDoc}</p>
                )}

                {resumenTexto && (
                  <div className="pl-12 border-t border-slate-800 pt-3 space-y-2">
                    <p className="text-slate-300 text-xs leading-relaxed">{resumenTexto}</p>
                    {resumenData?.recomendacion_prioritaria && (
                      <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg px-3 py-2">
                        <p className="text-indigo-300 text-xs font-medium mb-0.5">Recomendación prioritaria</p>
                        <p className="text-slate-300 text-xs">{resumenData.recomendacion_prioritaria}</p>
                      </div>
                    )}
                    {resumenData?.brechas_criticas?.length > 0 && (
                      <div>
                        <p className="text-amber-400 text-xs font-medium mb-1">Brechas críticas detectadas</p>
                        <ul className="space-y-0.5">
                          {resumenData.brechas_criticas.slice(0, 2).map((b: string, i: number) => (
                            <li key={i} className="text-slate-400 text-xs flex gap-1.5">
                              <span className="text-amber-500 shrink-0">·</span>{b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {resumenData?.nivel_madurez_estimado && (
                      <p className="text-slate-500 text-xs">
                        Madurez estimada: <span className="text-slate-300 capitalize">{resumenData.nivel_madurez_estimado}</span>
                        {resumenData.nivel_madurez_justificacion && ` — ${resumenData.nivel_madurez_justificacion}`}
                      </p>
                    )}
                  </div>
                )}

                <div className="pl-12 flex items-center gap-3 flex-wrap">
                  {/* Ver / descargar el archivo original — disponible para todos */}
                  {doc.signedUrl ? (
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Ver documento
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-800/40 border border-slate-800 px-3 py-1.5 rounded-lg cursor-not-allowed">
                      <Download className="w-3.5 h-3.5" />
                      No disponible
                    </span>
                  )}

                  <DocumentoAcciones
                    documentoId={doc.id}
                    estado={estadoKey}
                    puedeEliminar={puedeEliminar}
                    puedeAnalizar={puedeAnalizar}
                  />

                  {estadoKey === 'listo' && !esCliente && (
                    <Link
                      href={`/documentos/${doc.id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver análisis completo
                    </Link>
                  )}
                </div>

                  </div>{/* fin flex-1 p-4 */}
                </div>{/* fin flex franja+contenido */}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
