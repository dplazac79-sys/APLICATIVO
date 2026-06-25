'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, CheckCircle, AlertCircle, Trash2, Lock } from 'lucide-react'

interface Props {
  documentoId: string
  estado: 'pendiente' | 'procesando' | 'listo' | 'error'
  puedeEliminar?: boolean
  puedeAnalizar?: boolean
}

const ETAPAS = [
  { label: 'Extrayendo texto del documento...', pct: 12 },
  { label: 'Leyendo y comprendiendo el contenido...', pct: 28 },
  { label: 'Clasificando según bloques metodológicos...', pct: 45 },
  { label: 'Analizando procesos, roles y riesgos...', pct: 62 },
  { label: 'Detectando brechas y oportunidades...', pct: 76 },
  { label: 'Generando resumen ejecutivo de nivel Directorio...', pct: 88 },
  { label: 'Finalizando análisis inteligente...', pct: 96 },
]

export default function DocumentoAcciones({ documentoId, estado: estadoInicial, puedeEliminar = true, puedeAnalizar = true }: Props) {
  const [estado, setEstado] = useState(estadoInicial)
  const [cargando, setCargando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [etapa, setEtapa] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const etapaRef = useRef(0)

  function iniciarProgreso() {
    etapaRef.current = 0
    setProgreso(0)
    setEtapa(ETAPAS[0].label)
    intervalRef.current = setInterval(() => {
      const idx = etapaRef.current
      if (idx < ETAPAS.length - 1) {
        etapaRef.current = idx + 1
        setProgreso(ETAPAS[idx + 1].pct)
        setEtapa(ETAPAS[idx + 1].label)
      }
    }, 4500)
  }

  function detenerProgreso() {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => () => detenerProgreso(), [])

  async function procesarConIA() {
    setCargando(true)
    setError(null)
    setEstado('procesando')
    iniciarProgreso()
    try {
      const res = await fetch('/api/documentos/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: documentoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar')
      detenerProgreso()
      setProgreso(100)
      setEtapa('¡Análisis completado!')
      setTimeout(() => {
        setEstado('listo')
        window.location.href = `/documentos/${documentoId}`
      }, 800)
    } catch (err) {
      detenerProgreso()
      setEstado('error')
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }

  if (estado === 'listo') {
    return (
      <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
        <CheckCircle className="w-3.5 h-3.5" />
        Analizado por IA
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {etapa}
          </span>
          <span className="text-xs text-slate-500 font-mono">{progreso}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <p className="text-slate-600 text-xs">ProcessOS Intelligence Engine · AICOUNTS Consultores</p>
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
      {puedeAnalizar && (
        <Button
          size="sm"
          variant="outline"
          onClick={procesarConIA}
          className="h-7 text-xs border-indigo-700 text-indigo-300 hover:bg-indigo-950 hover:text-indigo-200"
        >
          <Sparkles className="w-3 h-3 mr-1.5" />
          Analizar con IA
        </Button>
      )}
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
