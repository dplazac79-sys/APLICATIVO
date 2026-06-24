'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Building2, FolderOpen, Users, Eye, Plus, Trash2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'

const INDUSTRIAS = ['Manufactura', 'Retail', 'Salud', 'Educación', 'Finanzas', 'Tecnología', 'Logística', 'Construcción', 'Energía', 'Servicios', 'Minería', 'Otro']
const TAMANOS = ['1-50 empleados', '51-200 empleados', '201-500 empleados', '501-1000 empleados', 'Más de 1000 empleados']
const ROLES = [
  { value: 'director_proyecto', label: 'Director de Proyecto', desc: 'Equipo AICOUNTS. Supervisa el proyecto, aprueba artefactos y gestiona el equipo. Acceso completo a todos los módulos.' },
  { value: 'consultor', label: 'Consultor', desc: 'Equipo AICOUNTS. Ejecuta el trabajo: genera artefactos, sube documentos, corre Discovery AI y modela procesos.' },
  { value: 'sponsor_cliente', label: 'Cliente Activo', desc: 'Lado cliente autónomo. Carga sus propios procesos, ejecuta Discovery AI, genera artefactos y trabaja sin depender del equipo AICOUNTS.' },
  { value: 'usuario_cliente', label: 'Cliente Observador', desc: 'Lado cliente solo lectura. Accede al portal para ver los artefactos publicados que le comparten.' },
]

const PASOS = [
  { id: 1, label: 'Empresa', icon: Building2 },
  { id: 2, label: 'Proyecto', icon: FolderOpen },
  { id: 3, label: 'Equipo', icon: Users },
  { id: 4, label: 'Confirmar', icon: Eye },
]

interface Miembro { email: string; nombre: string; rol: string; password: string }

