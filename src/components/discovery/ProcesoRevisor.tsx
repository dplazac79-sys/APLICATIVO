'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2 } from 'lucide-react'
import type { EstadoOferta } from '@/types/database'

interface Props {
  procesoId: string
  estadoActual: EstadoOferta
}

export default function ProcesoRevisor({ procesoId, estadoActual }: Props) {
  const [estado, setEstado] = useState(estadoActual)
  const [cargando, setCargando] = useState<'aceptado' | 'rechazado' | null>(null)

  if (estado !== 'propuesto') return null

  async function cambiarEstado(nuevoEstado: 'aceptado' | 'rechazado') {
    setCargando(nuevoEstado)
    try {
      const res = await fetch(`/api/procesos/${procesoId}/revisar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_oferta: nuevoEstado }),
      })
      if (res.ok) setEstado(nuevoEstado)
    } finally {
      setCargando(null)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => cambiarEstado('aceptado')}
        disabled={cargando !== null}
        className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300"
        title="Aceptar"
      >
        {cargando === 'aceptado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => cambiarEstado('rechazado')}
        disabled={cargando !== null}
        className="h-7 w-7 p-0 text-red-400 hover:bg-red-950 hover:text-red-300"
        title="Rechazar"
      >
        {cargando === 'rechazado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </Button>
    </div>
  )
}
