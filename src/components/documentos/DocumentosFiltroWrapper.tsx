'use client'

import { useState } from 'react'
import BuscadorSemantico from './BuscadorSemantico'
import { Download, FileText, FileImage, FileSpreadsheet, File, ShieldCheck, User, Lock, Search, X, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from 'lucide-react'
import DocumentoAcciones from './DocumentoAcciones'

const ESTADO_CONFIG = {
  pendiente:  { label: 'Procesando IA', class: 'bg-amber-950/60 text-amber-400 border-amber-800/40' },
  procesando: { label: 'Procesando...',  class: 'bg-blue-950/60 text-blue-400 border-blue-800/40' },
  listo:      { label: 'Disponible',     class: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' },
  error:      { label: 'Error al procesar', class: 'bg-red-950/60 text-red-400 border-red-800/40' },
} as const

// Un documento que lleva demasiado tiempo en 'pendiente'/'procesando' probablemente
// se quedó atascado — el procesamiento normal toma minutos, no horas.
const HORAS_ANTES_DE_CONSIDERAR_ATASCADO = 6
function estaAtascado(estado: string, fechaCreacion: string): boolean {
  if (estado !== 'pendiente' && estado !== 'procesando') return false
  const horas = (Date.now() - new Date(fechaCreacion).getTime()) / (1000 * 60 * 60)
  return horas > HORAS_ANTES_DE_CONSIDERAR_ATASCADO
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
  proyectoId: string | null
}

function DocFila({
  doc,
  esInterno,
  isVersion = false,
  onEliminado,
}: {
  doc: DocRow
  esInterno: boolean
  isVersion?: boolean
  onEliminado: (id: string) => void
}) {
  const estadoKey = (doc.estado_procesamiento ?? 'pendiente') as keyof typeof ESTADO_CONFIG
  const estadoCfg = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.listo
  const atascado = estaAtascado(estadoKey, doc.created_at)
  const docSubidoPorInterno = ROL_INTERNO.includes(doc.subido_por?.rol ?? '')
  const puedeEliminar = esInterno || !docSubidoPorInterno
  const clasificacion = doc.clasificacion ?? {}
  const tipoDoc = clasificacion.tipo_documento as string | undefined
  const versionNum = clasificacion.version_numero as number | undefined

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors group ${
      isVersion
        ? 'border-violet-800/20 bg-violet-950/10 hover:bg-violet-950/20'
        : 'border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50'
    }`}>
      {isVersion && <div className="w-px h-6 bg-violet-700/40 shrink-0" />}

      <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
        <FileIcon tipo={doc.tipo} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
          {versionNum && (
            <span className="text-xs bg-violet-900/50 text-violet-300 border border-violet-700/40 px-1.5 py-0.5 rounded font-bold shrink-0">
              v{versionNum}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-slate-400 text-xs">{new Date(doc.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {tipoDoc && <span className="text-slate-400 text-xs truncate max-w-48">· {tipoDoc}</span>}
        </div>
      </div>

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
        {atascado ? (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-rose-950/60 text-rose-400 border-rose-800/40" title="Lleva más de 6 horas en este estado — probablemente se atascó">
            <AlertTriangle className="w-3 h-3" /> Posible error — tarda mucho
          </span>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${estadoCfg.class}`}>
            {estadoCfg.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {doc.signedUrl ? (
          <a href={doc.signedUrl} download target="_blank" rel="noopener noreferrer" title="Descargar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors">
            <Download className="w-4 h-4" />
          </a>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center text-slate-400 cursor-not-allowed" title="No disponible">
            <Download className="w-4 h-4" />
          </div>
        )}
        <DocumentoAcciones documentoId={doc.id} estado={estadoKey} puedeEliminar={puedeEliminar} puedeAnalizar={esInterno} onEliminado={() => onEliminado(doc.id)} />
        {!puedeEliminar && (
          <div className="w-8 h-8 flex items-center justify-center text-slate-400" title="Solo lectura">
            <Lock className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function DocumentosFiltroWrapper({ documentos: documentosIniciales, esInterno, rolActual: _rolActual, proyectoId }: Props) {
  // Estado local en vez de usar la prop directo — permite quitar una fila al
  // eliminar sin recargar toda la página (ver DocumentoAcciones.onEliminado).
  const [documentos, setDocumentos] = useState(documentosIniciales)
  const [filtroIds, setFiltroIds] = useState<string[] | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  function eliminarDeLaLista(id: string) {
    setDocumentos(prev => prev.filter(d => d.id !== id))
  }

  // Agrupar: padre → [versiones]
  const padresMap = new Map<string, DocRow[]>()
  const versiones = new Map<string, DocRow>()

  for (const doc of documentos) {
    const padreId = doc.clasificacion?.documento_padre_id as string | undefined
    if (padreId) {
      versiones.set(doc.id, doc)
      if (!padresMap.has(padreId)) padresMap.set(padreId, [])
      padresMap.get(padreId)!.push(doc)
    }
  }

  // Solo mostrar padres (documentos raíz) en la lista principal
  const docsRaiz = documentos.filter(d => !versiones.has(d.id))

  const docsFiltrados = (() => {
    let lista = filtroIds !== null ? docsRaiz.filter(d => filtroIds.includes(d.id)) : docsRaiz
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(d => d.nombre_archivo.toLowerCase().includes(q))
    }
    return lista
  })()

  function toggleExpandido(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalVisible = docsFiltrados.length
  const totalReal = docsRaiz.length

  return (
    <div className="space-y-4">
      {/* Filtro rápido por nombre */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Filtrar por nombre de archivo..."
          aria-label="Filtrar por nombre de archivo"
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500/60 transition-colors"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300" aria-label="Limpiar filtro">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Búsqueda semántica con IA — herramienta distinta, no un segundo filtro */}
      <div className="space-y-1.5">
        <BuscadorSemantico onFiltrar={setFiltroIds} proyectoId={proyectoId} />
        {filtroIds !== null && (
          <button onClick={() => setFiltroIds(null)} className="text-xs text-violet-400 hover:text-violet-300">
            Quitar filtro de búsqueda IA
          </button>
        )}
      </div>

      {/* Contador */}
      <div className="text-xs text-slate-400">
        {filtroIds !== null || busqueda
          ? `${totalVisible} de ${totalReal} documento${totalReal !== 1 ? 's' : ''}`
          : `${totalReal} documento${totalReal !== 1 ? 's' : ''}`}
        {padresMap.size > 0 && (
          <span className="ml-2 text-violet-400">
            · <RefreshCw className="w-3 h-3 inline" /> {padresMap.size} con versiones anteriores
          </span>
        )}
      </div>

      {/* Lista */}
      {docsFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 py-14 text-center">
          <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {busqueda || filtroIds !== null ? 'Ningún documento coincide.' : 'No hay documentos cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docsFiltrados.map(doc => {
            const hijos = padresMap.get(doc.id) ?? []
            const tieneVersiones = hijos.length > 0
            const abierto = expandidos.has(doc.id)

            return (
              <div key={doc.id} className="space-y-1">
                {/* Fila principal */}
                <div className="relative">
                  <DocFila doc={doc} esInterno={esInterno} onEliminado={eliminarDeLaLista} />
                  {tieneVersiones && (
                    <button
                      onClick={() => toggleExpandido(doc.id)}
                      className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 bg-violet-950/40 border border-violet-800/30 px-2 py-1 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {hijos.length} versión{hijos.length !== 1 ? 'es' : ''}
                      {abierto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Versiones anteriores */}
                {tieneVersiones && abierto && (
                  <div className="pl-4 space-y-1">
                    <p className="text-xs text-slate-400 uppercase tracking-widest px-1 mb-1">Versiones anteriores</p>
                    {[...hijos].sort((a, b) =>
                      ((b.clasificacion?.version_numero as number) ?? 0) - ((a.clasificacion?.version_numero as number) ?? 0)
                    ).map(v => (
                      <DocFila key={v.id} doc={v} esInterno={esInterno} isVersion onEliminado={eliminarDeLaLista} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
