'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Cliente } from '@/types/database'
import { titleCase, oracionCase } from '@/lib/normalizar'

interface Props {
  cliente?: Cliente
}

const INDUSTRIAS = [
  'Minería', 'Construcción', 'Manufactura', 'Retail', 'Servicios Financieros',
  'Salud', 'Educación', 'Tecnología', 'Logística y Transporte',
  'Energía y Utilities', 'Agroindustria', 'Consultoría', 'Otro',
]

const TAMANOS = ['micro', 'pequeña', 'mediana', 'grande']
const MADUREZ = ['inicial', 'en desarrollo', 'avanzado']

export default function ClienteForm({ cliente }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    razon_social: cliente?.razon_social ?? '',
    rut: cliente?.rut ?? '',
    industria: cliente?.industria ?? '',
    tamano: cliente?.tamano ?? '',
    facturacion: cliente?.facturacion?.toString() ?? '',
    dotacion: cliente?.dotacion?.toString() ?? '',
    madurez_digital: cliente?.madurez_digital ?? '',
    objetivos_estrategicos: cliente?.objetivos_estrategicos ?? '',
    riesgos_declarados: cliente?.riesgos_declarados ?? '',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      razon_social: titleCase(form.razon_social),
      rut: form.rut || null,
      industria: form.industria || null,
      tamano: form.tamano || null,
      facturacion: form.facturacion ? parseFloat(form.facturacion) : null,
      dotacion: form.dotacion ? parseInt(form.dotacion) : null,
      madurez_digital: form.madurez_digital || null,
      objetivos_estrategicos: form.objetivos_estrategicos ? oracionCase(form.objetivos_estrategicos) : null,
      riesgos_declarados: form.riesgos_declarados ? oracionCase(form.riesgos_declarados) : null,
    }

    if (cliente) {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); setLoading(false); return }
    } else {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); setLoading(false); return }
    }

    setLoading(false)
    if (cliente) {
      router.push(`/clientes/${cliente.id}`)
    } else {
      router.push('/clientes')
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos corporativos */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Datos corporativos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-slate-300">Razón social *</Label>
            <Input
              value={form.razon_social}
              onChange={e => set('razon_social', e.target.value)}
              required
              placeholder="Empresa S.A."
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">RUT</Label>
            <Input
              value={form.rut}
              onChange={e => set('rut', e.target.value)}
              placeholder="76.123.456-7"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Industria</Label>
            <Select value={form.industria} onValueChange={(v) => v && set('industria', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {INDUSTRIAS.map(i => (
                  <SelectItem key={i} value={i} className="text-slate-200 focus:bg-slate-700">{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Tamaño</Label>
            <Select value={form.tamano} onValueChange={(v) => v && set('tamano', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {TAMANOS.map(t => (
                  <SelectItem key={t} value={t} className="text-slate-200 focus:bg-slate-700 capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Madurez digital</Label>
            <Select value={form.madurez_digital} onValueChange={(v) => v && set('madurez_digital', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {MADUREZ.map(m => (
                  <SelectItem key={m} value={m} className="text-slate-200 focus:bg-slate-700 capitalize">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Facturación anual (USD)</Label>
            <Input
              type="number"
              value={form.facturacion}
              onChange={e => set('facturacion', e.target.value)}
              placeholder="1000000"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Dotación (personas)</Label>
            <Input
              type="number"
              value={form.dotacion}
              onChange={e => set('dotacion', e.target.value)}
              placeholder="250"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contexto empresarial */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Contexto empresarial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Objetivos estratégicos</Label>
            <Textarea
              value={form.objetivos_estrategicos}
              onChange={e => set('objetivos_estrategicos', e.target.value)}
              placeholder="Describir los principales objetivos estratégicos del cliente..."
              rows={4}
              className="bg-slate-800 border-slate-700 text-white resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Riesgos declarados</Label>
            <Textarea
              value={form.riesgos_declarados}
              onChange={e => set('riesgos_declarados', e.target.value)}
              placeholder="Riesgos identificados por el propio cliente..."
              rows={3}
              className="bg-slate-800 border-slate-700 text-white resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 px-3 py-2 rounded-md">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {loading ? 'Guardando...' : cliente ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
