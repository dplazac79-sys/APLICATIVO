'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, X } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

interface Props {
  proyectoId: string
}

export default function ReunionForm({ proyectoId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  useEscapeToClose(open, () => setOpen(false))
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16))
  const [participantes, setParticipantes] = useState('')
  const [acuerdos, setAcuerdos] = useState('')

  async function guardar() {
    if (!titulo.trim()) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/reuniones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          titulo: titulo.trim(),
          fecha: new Date(fecha).toISOString(),
          participantes: participantes.split(',').map(s => s.trim()).filter(Boolean),
          compromisos: acuerdos.trim()
            ? [{ descripcion: acuerdos.trim(), responsable: '', fecha_limite: null, completado: false }]
            : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTitulo('')
      setParticipantes('')
      setAcuerdos('')
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
        <Plus className="w-3 h-3 mr-1" />Nueva
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reunion-form-titulo" className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="reunion-form-titulo" className="text-white font-semibold text-base">Nueva reunión</h2>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Título *</label>
                <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600"
                  placeholder="Ej. Kick-off Proceso de Compras" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Fecha y hora</label>
                <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-600" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Participantes (separados por coma)</label>
                <input value={participantes} onChange={e => setParticipantes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600"
                  placeholder="Ej. Juan Pérez, María González" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Acuerdos / compromisos</label>
                <textarea value={acuerdos} onChange={e => setAcuerdos(e.target.value)} rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600 resize-none"
                  placeholder="Descripción de los acuerdos principales..." />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="flex-1 border border-slate-700 text-slate-300 hover:bg-slate-800">
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardar} disabled={!titulo.trim() || cargando}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                  {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