export default function OnboardingPage() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState<{ cliente_id: string; proyecto_id: string; equipo: { email: string; status: string }[] } | null>(null)
  const [error, setError] = useState('')

  const [empresa, setEmpresa] = useState({ razon_social: '', industria: '', tamano: '', objetivos_estrategicos: '' })
  const [proyecto, setProyecto] = useState({ nombre: '', descripcion: '', fecha_inicio: '', fecha_estimada_cierre: '' })
  const [equipo, setEquipo] = useState<Miembro[]>([{ email: '', nombre: '', rol: 'director_proyecto', password: '' }])

  function addMiembro() { setEquipo(e => [...e, { email: '', nombre: '', rol: 'consultor', password: '' }]) }
  function removeMiembro(i: number) { setEquipo(e => e.filter((_, idx) => idx !== i)) }
  function updateMiembro(i: number, field: keyof Miembro, val: string) {
    setEquipo(e => e.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function puedeAvanzar() {
    if (paso === 1) return empresa.razon_social.trim() && empresa.industria && empresa.tamano
    if (paso === 2) return proyecto.nombre.trim()
    if (paso === 3) return equipo.every(m => m.email.trim() && m.rol)
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, proyecto, equipo: equipo.filter(m => m.email.trim()) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExito(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (exito) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">¡Cliente configurado!</h2>
            <p className="text-slate-400 text-sm mb-6">La empresa, proyecto y equipo fueron creados exitosamente.</p>
            <div className="bg-slate-800 rounded-lg p-4 text-left space-y-2 mb-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Estado del equipo</p>
              {exito.equipo.map(m => (
                <div key={m.email} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{m.email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${m.status === 'invitado' ? 'bg-emerald-900/40 text-emerald-400' : m.status === 'rol_actualizado' ? 'bg-blue-900/40 text-blue-400' : 'bg-red-900/40 text-red-400'}`}>
                    {m.status === 'invitado' ? 'Invitación enviada' : m.status === 'rol_actualizado' ? 'Rol actualizado' : 'Error'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-700 text-slate-300" onClick={() => { setExito(null); setPaso(1); setEmpresa({ razon_social: '', industria: '', tamano: '', objetivos_estrategicos: '' }); setProyecto({ nombre: '', descripcion: '', fecha_inicio: '', fecha_estimada_cierre: '' }); setEquipo([{ email: '', nombre: '', rol: 'director_proyecto', password: '' }]) }}>
                Nuevo cliente
              </Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => router.push('/admin')}>
                Ir al admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurar nuevo cliente</h1>
        <p className="text-slate-400 text-sm mt-1">Crea la empresa, proyecto y equipo en 4 pasos</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {PASOS.map((p, idx) => {
          const Icon = p.icon
          const done = paso > p.id
          const active = paso === p.id
          return (
            <div key={p.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${done ? 'bg-emerald-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs hidden sm:block ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-600'}`}>{p.label}</span>
              </div>
              {idx < PASOS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${paso > p.id ? 'bg-emerald-600' : 'bg-slate-800'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Paso 1: Empresa */}
      {paso === 1 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-400" /> Datos de la empresa</CardTitle>
            <CardDescription className="text-slate-400">Información del cliente que usará la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Razón social *</Label>
              <Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Empresa S.A." value={empresa.razon_social} onChange={e => setEmpresa(v => ({ ...v, razon_social: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Industria *</Label>
                <select className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm" value={empresa.industria} onChange={e => setEmpresa(v => ({ ...v, industria: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Tamaño *</Label>
                <select className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm" value={empresa.tamano} onChange={e => setEmpresa(v => ({ ...v, tamano: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {TAMANOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Objetivos estratégicos</Label>
              <textarea className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm resize-none" rows={3} placeholder="Describe los objetivos principales del cliente..." value={empresa.objetivos_estrategicos} onChange={e => setEmpresa(v => ({ ...v, objetivos_estrategicos: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Proyecto */}
      {paso === 2 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><FolderOpen className="w-4 h-4 text-indigo-400" /> Proyecto inicial</CardTitle>
            <CardDescription className="text-slate-400">El primer proyecto que se creará para este cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Nombre del proyecto *</Label>
              <Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Optimización de procesos 2026" value={proyecto.nombre} onChange={e => setProyecto(v => ({ ...v, nombre: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300">Descripción</Label>
              <textarea className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm resize-none" rows={3} placeholder="Alcance y objetivos del proyecto..." value={proyecto.descripcion} onChange={e => setProyecto(v => ({ ...v, descripcion: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Fecha de inicio</Label>
                <Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={proyecto.fecha_inicio} onChange={e => setProyecto(v => ({ ...v, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <Label className="text-slate-300">Fecha estimada de cierre</Label>
                <Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={proyecto.fecha_estimada_cierre} onChange={e => setProyecto(v => ({ ...v, fecha_estimada_cierre: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Equipo */}
      {paso === 3 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Equipo del proyecto</CardTitle>
            <CardDescription className="text-slate-400">Los usuarios recibirán una invitación por email para acceder</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {equipo.map((m, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Miembro {i + 1}</span>
                  {equipo.length > 1 && (
                    <button onClick={() => removeMiembro(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400 text-xs">Email *</Label>
                    <Input className="bg-slate-800 border-slate-700 text-white mt-1 text-sm" placeholder="usuario@empresa.com" value={m.email} onChange={e => updateMiembro(i, 'email', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Nombre</Label>
                    <Input className="bg-slate-800 border-slate-700 text-white mt-1 text-sm" placeholder="Nombre completo" value={m.nombre} onChange={e => updateMiembro(i, 'nombre', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Rol *</Label>
                  <select className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm" value={m.rol} onChange={e => updateMiembro(i, 'rol', e.target.value)}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {m.rol && (
                    <p className="text-slate-500 text-xs mt-1.5 leading-snug">
                      {ROLES.find(r => r.value === m.rol)?.desc}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Contraseña *</Label>
                  <Input className="mt-1 bg-slate-800 border-slate-700 text-white" type="password" placeholder="Mínimo 6 caracteres" value={m.password} onChange={e => updateMiembro(i, 'password', e.target.value)} />
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full border-slate-700 border-dashed text-slate-400 hover:text-white hover:bg-slate-800" onClick={addMiembro}>
              <Plus className="w-4 h-4 mr-2" /> Agregar miembro
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paso 4: Confirmación */}
      {paso === 4 && (
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-400" /> Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Razón social</span><span className="text-white font-medium">{empresa.razon_social}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Industria</span><span className="text-white">{empresa.industria}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tamaño</span><span className="text-white">{empresa.tamano}</span></div>
              {empresa.objetivos_estrategicos && <div className="pt-2 border-t border-slate-800"><p className="text-slate-400 text-xs mb-1">Objetivos</p><p className="text-slate-300 text-xs">{empresa.objetivos_estrategicos}</p></div>}
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><FolderOpen className="w-4 h-4 text-indigo-400" /> Proyecto</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Nombre</span><span className="text-white font-medium">{proyecto.nombre}</span></div>
              {proyecto.fecha_inicio && <div className="flex justify-between"><span className="text-slate-400">Inicio</span><span className="text-white">{proyecto.fecha_inicio}</span></div>}
              {proyecto.fecha_estimada_cierre && <div className="flex justify-between"><span className="text-slate-400">Cierre estimado</span><span className="text-white">{proyecto.fecha_estimada_cierre}</span></div>}
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Equipo ({equipo.filter(m => m.email).length} miembros)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {equipo.filter(m => m.email).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div><p className="text-white">{m.nombre || m.email}</p><p className="text-slate-500 text-xs">{m.email}</p></div>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-800">{ROLES.find(r => r.value === m.rol)?.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          {error && <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
        </div>
      )}

      {/* Navegación */}
      <div className="flex gap-3 justify-between">
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => paso > 1 ? setPaso(p => p - 1) : router.push('/admin')} disabled={loading}>
          <ChevronLeft className="w-4 h-4 mr-1" /> {paso === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        {paso < 4 ? (
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setPaso(p => p + 1)} disabled={!puedeAvanzar()}>
            Siguiente <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmit} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</> : <><CheckCircle className="w-4 h-4 mr-2" /> Crear cliente</>}
          </Button>
        )}
      </div>
    </div>
  )
}
