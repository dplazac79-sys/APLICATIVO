export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatFecha as fecha } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield, Database, Activity, Plus } from 'lucide-react'
import Link from 'next/link'
import UnlockButton from './UnlockButton'
import DeleteUserButton from './DeleteUserButton'

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

const USUARIOS_PAGE_SIZE = 25

export default async function AdminPage({ searchParams }: { searchParams: { usuariosPage?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (yo?.rol !== 'super_admin') redirect('/dashboard')

  const admin = createAdminClient()

  const usuariosPage = Math.max(1, parseInt(searchParams.usuariosPage ?? '1', 10) || 1)
  const usuariosFrom = (usuariosPage - 1) * USUARIOS_PAGE_SIZE
  const usuariosTo = usuariosFrom + USUARIOS_PAGE_SIZE - 1

  const [
    { data: usuarios, count: totalUsuarios },
    { data: proyectos },
    { data: clientes },
    { data: auditRecientes },
  ] = await Promise.all([
    admin.from('usuario').select('id, nombre, email, rol, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(usuariosFrom, usuariosTo),
    admin.from('proyecto').select('id, nombre, estado_general, cliente:cliente_id(razon_social)').order('created_at', { ascending: false }).limit(10),
    admin.from('cliente').select('id, razon_social, industria').order('created_at', { ascending: false }).limit(10),
    admin.from('audit_log').select('id, accion, entidad, detalle, created_at, usuario:usuario_id(nombre)').order('created_at', { ascending: false }).limit(20),
  ])
  const totalPaginasUsuarios = Math.max(1, Math.ceil((totalUsuarios ?? 0) / USUARIOS_PAGE_SIZE))

  // Leer user_metadata de Supabase Auth para saber quiénes están bloqueados
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const lockedMap = new Map(authUsers.map(u => [u.id, u.user_metadata?.locked === true]))

  const accionVerbo: Record<string, string> = {
    CREATE: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó',
    LOGIN: 'Inició sesión', EXPORT: 'Exportó', UPLOAD: 'Subió archivo',
    RUN: 'Ejecutó', APPROVE: 'Aprobó', REJECT: 'Rechazó',
  }
  const entidadNombre: Record<string, string> = {
    usuario: 'usuario', proyecto: 'proyecto', cliente: 'cliente',
    proceso: 'proceso', artefacto: 'artefacto', documento: 'documento',
    discovery_job: 'Discovery AI', fase: 'fase',
  }
  // Solo campos legibles y no técnicos en el detalle — nunca IDs, UUIDs ni claves internas
  const esIdOInterno = (k: string, v: unknown) =>
    k === 'id' || k.endsWith('_id') || k.startsWith('_') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v))

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
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <UnlockButton usuarioId={u.id} locked={lockedMap.get(u.id) ?? false} />
                  {u.id !== user.id && <DeleteUserButton usuarioId={u.id} nombre={u.nombre} />}
                  <span className={`text-xs px-2 py-0.5 rounded border ${ROL_COLOR[u.rol] ?? ROL_COLOR.usuario_cliente}`}>
                    {ROL_LABEL[u.rol] ?? u.rol}
                  </span>
                  <span className="text-xs text-slate-400">{fecha(u.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        {totalPaginasUsuarios > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-400">Página {usuariosPage} de {totalPaginasUsuarios} · {totalUsuarios} usuarios en total</p>
            <div className="flex items-center gap-2">
              {usuariosPage > 1 ? (
                <Link href={`/admin?usuariosPage=${usuariosPage - 1}`} className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors">← Anterior</Link>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">← Anterior</span>
              )}
              {usuariosPage < totalPaginasUsuarios ? (
                <Link href={`/admin?usuariosPage=${usuariosPage + 1}`} className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors">Siguiente →</Link>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">Siguiente →</span>
              )}
            </div>
          </div>
        )}
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
                    <p className="text-xs text-slate-400">{cliente?.razon_social ?? '—'}</p>
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
              <p className="px-6 py-4 text-sm text-slate-400">Sin eventos registrados aún.</p>
            ) : (auditRecientes ?? []).map(a => {
              const verbo = accionVerbo[a.accion] ?? a.accion
              const entidad = entidadNombre[a.entidad] ?? a.entidad.replace(/_/g, ' ')
              const detalle = (a.detalle ?? {}) as Record<string, unknown>
              const camposBase = ['nombre', 'email', 'titulo', 'nombre_archivo']
              const detNombre = String(detalle.nombre ?? detalle.email ?? detalle.titulo ?? detalle.nombre_archivo ?? '').slice(0, 50)
              const extra = Object.entries(detalle)
                .filter(([k, v]) => !camposBase.includes(k) && !esIdOInterno(k, v))
                .slice(0, 2)
              const usuarioNombre = (a.usuario as unknown as { nombre: string } | null)?.nombre ?? 'Sistema'
              return (
                <div key={a.id} className="flex items-center justify-between px-6 py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-medium text-slate-200">{usuarioNombre}</span>
                      {' '}<span className="text-slate-400">{verbo}</span>{' '}
                      <span className="text-slate-300">{entidad}</span>
                      {detNombre && <span className="text-slate-400"> — {detNombre}</span>}
                    </p>
                    {extra.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {extra.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v).slice(0, 25)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{fecha(a.created_at)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
