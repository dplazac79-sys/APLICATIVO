'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TRANSICIONES_VALIDAS, type WorkflowEstadoTipo } from '@/types/database'
import { ChevronRight, AlertTriangle, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProcesoWF {
  id: string
  nombre: string
  nivel: number
  workflow: {
    estado: WorkflowEstadoTipo
    nivel_escalacion: string | null
    responsable: { nombre: string } | null
  } | null
}

const ESTADO_STYLE: Record<WorkflowEstadoTipo, string> = {
  'Scheduled':        'border-slate-700 bg-slate-800/40 text-slate-400',
  'Assigned':         'border-blue-800 bg-blue-950/30 text-blue-300',
  'In Progress':      'border-indigo-800 bg-indigo-950/30 text-indigo-300',
  'Pending Approval': 'border-amber-700 bg-amber-950/30 text-amber-300',
  'Approved':         'border-emerald-700 bg-emerald-950/30 text-emerald-300',
  'Implemented':      'border-teal-700 bg-teal-950/30 text-teal-300',
  'Closed':           'border-slate-800 bg-slate-900/60 text-slate-500',
}

const NIVEL_BADGE: Record<string, string> = {
  N1: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  N2: 'bg-orange-950 text-orange-400 border-orange-800',
  N3: 'bg-red-950 text-red-400 border-red-800',
  N4: 'bg-red-950 text-red-300 border-red-700',
}

interface Props {
  procesos: ProcesoWF[]
  proyectoId: string
}

export default function WorkflowBoard({ procesos, proyectoId }: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function inicializarWorkflow(procesoId: string) {
    setCargando(procesoId)
    setError(null)
    try {
      await fetch(`/api/procesos/${procesoId}/workflow`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      router.refresh()
    } catch { setError('Error al inicializar') } finally { setCargando(null) }
  }

  async function transicionar(procesoId: string, nuevoEstado: WorkflowEstadoTipo) {
    setCargando(procesoId)
    setError(null)
    try {
      const res = await fetch(`/api/procesos/${procesoId}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevo_estado: nuevoEstado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setCargando(null) }
  }

  void proyectoId

  if (procesos.length === 0) {
    return <p className="text-slate-500 text-sm">No hay procesos aceptados. Acepta procesos en Discovery AI primero.</p>
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {procesos.map(p => {
        const wf = p.workflow
        const estadoActual = wf?.estado
        const siguientes = estadoActual ? TRANSICIONES_VALIDAS[estadoActual] : []
        const esNivel0 = p.nivel === 0

        return (
          <div
            key={p.id}
            className={`rounded-lg border px-3 py-2 ${esNivel0 ? '' : 'ml-4 opacity-90'} ${estadoActual ? ESTADO_STYLE[estadoActual] : 'border-slate-800 bg-slate-800/20'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {!esNivel0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                <span className="text-sm font-medium truncate">{p.nombre}</span>
                {wf?.nivel_escalacion && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${NIVEL_BADGE[wf.nivel_escalacion] ?? ''} flex items-center gap-1`}>
                    <AlertTriangle className="w-2.5 h-2.5" />{wf.nivel_escalacion}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {estadoActual && (
                  <span className="text-xs opacity-80">{estadoActual}</span>
                )}
                {cargando === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {!wf && cargando !== p.id && (
                  <Button size="sm" variant="ghost" onClick={() => inicializarWorkflow(p.id)}
                    className="h-6 px-2 text-xs bg-slate-700 hover:bg-slate-600 text-white">
                    <Plus className="w-3 h-3 mr-1" />Iniciar
                  </Button>
                )}
                {wf && siguientes.map(sig => (
                  <Button key={sig} size="sm" variant="ghost" onClick={() => transicionar(p.id, sig)}
                    disabled={cargando === p.id}
                    className="h-6 px-2 text-xs bg-slate-700 hover:bg-slate-600 text-white">
                    → {sig}
                  </Button>
                ))}
              </div>
            </div>
            {wf?.responsable && (
              <p className="text-slate-500 text-xs mt-0.5 ml-0">Responsable: {wf.responsable.nombre}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
