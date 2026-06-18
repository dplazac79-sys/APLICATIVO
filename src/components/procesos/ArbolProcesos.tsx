'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Network, GitBranch, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NodoProceso {
  id: string
  nombre: string
  nivel: number
  tipo: string
  padre_id: string | null
  estado?: string
  hijos?: NodoProceso[]
}

const NIVEL_COLOR: Record<number, string> = {
  0: 'text-indigo-300 bg-indigo-900/40 border-indigo-700',
  1: 'text-blue-300 bg-blue-900/40 border-blue-700',
  2: 'text-emerald-300 bg-emerald-900/40 border-emerald-700',
  3: 'text-amber-300 bg-amber-900/40 border-amber-700',
  4: 'text-slate-300 bg-slate-800 border-slate-600',
}

const NIVEL_LABEL: Record<number, string> = {
  0: 'Macroproceso',
  1: 'Proceso',
  2: 'Subproceso',
  3: 'Actividad',
  4: 'Tarea',
}

function buildTree(procesos: NodoProceso[]): NodoProceso[] {
  const map = new Map<string, NodoProceso>()
  const roots: NodoProceso[] = []

  for (const p of procesos) {
    map.set(p.id, { ...p, hijos: [] })
  }

  Array.from(map.values()).forEach(p => {
    if (p.padre_id && map.has(p.padre_id)) {
      map.get(p.padre_id)!.hijos!.push(p)
    } else {
      roots.push(p)
    }
  })

  return roots
}

function NodoItem({
  nodo,
  depth,
  onSelect,
  selectedId,
}: {
  nodo: NodoProceso
  depth: number
  onSelect?: (p: NodoProceso) => void
  selectedId?: string
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const tieneHijos = (nodo.hijos?.length ?? 0) > 0
  const isSelected = selectedId === nodo.id
  const colorClass = NIVEL_COLOR[nodo.nivel] ?? NIVEL_COLOR[4]

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors',
          isSelected ? 'bg-indigo-900/60 ring-1 ring-indigo-600' : 'hover:bg-slate-800/60'
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={() => {
          if (tieneHijos) setExpanded(e => !e)
          onSelect?.(nodo)
        }}
      >
        {tieneHijos ? (
          expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        ) : (
          <Circle className="w-2 h-2 text-slate-600 shrink-0 ml-0.5" />
        )}

        <span className={cn('text-xs px-1.5 py-0.5 rounded border shrink-0', colorClass)}>
          N{nodo.nivel}
        </span>

        <span className="text-sm text-slate-200 flex-1 truncate">{nodo.nombre}</span>

        <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {NIVEL_LABEL[nodo.nivel] ?? 'Proceso'}
        </span>
      </div>

      {tieneHijos && expanded && (
        <div className="border-l border-slate-700/50 ml-4">
          {nodo.hijos!.map(hijo => (
            <NodoItem
              key={hijo.id}
              nodo={hijo}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  procesos: NodoProceso[]
  onSelect?: (p: NodoProceso) => void
  selectedId?: string
  titulo?: string
}

export default function ArbolProcesos({ procesos, onSelect, selectedId, titulo }: Props) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = busqueda.trim()
    ? procesos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : procesos

  const arbol = buildTree(filtrados)

  const nivelCounts = [0, 1, 2, 3, 4].map(n => ({
    nivel: n,
    count: procesos.filter(p => p.nivel === n).length,
  })).filter(x => x.count > 0)

  return (
    <div className="flex flex-col gap-3">
      {titulo && (
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-medium text-slate-200">{titulo}</h3>
        </div>
      )}

      {/* Resumen niveles */}
      <div className="flex flex-wrap gap-2">
        {nivelCounts.map(({ nivel, count }) => (
          <span key={nivel} className={cn('text-xs px-2 py-0.5 rounded border', NIVEL_COLOR[nivel])}>
            {NIVEL_LABEL[nivel]}: {count}
          </span>
        ))}
      </div>

      {/* Búsqueda */}
      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar proceso..."
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {/* Árbol */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {arbol.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
            <GitBranch className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              {busqueda ? 'Sin resultados' : 'Sin procesos aceptados'}
            </p>
          </div>
        ) : (
          <div className="p-2 max-h-96 overflow-y-auto">
            {arbol.map(nodo => (
              <NodoItem
                key={nodo.id}
                nodo={nodo}
                depth={0}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
