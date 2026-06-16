import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, FileImage, FileSpreadsheet, File, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import DocumentUploader from '@/components/documentos/DocumentUploader'
import DocumentoAcciones from '@/components/documentos/DocumentoAcciones'
import type { Documento } from '@/types/database'

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', class: 'bg-amber-950 text-amber-400 border-amber-800' },
  procesando: { label: 'Procesando...', class: 'bg-blue-950 text-blue-400 border-blue-800' },
  listo: { label: 'Procesado', class: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
  error: { label: 'Error', class: 'bg-red-950 text-red-400 border-red-800' },
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

function FileIcon({ tipo }: { tipo: string | null }) {
  if (tipo === 'pdf') return <FileText className="w-4 h-4 text-red-400" />
  if (tipo === 'xlsx') return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
  if (tipo === 'imagen') return <FileImage className="w-4 h-4 text-blue-400" />
  return <File className="w-4 h-4 text-slate-400" />
}

export const dynamic = 'force-dynamic'

export default async function DocumentosPage() {
  const admin = createAdminClient()

  const { data: proyectosRaw } = await admin
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')

  const proyectos = (proyectosRaw ?? []).map(p => ({
    id: p.id as string,
    nombre: p.nombre as string,
    cliente: Array.isArray(p.cliente) ? (p.cliente[0] ?? null) : p.cliente,
  }))

  const { data: documentos } = await admin
    .from('documento')
    .select('*, proyecto(nombre)')
    .order('created_at', { ascending: false })

  type DocConProyecto = Documento & { proyecto: { nombre: string } | null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Centro Documental</h1>
        <p className="text-slate-400 text-sm mt-1">M2 — Ingesta y análisis IA de documentos</p>
      </div>

      <DocumentUploader proyectos={proyectos} />

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
          const estado = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.pendiente
          const clasificacion = doc.clasificacion as Record<string, unknown> | null
          const bloque = clasificacion?.bloque as string | undefined
          const industria = clasificacion?.industria_detectada as string | undefined
          const tipoDoc = clasificacion?.tipo_documento as string | undefined
          const brechas = clasificacion ? null : null
          // resumen puede tener campos extendidos
          const resumenData = doc.resumen_ejecutivo ? (() => {
            try { return JSON.parse(doc.resumen_ejecutivo ?? '{}') } catch { return null }
          })() : null
          const resumenTexto = typeof doc.resumen_ejecutivo === 'string' && !doc.resumen_ejecutivo.startsWith('{')
            ? doc.resumen_ejecutivo
            : resumenData?.resumen_ejecutivo ?? null

          return (
            <Card key={doc.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <FileIcon tipo={doc.tipo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {doc.proyecto?.nombre ?? 'Sin proyecto'} · {new Date(doc.created_at).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {industria && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                        {industria}
                      </span>
                    )}
                    {bloque && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-indigo-950 text-indigo-300 border-indigo-800">
                        {BLOQUE_LABELS[bloque] ?? bloque}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${estado.class}`}>
                      {estado.label}
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

                <div className="pl-12 flex items-center gap-3">
                  <DocumentoAcciones documentoId={doc.id} estado={estadoKey} />
                  {estadoKey === 'listo' && (
                    <Link
                      href={`/documentos/${doc.id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver análisis completo
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
