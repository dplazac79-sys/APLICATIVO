'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2, FileText } from 'lucide-react'
import Link from 'next/link'

interface Resultado {
  id: string
  proyecto_id: string
  nombre_archivo: string
  resumen_ejecutivo: string | null
  clasificacion: Record<string, unknown> | null
  similitud: number
}

export default function BuscadorSemantico() {
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBuscando(true)
    setError(null)
    try {
      const res = await fetch('/api/documentos/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al buscar')
      setResultados(data.resultados)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4 space-y-3">
        <form onSubmit={buscar} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Busca en lenguaje natural: ej. 'riesgos de cadena de suministro'"
              className="bg-slate-800 border-slate-700 text-white pl-9"
            />
          </div>
          <Button type="submit" disabled={buscando || !query.trim()} className="bg-indigo-600 hover:bg-indigo-700">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
          </Button>
        </form>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {resultados && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {resultados.length === 0 && (
              <p className="text-slate-500 text-sm">Sin resultados relevantes.</p>
            )}
            {resultados.map(r => (
              <Link
                key={r.id}
                href={`/documentos/${r.id}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors"
              >
                <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-slate-200 text-sm font-medium truncate">{r.nombre_archivo}</p>
                    <span className="text-xs text-emerald-400 font-mono shrink-0">{Math.round(r.similitud * 100)}%</span>
                  </div>
                  {r.resumen_ejecutivo && (
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{r.resumen_ejecutivo}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
