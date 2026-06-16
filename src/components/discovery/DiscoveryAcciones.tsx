'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Sparkles, Zap } from 'lucide-react'

interface Props {
  proyectos: { id: string; nombre: string }[]
}

const ETAPAS = [
  'Leyendo documentos analizados del proyecto...',
  'Identificando macroprocesos de la cadena de valor...',
  'Cruzando evidencia documental contra el framework AICOUNTS...',
  'Detectando procesos ausentes y puntos ciegos...',
  'Evaluando criticidad, riesgos y KPIs por proceso...',
  'Construyendo roadmap de transformación...',
  'Redactando recomendación para el CEO...',
]

export default function DiscoveryAcciones({ proyectos }: Props) {
  const [proyectoId, setProyectoId] = useState('')
  const [proyectoNombre, setProyectoNombre] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [etapaIdx, setEtapaIdx] = useState(0)
  const [segundos, setSegundos] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const etapaTimerRef = useRef<NodeJS.Timeout | null>(null)
  const segundosTimerRef = useRef<NodeJS.Timeout | null>(null)

  function handleProyectoChange(id: string) {
    setProyectoId(id)
    setProyectoNombre(proyectos.find(p => p.id === id)?.nombre ?? '')
  }

  function limpiarTimers() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (etapaTimerRef.current) clearInterval(etapaTimerRef.current)
    if (segundosTimerRef.current) clearInterval(segundosTimerRef.current)
  }

  useEffect(() => () => limpiarTimers(), [])

  async function ejecutarDiscovery() {
    if (!proyectoId) return
    setCargando(true)
    setError(null)
    setEtapaIdx(0)
    setSegundos(0)

    etapaTimerRef.current = setInterval(() => {
      setEtapaIdx(i => (i < ETAPAS.length - 1 ? i + 1 : i))
    }, 8000)
    segundosTimerRef.current = setInterval(() => setSegundos(s => s + 1), 1000)

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/discovery`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar discovery')

      const jobId = data.job_id
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/jobs/${jobId}`)
        const d = await r.json()
        if (!r.ok) return
        if (d.job.estado === 'listo') {
          limpiarTimers()
          window.location.reload()
        } else if (d.job.estado === 'error') {
          limpiarTimers()
          setError(d.job.error_mensaje ?? 'Error al generar el inventario')
          setCargando(false)
        }
      }, 3000)
    } catch (err) {
      limpiarTimers()
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setCargando(false)
    }
  }

  if (cargando) {
    const mins = Math.floor(segundos / 60)
    const secs = segundos % 60
    return (
      <div className="w-full max-w-md space-y-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {ETAPAS[etapaIdx]}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-400 animate-pulse" />
        </div>
        <p className="text-slate-600 text-xs">
          ProcessOS Intelligence Engine · AICOUNTS Consultores · Este análisis es exhaustivo, puede tardar 1-3 minutos. Puedes navegar a otra sección y volver — seguirá trabajando en segundo plano.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select onValueChange={(v) => v && handleProyectoChange(v)}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-slate-200 h-9 text-sm">
            <span className="truncate">{proyectoNombre || 'Seleccionar proyecto'}</span>
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
            {proyectos.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={ejecutarDiscovery}
          disabled={!proyectoId}
          className="bg-purple-600 hover:bg-purple-700 text-white h-9"
        >
          <Zap className="w-4 h-4 mr-2" />
          Ejecutar Discovery AI
        </Button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
