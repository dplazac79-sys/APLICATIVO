'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Trash2, Lock, RefreshCw } from 'lucide-react'

interface Props {
  documentoId: string
  estado: 'pendiente' | 'procesando' | 'listo' | 'error'
  puedeEliminar?: boolean
  puedeAnalizar?: boolean
}


export default function DocumentoAcciones({ documentoId, estado: estadoInicial, puedeEliminar = true, puedeAnalizar = false }: Props) {
  const [eliminando, setEliminando] = useState(false)
  const [reAnalizando, setReAnalizando] = useState(false)
  const [reAnalizado, setReAnalizado] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <CheckCircle className="w-3.5 h-3.5" />
          {reAnalizado ? 'Re-análisis encolado' : 'Procesado'}
        </div>
        {puedeAnalizar && !reAnalizado && (
          <button
            onClick={reAnalizar}
            disabled={reAnalizando}
            title="Re-analizar con IA (nueva versión del motor)"
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-violet-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${reAnalizando ? 'animate-spin' : ''}`} />
            {reAnalizando ? 'Encolando…' : 'Re-analizar'}
          </button>
        )}
      </div>
    )
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/documentos/${documentoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setEliminando(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {puedeEliminar ? (
        <Button
          size="sm"
          variant="outline"
          onClick={eliminar}
          disabled={eliminando}
          className="h-7 text-xs border-red-900 text-red-400 hover:bg-red-950 hover:text-red-300"
        >
          <Trash2 className="w-3 h-3 mr-1.5" />
          {eliminando ? 'Eliminando...' : 'Eliminar'}
        </Button>
      ) : (
        <span className="flex items-center gap-1 text-xs text-slate-600">
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
