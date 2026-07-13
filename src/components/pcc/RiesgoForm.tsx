'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, X } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

interface Props { proyectoId: string }

export default function RiesgoForm({ proyectoId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const primerCampoRef = useRef<HTMLTextAreaElement>(null)
  useEscapeToClose(open, () => setOpen(false))
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [probabilidad, setProbabilidad] = useState<'alta' | 'media' | 'baja'>('media')
  const [impacto, setImpacto] = useState<'alto' | 'medio' | 'bajo'>('medio')
  const [control, setControl] = useState('')

  async function guardar() {
    if (!descripcion.trim()) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/riesgos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          descripcion: descripcion.trim(),
          probabilidad,
          impacto,
          control: control.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDescripcion('')
      setProbabilidad('media')
      setImpacto('medio')
      setControl('')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setCargando(false) }
  }

  const SelectBadge = ({ label, options, value, onChange }: {
    label: string
    options: string[]
    value: string
    onChange: (v: string) => void
  }) => (
    <div>
      <label className="text-slate-400 text-xs mb-1 block">{label}</label>
      <div className="flex gap-1.5">
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${value === opt
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}
        className="h-6 px-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300">
        <Plus className="w-3 h-3 mr-1" />Nuevo
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="riesgo-form-titulo" className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="riesgo-form-titulo" className="text-white font-semibold text-base">Registrar riesgo</h2>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Descripción del riesgo *</label>
                <textarea ref={primerCampoRef} autoFocus value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600 resize-none"
                  placeholder="Ej. Alta rotación del equipo del cliente puede retrasar levantamiento de información" />
              </div>

              <SelectBadge label="Probabilidad" options={['alta', 'media', 'baja']} value={probabilidad}
                onChange={v => setProbabilidad(v as typeof probabilidad)} />
              <SelectBadge label="Impacto" options={['alto', 'medio', 'bajo']} value={impacto}
                onChange={v => setImpacto(v as typeof impacto)} />

              <div>
                <label className="text-slate-400 text-xs mb-1 block">Control / mitigación</label>
                <textarea value={control} onChange={e => setControl(e.target.value)} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-600 resize-none"
                  placeholder="Acciones de mitigación o contingencia..." />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="flex-1 border border-slate-700 text-slate-300 hover:bg-slate-800">
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardar} disabled={!descripcion.trim() || cargando}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                  {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
