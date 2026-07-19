'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Loader2 } from 'lucide-react'

interface Props {
  procesoId: string
  totalPendientes: number
}

export default function ValidarTodosButton({ procesoId, totalPendientes }: Props) {
  const router = useRouter()
  const [validando, setValidando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function validarTodos() {
    if (validando) return
    setValidando(true)
    setError(null)
    try {
      const res = await fetch(`/api/procesos/${procesoId}/artefactos/validar-todos`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo validar')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
      setValidando(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={validarTodos}
        disabled={validando}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-950/70 hover:border-emerald-700/50 transition-colors disabled:opacity-60"
      >
        {validando
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Validando...</>
          : <><CheckCheck className="w-3.5 h-3.5" /> Validar todos los pendientes ({totalPendientes})</>
        }
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
