'use client'

import { useState } from 'react'
import BuscadorSemantico from './BuscadorSemantico'
import { Download, FileText, FileImage, FileSpreadsheet, File, ExternalLink, ShieldCheck, User, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import DocumentoAcciones from './DocumentoAcciones'
import Link from 'next/link'

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente IA', labelCliente: 'Disponible', class: 'bg-amber-950 text-amber-400 border-amber-800', classCliente: 'bg-slate-800 text-slate-400 border-slate-700' },
  procesando: { label: 'Procesando...', labelCliente: 'Procesando...', class: 'bg-blue-950 text-blue-400 border-blue-800', classCliente: 'bg-blue-950 text-blue-400 border-blue-800' },
  listo: { label: 'Procesado', labelCliente: 'Disponible', class: 'bg-emerald-950 text-emerald-400 border-emerald-800', classCliente: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
  error: { label: 'Error', labelCliente: 'Disponible', class: 'bg-red-950 text-red-400 border-red-800', classCliente: 'bg-slate-800 text-slate-400 border-slate-700' },
} as const

const BLOQUE_LABELS: Record<string, string> = {
  estrategico: 'Estratégico', procesos: 'Procesos', riesgos: 'Riesgos',
  financiero: 'Financiero', rrhh: 'RRHH', tecnologia: 'Tecnología',
  legal_normativo: 'Legal/Normativo', comercial: 'Comercial', otro: 'Otro',
}

const ROL_INTERNO = ['super_admin', 'director_proyecto', 'consultor']

function FileIcon({ tipo }: { tipo: string | null }) {
  if (tipo === 'pdf') return <FileText className="w-4 h-4 text-red-400" />
  if (tipo === 'xlsx') return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
  if (tipo === 'imagen') return <FileImage className="w-4 h-4 text-blue-400" />
  return <File className="w-4 h-4 text-slate-400" />
}

export interface DocRow {
  id: string
  nombre_archivo: string
  tipo: string | null
  url_storage: string
  signedUrl: string | null
  estado_procesamiento: string
  clasificacion: Record<string, unknown> | null
  resumen_ejecutivo: string | null
  created_at: string
  proyecto: { nombre: string } | null
  subido_por: { rol: string } | null
}

interface Props {
  documentos: DocRow[]
  esInterno: boolean
  rolActual: string
}

export default function DocumentosFiltroWrapper({ documentos, esInterno, rolActual }: Props) {
  const esCliente = !esInterno
  const [filtroIds, setFiltroIds] = useState<string[] | null>(null)

  const docsFiltrados = filtroIds === null
    ? documentos
    : documentos.filter(d => filtroIds.includes(d.id))

  return (
    <>
      <BuscadorSemantico onFiltrar={setFiltroIds} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Documentos cargados ({filtroIds === null ? documentos.length : `${docsFiltrados.length} de ${documentos.length}`})
          </h2>
          {filtroIds !== null && (
            <button
              onClick={() => setFiltroIds(null)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Mostrar todos →
            </button>
          )}
        </div>

        {docsFiltrados.length === 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">
                {filtroIds !== null ? 'Ningún documento coincide con la búsqueda.' : 'No hay documentos cargados aún.'}
              </p>
            </CardContent>
          </Card>
        )}

        {docsFiltrados.map((doc) => {
          const estadoKey = (doc.estado_procesamiento ?? 'pendiente') as keyof typeof ESTADO_CONFIG
          const estadoCfg = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.pendiente
          const estadoLabel = esCliente ? estadoCfg.labelCliente : estadoCfg.label
          const estadoClass = esCliente ? estadoCfg.classCliente : estadoCfg.class
          const clasificacion = doc.clasificacion
          const bloque = clasificacion?.bloque as string | undefined
          const industria = clasificacion?.industria_detectada as string | undefined
          const tipoDoc = clasificacion?.tipo_documento as string | undefined

          const resumenData = doc.resumen_ejecutivo ? (() => {
            try { return JSON.parse(doc.resumen_ejecutivo ?? '{}') } catch { return null }
          })() : null
          const resumenTexto = typeof doc.resumen_ejecutivo === 'string' && !doc.resumen_ejecutivo.startsWith('{')
            ? doc.resumen_ejecutivo
            : resumenData?.resumen_ejecutivo ?? null

          const docSubidoPorInterno = ROL_INTERNO.includes(doc.subido_por?.rol ?? '')
          const puedeEliminar = esInterno || !docSubidoPorInterno

          const cardStyle = docSubidoPorInterno
            ? 'bg-indigo-950/20 border-indigo-800/50 hover:border-indigo-700/60'
            : 'bg-emerald-950/15 border-emerald-800/40 hover:border-emerald-700/50'
          const iconBg = docSubidoPorInterno ? 'bg-indigo-900/50' : 'bg-emerald-900/40'
          const stripColor = docSubidoPorInterno ? 'bg-indigo-600' : 'bg-emerald-500'

          // Resaltar si está en el filtro activo
          const resaltado = filtroIds !== null && filtroIds.includes(doc.id)

          return (
            <Card
              key={doc.id}
              id={`doc-${doc.id}`}
              className={`border transition-all overflow-hidden ${cardStyle} ${resaltado ? 'ring-2 ring-indigo-500/60' : ''}`}
            >
              <CardContent className="p-0">
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
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">{industria}</span>
                        )}
                        {bloque && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-800/80 text-slate-300 border-slate-700">{BLOQUE_LABELS[bloque] ?? bloque}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${estadoClass}`}>{estadoLabel}</span>
                      </div>
                    </div>

                    {tipoDoc && <p className="text-slate-500 text-xs pl-12 italic">{tipoDoc}</p>}

                    {resumenTexto && (
                      <div className="pl-12 border-t border-slate-800/60 pt-3 space-y-2">
                        <p className="text-slate-300 text-xs leading-relaxed">{resumenTexto}</p>
                        {resumenData?.recomendacion_prioritaria && (
                          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg px-3 py-2">
                            <p className="text-indigo-300 text-xs font-medium mb-0.5">Recomendación prioritaria</p>
                            <p className="text-slate-300 text-xs">{resumenData.recomendacion_prioritaria}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pl-12 flex items-center gap-3 flex-wrap">
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
                        estado={estadoKey as 'pendiente' | 'procesando' | 'listo' | 'error'}
                        puedeEliminar={puedeEliminar}
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

                      {!puedeEliminar && (
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Lock className="w-3 h-3" /> Solo lectura
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
