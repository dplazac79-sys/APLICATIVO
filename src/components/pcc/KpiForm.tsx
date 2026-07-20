'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, X } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props { proyectoId: string }

export default function KpiForm({ proyectoId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  useEscapeToClose(open, () => setOpen(false))
  const trapRef = useFocusTrap(open)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [lineaBase, setLineaBase] = useState('')
  const [meta, setMeta] = useState('')
  const [frecuencia, setFrecuencia] = useState<'diaria' | 'semanal' | 'mensual' | 'trimestral'>('mensual')

  async function guardar() {
    if (!nombre.trim()) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          nombre: nombre.trim(),
          linea_base: lineaBase.trim() || null,
          meta: meta.trim() || null,
          frecuencia,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNombre('')
      setLineaBase('')
      setMeta('')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setCargando(false) }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}
        className="h-6 px-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300">
        <Plus className="w-3 h-3 mr-1" />Nuevo
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="kpi-form-titulo" className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="kpi-form-titulo" className="text-white font-semibold text-base">Nuevo KPI</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-slate-400 hover:text-slate-300 p-2 -m-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="kpi-nombre" className="text-slate-400 text-xs mb-1 block">Nombre del KPI *</label>
                <input id="kpi-nombre" autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600"
                  placeholder="Ej. Tiempo de ciclo de proceso de compras" />
              </div>

              <div>
                <label htmlFor="kpi-frecuencia" className="text-slate-400 text-xs mb-1 block">Frecuencia de medición</label>
                <select id="kpi-frecuencia" value={frecuencia} onChange={e => setFrecuencia(e.target.value as typeof frecuencia)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-600">
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="kpi-linea-base" className="text-slate-400 text-xs mb-1 block">Línea base</label>
                  <input id="kpi-linea-base" type="number" value={lineaBase} onChange={e => setLineaBase(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600"
                    placeholder="Valor actual" />
                </div>
                <div>
                  <label htmlFor="kpi-meta" className="text-slate-400 text-xs mb-1 block">Meta</label>
                  <input id="kpi-meta" type="number" value={meta} onChange={e => setMeta(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600"
                    placeholder="Valor objetivo" />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="flex-1 border border-slate-700 text-slate-300 hover:bg-slate-800">
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardar} disabled={!nombre.trim() || cargando}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                  {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear KPI'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
