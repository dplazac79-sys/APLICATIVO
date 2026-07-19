'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, AlertTriangle, ArrowUpRight, Search, Filter } from 'lucide-react'
import type { Proceso, Artefacto } from '@/types/database'
import { ORDEN_GENERACION } from '@/lib/artefactos-meta'

const NIVEL_CONFIG = [
  { label: 'Macroproceso', color: 'text-violet-400',  dot: 'bg-violet-500',  bg: 'bg-violet-950/20 border-violet-800/30 hover:border-violet-600/50' },
  { label: 'Proceso',      color: 'text-blue-400',    dot: 'bg-blue-500',    bg: 'bg-blue-950/20 border-blue-800/30 hover:border-blue-600/50' },
  { label: 'Subproceso',   color: 'text-cyan-400',    dot: 'bg-cyan-500',    bg: 'bg-cyan-950/20 border-cyan-800/30 hover:border-cyan-600/50' },
  { label: 'Actividad',    color: 'text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-950/20 border-emerald-800/30 hover:border-emerald-600/50' },
  { label: 'Tarea',        color: 'text-slate-400',   dot: 'bg-slate-500',   bg: 'bg-slate-800/20 border-slate-700/30 hover:border-slate-600/50' },
]

type ProcesoConDoc = Proceso & { documento_origen?: { nombre_archivo: string } | null }
type ArtefactoResumen = Pick<Artefacto, 'proceso_id' | 'tipo' | 'estado_validacion' | 'version' | 'generado_por_ia'>

function derivarCodigo(p: ProcesoConDoc, lista: Proceso[]): string | null {
  const docNombre = p.documento_origen?.nombre_archivo
  if (docNombre) {
    const match = docNombre.match(/^([A-Za-z]{1,6}[0-9]{1,3})/i)
    if (match) return match[1].toUpperCase()
  }
  if (p.padre_id) {
    const padre = lista.find(x => x.id === p.padre_id)
    if (padre) {
      const siglas = padre.nombre
        .split(' ')
        .filter(w => w.length > 2)
        .map(w => w[0].toUpperCase())
        .join('')
        .slice(0, 3)
      return `${siglas}${String(p.orden).padStart(2, '0')}`
    }
  }
  return null
}

interface Props {
  procesos: Proceso[]
  artefactosPorProceso: Record<string, ArtefactoResumen[]>
  esSuperAdmin: boolean
}

export default function ArbolProcesosArtefactos({ procesos, artefactosPorProceso, esSuperAdmin }: Props) {
  const [query, setQuery] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)

  const q = query.trim().toLowerCase()

  // Coincidencia de un nodo individual — por nombre o código derivado.
  const coincide = (p: ProcesoConDoc): boolean => {
    if (!q) return true
    const codigo = derivarCodigo(p, procesos)
    return p.nombre.toLowerCase().includes(q) || (codigo?.toLowerCase().includes(q) ?? false)
  }

  const tienePendientes = (p: Proceso): boolean =>
    (artefactosPorProceso[p.id] ?? []).some(a => a.estado_validacion === 'pendiente')

  // Un subárbol se conserva si él mismo o cualquier descendiente cumple los
  // filtros activos — así una búsqueda por un proceso hijo no lo deja
  // huérfano sin su macroproceso, y "solo pendientes" no oculta el padre de
  // un proceso que sí tiene algo por revisar.
  const subarbolVisible = useMemo(() => {
    const cache = new Map<string, boolean>()
    function visible(p: Proceso): boolean {
      if (cache.has(p.id)) return cache.get(p.id)!
      const hijos = procesos.filter(x => x.padre_id === p.id)
      const propioOk = coincide(p as ProcesoConDoc) && (!soloPendientes || tienePendientes(p))
      const algunHijoVisible = hijos.some(h => visible(h))
      const resultado = propioOk || algunHijoVisible
      cache.set(p.id, resultado)
      return resultado
    }
    procesos.forEach(visible)
    return cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesos, artefactosPorProceso, q, soloPendientes])

  function renderArbol(padreId: string | null, nivel: number): React.ReactNode {
    const hijos = procesos.filter(p => p.padre_id === padreId && subarbolVisible.get(p.id))
    if (!hijos.length) return null
    const hijosOrdenados = [...hijos].sort((a, b) => {
      const ca = derivarCodigo(a as ProcesoConDoc, procesos) ?? ''
      const cb = derivarCodigo(b as ProcesoConDoc, procesos) ?? ''
      const na = parseInt(ca.replace(/\D/g, '') || '999', 10)
      const nb = parseInt(cb.replace(/\D/g, '') || '999', 10)
      if (na !== nb) return na - nb
      return ca.localeCompare(cb)
    })
    return hijosOrdenados.map(p => {
      const cfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG[4]
      const arts = artefactosPorProceso[p.id] ?? []
      const total = ORDEN_GENERACION.length
      const generados = arts.length
      const publicados = arts.filter(a => a.estado_validacion === 'validado' || a.estado_validacion === 'publicado').length
      const hayIncompletos = generados < total && generados > 0
      const codigo = derivarCodigo(p as ProcesoConDoc, procesos)
      const pct = total > 0 ? Math.round((generados / total) * 100) : 0
      const esMacroproceso = p.tipo === 'macroproceso' || p.nivel === 0
      const esClickable = esSuperAdmin || !esMacroproceso

      const cardContent = (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 mb-1.5 transition-all duration-200 ${esClickable ? 'cursor-pointer' : 'cursor-default'} ${cfg.bg}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            {codigo && (
              <span className={`text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/50 ${cfg.color} tracking-wide`}>
                {codigo}
              </span>
            )}
            <span className="text-slate-200 text-sm font-medium truncate">{p.nombre}</span>
            <span className={`text-[10px] ${cfg.color} shrink-0 opacity-50 font-medium`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0 ml-4">
            {!esMacroproceso && (
              <>
                {generados === 0 && (
                  <span className="text-[11px] text-slate-400 font-medium">Sin artefactos</span>
                )}
                {generados > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-semibold ${pct === 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {generados}/{total}
                    </span>
                  </div>
                )}
                {publicados > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />{publicados} aprobados
                  </span>
                )}
                {generados === total && total > 0 && publicados === 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <Clock className="w-3 h-3" />Sin aprobar
                  </span>
                )}
                {hayIncompletos && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" />
                )}
              </>
            )}
            {esClickable && (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
            )}
          </div>
        </div>
      )

      return (
        <div key={p.id} style={{ marginLeft: `${Math.min(nivel * 16, 56)}px` }}>
          {esClickable ? (
            <Link href={`/artefactos/${p.id}`} className="block group">{cardContent}</Link>
          ) : (
            <div className="group">{cardContent}</div>
          )}
          {renderArbol(p.id, nivel + 1)}
        </div>
      )
    })
  }

  const hayResultados = procesos.some(p => p.padre_id === null && subarbolVisible.get(p.id))
    || procesos.some(p => subarbolVisible.get(p.id))

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar proceso por nombre o código…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-800 bg-slate-900/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-600/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => setSoloPendientes(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors shrink-0 ${
            soloPendientes
              ? 'bg-amber-950/40 border-amber-700/40 text-amber-300'
              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-300 hover:border-slate-700'
          }`}
        >
          <Filter className="w-3.5 h-3.5" /> Solo con pendientes
        </button>
      </div>

      {hayResultados ? (
        <div className="space-y-0">{renderArbol(null, 0)}</div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <p className="text-sm text-slate-400">Sin resultados{query ? ` para "${query}"` : ''}.</p>
        </div>
      )}
    </div>
  )
}
