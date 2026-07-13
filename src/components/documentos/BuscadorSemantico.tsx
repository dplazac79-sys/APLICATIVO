'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, Tag, Sparkles, X } from 'lucide-react'

interface Resultado {
  id: string
  proyecto_id: string
  nombre_archivo: string
  resumen_ejecutivo: string | null
  clasificacion: Record<string, unknown> | null
  similitud: number
  tipo_match: 'nombre' | 'semantico'
  estado_procesamiento?: string
}

interface Props {
  onFiltrar?: (ids: string[] | null) => void
}

export default function BuscadorSemantico({ onFiltrar }: Props) {
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
      // Notificar al padre para filtrar la lista de documentos
      onFiltrar?.(data.resultados.length > 0 ? data.resultados.map((r: Resultado) => r.id) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBuscando(false)
    }
  }

  function limpiar() {
    setQuery('')
    setResultados(null)
    setError(null)
    onFiltrar?.(null)
  }

  return (
    <Card className="bg-gradient-to-br from-violet-950/20 to-slate-900 border-violet-700/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Búsqueda con IA en el contenido</p>
        </div>
        <form onSubmit={buscar} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles className="w-4 h-4 text-violet-400/70 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ej. 'riesgos de cadena de suministro' — busca dentro del texto, no solo en el nombre"
              className="bg-slate-800 border-violet-700/30 text-white pl-9 pr-9 focus-visible:ring-violet-500/40"
            />
            {query && (
              <button
                type="button"
                onClick={limpiar}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" disabled={buscando || !query.trim()} className="bg-violet-600 hover:bg-violet-500 shrink-0">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar con IA'}
          </Button>
        </form>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {resultados !== null && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {resultados.length === 0 ? (
              <p className="text-slate-500 text-sm">Sin resultados para <span className="text-slate-300">&quot;{query}&quot;</span>.</p>
            ) : (
              <>
                <p className="text-xs text-slate-500">{resultados.length} documento{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''} · la lista de abajo está filtrada</p>
                {resultados.map(r => {
                  const tipoDoc = r.clasificacion?.tipo_documento as string | undefined
                  return (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                    >
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-slate-200 text-sm font-medium truncate">{r.nombre_archivo}</p>
                          {r.tipo_match === 'nombre' ? (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">
                              <Tag className="w-3 h-3" /> nombre
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                              <Sparkles className="w-3 h-3" /> contenido · {Math.round(r.similitud * 100)}%
                            </span>
                          )}
                        </div>
                        {tipoDoc && <p className="text-slate-500 text-xs mt-0.5 italic">{tipoDoc}</p>}
                        {r.resumen_ejecutivo && r.tipo_match === 'semantico' && (
                          <p className="text-slate-500 text-xs mt-1 line-clamp-2">{r.resumen_ejecutivo}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
