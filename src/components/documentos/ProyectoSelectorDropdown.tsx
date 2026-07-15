'use client'

import { useState } from 'react'
import { Building2, CheckCircle2, ChevronDown } from 'lucide-react'

interface ProyectoOpcion {
  id: string
  nombre: string
  cliente: { razon_social: string } | null
}

interface Props {
  proyectos: ProyectoOpcion[]
  proyectoId: string
  onChange: (id: string) => void
  placeholder?: string
}

// Antes reimplementado de forma casi idéntica en DocumentUploader.tsx y
// OrganigramaUploader.tsx — mismo look violeta, mismo ícono Building2, misma
// estructura de dropdown — con el riesgo de que un ajuste (ej. accesibilidad,
// estilo) se aplicara en uno y quedara desincronizado del otro.
export default function ProyectoSelectorDropdown({ proyectos, proyectoId, onChange, placeholder = 'Seleccionar proyecto…' }: Props) {
  const [abierto, setAbierto] = useState(false)
  const proyectoActual = proyectos.find(p => p.id === proyectoId) ?? null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAbierto(v => !v) }}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800 hover:border-violet-600/50 transition-all text-sm text-left"
      >
        {proyectoActual ? (
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-slate-200 font-medium truncate">{proyectoActual.nombre}</span>
            {proyectoActual.cliente && (
              <span className="text-slate-400 truncate hidden sm:block">· {proyectoActual.cliente.razon_social}</span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
              {proyectos.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">No hay proyectos activos</p>
              ) : proyectos.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id); setAbierto(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-950/30 transition-colors ${proyectoId === p.id ? 'bg-violet-950/40' : ''}`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${proyectoId === p.id ? 'text-violet-400' : 'text-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{p.nombre}</p>
                    {p.cliente && <p className="text-xs text-slate-400 truncate">{p.cliente.razon_social}</p>}
                  </div>
                  {proyectoId === p.id && <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
