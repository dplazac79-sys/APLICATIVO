'use client'

import { useState } from 'react'
import BuscadorSemantico from './BuscadorSemantico'
import { Download, FileText, FileImage, FileSpreadsheet, File, ShieldCheck, User, Lock, Search, X } from 'lucide-react'
import DocumentoAcciones from './DocumentoAcciones'

const ESTADO_CONFIG = {
  pendiente:  { label: 'Procesando IA', class: 'bg-amber-950/60 text-amber-400 border-amber-800/40' },
  procesando: { label: 'Procesando...', class: 'bg-blue-950/60 text-blue-400 border-blue-800/40' },
  listo:      { label: 'Disponible',    class: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' },
  error:      { label: 'Disponible',    class: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' },
} as const

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
  const [busqueda, setBusqueda] = useState('')

  const docsFiltrados = (() => {
    let lista = filtroIds !== null ? documentos.filter(d => filtroIds.includes(d.id)) : documentos
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(d => d.nombre_archivo.toLowerCase().includes(q))
    }
    return lista
  })()

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda simple */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de archivo..."
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-600/50 transition-colors"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <BuscadorSemantico onFiltrar={setFiltroIds} />
        {filtroIds !== null && (
          <button onClick={() => setFiltroIds(null)} className="text-xs text-violet-400 hover:text-violet-300 whitespace-nowrap">
            Quitar filtro
          </button>
        )}
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {filtroIds !== null || busqueda
            ? `${docsFiltrados.length} de ${documentos.length} documento${documentos.length !== 1 ? 's' : ''}`
            : `${documentos.length} documento${documentos.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Lista */}
      {docsFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 py-14 text-center">
          <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {busqueda || filtroIds !== null ? 'Ningún documento coincide.' : 'No hay documentos cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docsFiltrados.map((doc) => {
            const estadoKey = (doc.estado_procesamiento ?? 'pendiente') as keyof typeof ESTADO_CONFIG
            const estadoCfg = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.listo
            const docSubidoPorInterno = ROL_INTERNO.includes(doc.subido_por?.rol ?? '')
            const puedeEliminar = esInterno || !docSubidoPorInterno
            const clasificacion = doc.clasificacion
            const tipoDoc = clasificacion?.tipo_documento as string | undefined

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50 px-4 py-3 transition-colors group"
              >
                {/* Icono */}
                <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                  <FileIcon tipo={doc.tipo} />
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-slate-500 text-xs">{new Date(doc.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {tipoDoc && <span className="text-slate-600 text-xs truncate max-w-48">· {tipoDoc}</span>}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {docSubidoPorInterno ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/40">
                      <ShieldCheck className="w-3 h-3" /> AICOUNTS
                    </span>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/30">
                      <User className="w-3 h-3" /> Cliente
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${estadoCfg.class}`}>
                    {estadoCfg.label}
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0">
                  {doc.signedUrl ? (
                    <a
                      href={doc.signedUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Descargar"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 cursor-not-allowed" title="No disponible">
                      <Download className="w-4 h-4" />
                    </div>
                  )}

                  <DocumentoAcciones
                    documentoId={doc.id}
                    estado={estadoKey as 'pendiente' | 'procesando' | 'listo' | 'error'}
                    puedeEliminar={puedeEliminar}
                  />

                  {!puedeEliminar && (
                    <div className="w-8 h-8 flex items-center justify-center text-slate-700" title="Solo lectura">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
