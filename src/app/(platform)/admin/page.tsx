export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield, Database, Activity, Plus } from 'lucide-react'
import Link from 'next/link'
import MfaToggle from './MfaToggle'

const ROL_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  director_proyecto: 'Director',
  consultor: 'Consultor',
  sponsor_cliente: 'Sponsor Cliente',
  usuario_cliente: 'Usuario Cliente',
}

const ROL_COLOR: Record<string, string> = {
  super_admin: 'bg-red-900/40 text-red-300 border-red-800',
  director_proyecto: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  consultor: 'bg-blue-900/40 text-blue-300 border-blue-800',
  sponsor_cliente: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  usuario_cliente: 'bg-slate-800 text-slate-400 border-slate-700',
}

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (yo?.rol !== 'super_admin') redirect('/dashboard')

  const admin = createAdminClient()

  const [
    { data: usuarios },
    { data: proyectos },
    { data: clientes },
    { data: auditRecientes },
  ] = await Promise.all([
    admin.from('usuario').select('id, nombre, email, rol, mfa_habilitado, created_at').order('created_at', { ascending: false }).limit(100),
    admin.from('proyecto').select('id, nombre, estado_general, cliente:cliente_id(razon_social)').order('created_at', { ascending: false }).limit(10),
    admin.from('cliente').select('id, razon_social, industria').order('created_at', { ascending: false }).limit(10),
    admin.from('audit_log').select('id, accion, entidad, usuario_id, created_at').order('created_at', { ascending: false }).limit(20),
  ])

  const fecha = (s: string) =>
    new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

  const stats = [
    { label: 'Usuarios registrados', value: usuarios?.length ?? 0, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-950/50' },
    { label: 'Proyectos totales', value: proyectos?.length ?? 0, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-950/50' },
    { label: 'Clientes', value: clientes?.length ?? 0, icon: Database, color: 'text-amber-400', bg: 'bg-amber-950/50' },
    { label: 'Eventos de auditoría', value: auditRecientes?.length ?? 0, icon: Shield, color: 'text-red-400', bg: 'bg-red-950/50' },
  ]

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Administración del Sistema</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de usuarios, accesos y auditoría — Solo Super Administrador</p>
        </div>
        <Link href="/admin/onboarding">
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Nuevo cliente
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs">{s.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Usuarios */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-indigo-400" /> Usuarios del sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {(usuarios ?? []).map(u => (
              <div key={u.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">{u.nombre}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <MfaToggle usuarioId={u.id} habilitado={u.mfa_habilitado ?? true} />
                  <span className={`text-xs px-2 py-0.5 rounded border ${ROL_COLOR[u.rol] ?? ROL_COLOR.usuario_cliente}`}>
                    {ROL_LABEL[u.rol] ?? u.rol}
                  </span>
                  <span className="text-xs text-slate-600">{fecha(u.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proyectos recientes */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-emerald-400" /> Proyectos recientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {(proyectos ?? []).map(p => {
              const cliente = p.cliente as unknown as { razon_social: string } | null
              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.nombre}</p>
                    <p className="text-xs text-slate-500">{cliente?.razon_social ?? '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    p.estado_general === 'activo' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800' :
                    p.estado_general === 'cerrado' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                    'bg-amber-900/40 text-amber-300 border-amber-800'
                  }`}>
                    {p.estado_general}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Log de auditoría */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-red-400" /> Auditoría reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {(auditRecientes ?? []).length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-500">Sin eventos registrados aún.</p>
            ) : (auditRecientes ?? []).map(a => (
              <div key={a.id} className="flex items-center justify-between px-6 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                    a.accion === 'DELETE' ? 'bg-red-900/40 text-red-300' :
                    a.accion === 'CREATE' ? 'bg-emerald-900/40 text-emerald-300' :
                    a.accion === 'EXPORT' ? 'bg-indigo-900/40 text-indigo-300' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {a.accion}
                  </span>
                  <span className="text-xs text-slate-400">{a.entidad}</span>
                </div>
                <span className="text-xs text-slate-600">{fecha(a.created_at)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
