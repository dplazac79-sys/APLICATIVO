'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Trash2, Lock, RefreshCw, X } from 'lucide-react'

interface Props {
  documentoId: string
  estado: 'pendiente' | 'procesando' | 'listo' | 'error'
  puedeEliminar?: boolean
  puedeAnalizar?: boolean
}


export default function DocumentoAcciones({ documentoId, estado: estadoInicial, puedeEliminar = true, puedeAnalizar = false }: Props) {
  const [eliminando, setEliminando] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [procesosVinculados, setProcesosVinculados] = useState<number | null>(null)
  const [reAnalizando, setReAnalizando] = useState(false)
  const [reAnalizado, setReAnalizado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function iniciarEliminacion() {
    setConfirmandoEliminar(true)
    try {
      const res = await fetch(`/api/documentos/${documentoId}`)
      const data = await res.json()
      if (res.ok) setProcesosVinculados(data.procesos_vinculados)
    } catch {
      // Si falla la verificación, se sigue mostrando la confirmación
      // genérica — no bloquea la eliminación por un problema de red al consultar.
    }
  }

  async function reAnalizar() {
    setReAnalizando(true)
    setError(null)
    try {
      const res = await fetch('/api/documentos/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: documentoId }),
      })
      if (!res.ok) throw new Error('Error al re-analizar')
      setReAnalizado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al re-analizar')
    } finally {
      setReAnalizando(false)
    }
  }

  if (estadoInicial === 'listo') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {reAnalizado ? 'Re-análisis encolado' : 'Procesado'}
        </div>
        {puedeAnalizar && !reAnalizado && (
          <button
            onClick={reAnalizar}
            disabled={reAnalizando}
            title="Re-analizar con IA (nueva versión del motor)"
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${reAnalizando ? 'animate-spin' : ''}`} />
            {reAnalizando ? 'Encolando…' : 'Re-analizar'}
          </button>
        )}
      </div>
    )
  }

  async function eliminar() {
    setEliminando(true)
    try {
      const res = await fetch(`/api/documentos/${documentoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setEliminando(false)
      setConfirmandoEliminar(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {puedeEliminar ? (
        confirmandoEliminar ? (
          <div className="flex flex-col items-start gap-1.5">
            {procesosVinculados !== null && procesosVinculados > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Este documento generó {procesosVinculados} proceso{procesosVinculados !== 1 ? 's' : ''} — al eliminarlo se pierde la trazabilidad de origen.
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">¿Eliminar documento?</span>
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button
                onClick={() => { setConfirmandoEliminar(false); setProcesosVinculados(null) }}
                disabled={eliminando}
                aria-label="Cancelar eliminación"
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={iniciarEliminacion}
            className="h-7 text-xs border-red-900 text-red-400 hover:bg-red-950 hover:text-red-300"
          >
            <Trash2 className="w-3 h-3 mr-1.5" />
            Eliminar
          </Button>
        )
      ) : (
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Lock className="w-3 h-3" /> Solo lectura
        </span>
      )}
      {error && (
        <div className="flex items-center gap-1 text-red-400 text-xs">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  )
}
