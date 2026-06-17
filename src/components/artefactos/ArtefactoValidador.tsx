'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, Globe, RotateCcw, Loader2 } from 'lucide-react'
import type { EstadoValidacion } from '@/types/database'

interface Props {
  artefactoId: string
  estadoActual: EstadoValidacion
}

const TRANSICIONES: Record<EstadoValidacion, { siguiente: EstadoValidacion; label: string; icon: React.ReactNode; clase: string } | null> = {
  pendiente: {
    siguiente: 'validado',
    label: 'Validar',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    clase: 'bg-emerald-700 hover:bg-emerald-600 text-white',
  },
  validado: {
    siguiente: 'publicado',
    label: 'Publicar',
    icon: <Globe className="w-3.5 h-3.5" />,
    clase: 'bg-blue-700 hover:bg-blue-600 text-white',
  },
  publicado: {
    siguiente: 'validado',
    label: 'Despublicar',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
    clase: 'bg-slate-700 hover:bg-slate-600 text-white',
  },
}

const BADGE: Record<EstadoValidacion, string> = {
  pendiente: 'bg-amber-950 text-amber-400 border-amber-800',
  validado: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  publicado: 'bg-blue-950 text-blue-400 border-blue-800',
}

export default function ArtefactoValidador({ artefactoId, estadoActual }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoValidacion>(estadoActual)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transicion = TRANSICIONES[estado]

  async function cambiarEstado() {
    if (!transicion) return
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/artefactos/${artefactoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_validacion: transicion.siguiente }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar')
      setEstado(transicion.siguiente)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs px-2 py-0.5 rounded-full border ${BADGE[estado]}`}>
        {estado}
      </span>
      {transicion && (
        <Button
          size="sm"
          variant="ghost"
          onClick={cambiarEstado}
          disabled={guardando}
          className={`h-6 px-2 text-xs ${transicion.clase}`}
        >
          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : transicion.icon}
          <span className="ml-1">{transicion.label}</span>
        </Button>
      )}
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
