'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { titleCase, oracionCase } from '@/lib/normalizar'

interface Props {
  clienteId: string
}

export default function NuevoProyectoForm({ clienteId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', alcance: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setCargando(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('proyecto').insert({
        cliente_id: clienteId,
        nombre: titleCase(form.nombre),
        alcance: form.alcance.trim() ? oracionCase(form.alcance) : null,
        estado_general: 'activo',
        fase_actual: 1,
      })
      if (err) throw err
      setForm({ nombre: '', alcance: '' })
      setAbierto(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear proyecto')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAbierto(!abierto)}
        className="border-indigo-700 text-indigo-300 hover:bg-indigo-950 mb-3"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Nuevo proyecto
        {abierto ? <ChevronUp className="w-3.5 h-3.5 ml-1.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-1.5" />}
      </Button>

      {abierto && (
        <Card className="bg-slate-900 border-indigo-800/50 mb-3">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Nombre del proyecto *</Label>
                <Input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Levantamiento de procesos operacionales"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Alcance</Label>
                <Textarea
                  value={form.alcance}
                  onChange={e => setForm(f => ({ ...f, alcance: e.target.value }))}
                  placeholder="Descripción del alcance del proyecto..."
                  className="bg-slate-800 border-slate-700 text-slate-100 min-h-20"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={cargando} className="bg-indigo-600 hover:bg-indigo-700">
                  {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear proyecto'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto(false)}
                  className="text-slate-400 hover:text-slate-200">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
