'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BrainCircuit, Loader2 } from 'lucide-react'

interface Props {
  clienteId: string
  inicial: Record<string, unknown> | null
}

export default function IntelIndustriaEditor({ clienteId, inicial }: Props) {
  const router = useRouter()
  const [notas, setNotas] = useState(typeof inicial?.notas === 'string' ? inicial.notas : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      <CardContent className="space-y-3">
        <p className="text-slate-600 text-xs">
          Notas y contexto de industria que el equipo de AICOUNTS quiera dejar registrado manualmente
          (la generación automática vía IA llega en Fase 6).
        </p>
        <Textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Tendencias de la industria, benchmarks relevantes, competidores, regulación aplicable..."
          rows={4}
          className="bg-slate-800 border-slate-700 text-white resize-none"
        />
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
