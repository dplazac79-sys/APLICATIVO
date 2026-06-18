'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BrainCircuit, Loader2, Zap } from 'lucide-react'

interface Props {
  clienteId: string
  inicial: Record<string, unknown> | null
  industria?: string | null
}

interface KgSnapshot {
  industria: string
  proyectos_cerrados: number
  procesos_frecuentes: { nombre: string; frecuencia: number }[]
  automatizaciones: { tipo: string; frecuencia: number; herramientas: string[] }[]
  riesgos_frecuentes?: { nombre: string; frecuencia: number }[]
}

const TIPO_COLOR: Record<string, string> = {
  RPA: 'bg-blue-900 text-blue-200',
  integracion: 'bg-purple-900 text-purple-200',
  ia_generativa: 'bg-emerald-900 text-emerald-200',
  workflow: 'bg-amber-900 text-amber-200',
  hibrida: 'bg-pink-900 text-pink-200',
}

export default function IntelIndustriaEditor({ clienteId, inicial, industria }: Props) {
  const router = useRouter()
  const [notas, setNotas] = useState(typeof inicial?.notas === 'string' ? inicial.notas : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kgData, setKgData] = useState<KgSnapshot | null>(null)

  // Cargar Knowledge Graph de la industria si está disponible
  useEffect(() => {
    if (!industria) return
    fetch(`/api/kg/industria?industria=${encodeURIComponent(industria)}`)
      .then(r => r.json())
      .then(d => { if (d.snapshot) setKgData(d.snapshot) })
      .catch(() => null)
  }, [industria])

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inteligencia_industria: { notas } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4" /> Inteligencia de industria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Datos del Knowledge Graph (si existen) */}
        {kgData && (
          <div className="bg-slate-800 rounded-lg p-4 space-y-3 border border-slate-700">
            <div className="flex items-center gap-2 text-xs text-indigo-400">
              <Zap className="w-3.5 h-3.5" />
              <span className="font-medium">Knowledge Graph — {kgData.industria}</span>
              <span className="text-slate-500 ml-auto">{kgData.proyectos_cerrados} proyecto(s) cerrado(s)</span>
            </div>

            {kgData.procesos_frecuentes?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Procesos típicos</p>
                <div className="flex flex-wrap gap-1">
                  {kgData.procesos_frecuentes.slice(0, 8).map(p => (
                    <span key={p.nombre} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {p.nombre} <span className="text-slate-500">×{p.frecuencia}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {kgData.automatizaciones?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Automatizaciones más recomendadas</p>
                <div className="flex flex-wrap gap-1">
                  {kgData.automatizaciones.map(a => (
                    <div key={a.tipo} className="text-xs">
                      <span className={`px-2 py-0.5 rounded ${TIPO_COLOR[a.tipo] ?? 'bg-slate-700 text-slate-300'}`}>
                        {a.tipo} ×{a.frecuencia}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Herramientas: {Array.from(new Set(kgData.automatizaciones.flatMap(a => a.herramientas))).slice(0, 6).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notas manuales */}
        <div>
          <p className="text-slate-500 text-xs mb-2">
            Notas y contexto adicional registrado manualmente por el equipo AICOUNTS
          </p>
          <Textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Tendencias de la industria, benchmarks relevantes, competidores, regulación aplicable..."
            rows={4}
            className="bg-slate-800 border-slate-700 text-white resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}
        <Button
          size="sm"
          onClick={guardar}
          disabled={guardando}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
          Guardar notas
        </Button>
      </CardContent>
    </Card>
  )
}
