'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import type { TipoArtefacto } from '@/types/database'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'

interface Props {
  procesoId: string
  tipo?: TipoArtefacto
  tieneArtefactos: boolean
}

export default function ArtefactoGenerador({ procesoId, tipo, tieneArtefactos }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'generando' | 'esperando' | 'error'>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generar() {
    setEstado('generando')
    setError(null)
    try {
      const res = await fetch(`/api/procesos/${procesoId}/artefactos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipo ? { tipo } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar')
      setJobId(data.job_id)
      setEstado('esperando')
      esperarComplecion(data.job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setEstado('error')
    }
  }

  async function esperarComplecion(id: string) {
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`)
        const data = await res.json()
        if (data.job?.estado === 'listo') {
          clearInterval(intervalo)
          setEstado('idle')
          router.refresh()
        } else if (data.job?.estado === 'error') {
          clearInterval(intervalo)
          setEstado('error')
          setError(data.job?.error_mensaje ?? 'Error en generación')
        }
      } catch {
        // continuar esperando
      }
    }, 3000)
    // Timeout de 10 minutos
    setTimeout(() => {
      clearInterval(intervalo)
      if (estado === 'esperando') {
        setEstado('idle')
        router.refresh()
      }
    }, 600000)
  }

  const label = tipo ? LABEL_ARTEFACTO[tipo] : 'todos los artefactos'
  const esRegenerar = tieneArtefactos && !tipo

  return (
    <div className="space-y-2">
      <Button
        onClick={generar}
        disabled={estado === 'generando' || estado === 'esperando'}
        className={esRegenerar
          ? 'bg-slate-700 hover:bg-slate-600 text-white'
          : 'bg-purple-600 hover:bg-purple-700 text-white'
        }
        size="sm"
      >
        {estado === 'generando' || estado === 'esperando' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : esRegenerar ? (
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
        )}
        {estado === 'esperando'
          ? `Generando ${label}...`
          : esRegenerar
          ? `Regenerar artefactos`
          : `Generar ${label}`}
      </Button>
      {jobId && estado === 'esperando' && (
        <p className="text-slate-500 text-xs">
          Los artefactos se generan en segundo plano. Esta página se actualizará automáticamente.
        </p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
