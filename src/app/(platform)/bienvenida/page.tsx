export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import FaseWorkflow from '@/components/fases/FaseWorkflow'
import Saludo from './Saludo'
import ResumenProyecto from './ResumenProyecto'
import { getFasesProyecto } from '@/lib/fases'

export default async function BienvenidaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol, usuario_proyecto(proyecto_id)')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const esSuperAdmin = usuario?.rol === 'super_admin'
  const proyectoIds = (usuario?.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)

  let proyectoMeta = null
  let fases = null

  const selectProyecto = 'id, nombre, estado_general, descripcion, contexto, objetivos, alcance_incluye, alcance_excluye, n_procesos_estimados, fecha_inicio, fecha_estimada_cierre, cliente:cliente_id(razon_social, industria)'

  if (esSuperAdmin) {
    const { data: p } = await admin
      .from('proyecto')
      .select(selectProyecto)
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (p) { proyectoMeta = p; fases = (await getFasesProyecto(p.id)).fases }
  } else if (proyectoIds.length > 0) {
    const { data: p } = await admin
      .from('proyecto')
      .select(selectProyecto)
      .eq('estado_general', 'activo')
      .in('id', proyectoIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (p) { proyectoMeta = p; fases = (await getFasesProyecto(p.id)).fases }
  }

  // Bitácora para super_admin
  let bitacora: { id: number; accion: string; entidad: string; detalle: Record<string, unknown>; created_at: string; usuario: { nombre: string } | null }[] = []
  if (esSuperAdmin) {
    const { data: logs } = await admin
      .from('audit_log')
      .select('id, accion, entidad, detalle, created_at, usuario:usuario_id(nombre)')
      .order('created_at', { ascending: false })
      .limit(30)
    bitacora = (logs ?? []) as unknown as typeof bitacora
  }

  let equipo: { nombre: string; rol: string }[] = []
  if (proyectoMeta) {
    const { data: miembros } = await admin
      .from('usuario_proyecto')
      .select('usuario:usuario_id(nombre, rol)')
      .eq('proyecto_id', proyectoMeta.id)
    equipo = (miembros ?? []).map((m: any) => ({ nombre: m.usuario?.nombre ?? '', rol: m.usuario?.rol ?? '' }))
  }

  const nombre = usuario?.nombre?.split(' ')[0] ?? 'Equipo'
  const cliente = proyectoMeta?.cliente as { razon_social?: string; industria?: string } | null

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-4 md:p-8">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-violet-500 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="text-xs text-indigo-300 font-medium uppercase tracking-widest">APAC — Aplicativo Consultivo</span>
              </div>
              <Saludo nombre={nombre} />
              {proyectoMeta ? (
                <p className="text-slate-400 mt-2 text-base">
                  Proyecto activo: <span className="text-slate-200 font-medium">{proyectoMeta.nombre}</span>
                  {cliente?.razon_social && (
                    <> · <span className="text-slate-300">{cliente.razon_social}</span></>
                  )}
                </p>
              ) : (
                <p className="text-slate-400 mt-2">No hay proyectos activos asignados aún.</p>
              )}
            </div>

            {proyectoMeta && (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shrink-0"
              >
                Ir al dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {proyectoMeta && fases && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-800">
              {[
                {
                  label: 'Fase actual',
                  value: `F${fases.find(f => f.status === 'activa')?.id ?? '—'}`,
                  sub: fases.find(f => f.status === 'activa')?.nombre ?? 'Sin fase activa',
                },
                {
                  label: 'Completadas',
                  value: `${fases.filter(f => f.status === 'completada').length}/${fases.length}`,
                  sub: 'fases del proyecto',
                },
                {
                  label: 'Progreso global',
                  value: `${Math.round((fases.filter(f => f.status === 'completada').length / fases.length) * 100)}%`,
                  sub: 'de avance metodológico',
                },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{m.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{m.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {proyectoMeta && fases ? (
        <div className="space-y-6">
          <ResumenProyecto proyecto={proyectoMeta as any} cliente={cliente} equipo={equipo} rol={usuario?.rol ?? ''} />
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Workflow de fases</h2>
              <p className="text-sm text-slate-400 mt-0.5">Avanza fase por fase. Las fases se desbloquean al completar los requisitos de la anterior.</p>
            </div>
            <FaseWorkflow fases={fases} />
          </div>
        </div>
      ) : !esSuperAdmin ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-950 rounded-2xl flex items-center justify-center mx-auto text-2xl">🏗️</div>
          <div>
            <h3 className="text-white font-semibold">Sin proyecto asignado</h3>
            <p className="text-slate-400 text-sm mt-1">Un administrador debe crear un proyecto y asignarte a él para comenzar.</p>
          </div>
        </div>
      ) : null}

      {/* Bitácora siempre visible para super_admin */}
      {esSuperAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Bitácora del sistema</h2>
              <p className="text-sm text-slate-400 mt-0.5">Últimas {bitacora.length} acciones registradas en tiempo real</p>
            </div>
            <Link
              href="/admin/onboarding"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0"
            >
              Nuevo cliente <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {bitacora.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 text-sm">No hay actividad registrada aún.</p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-800/60">
                {bitacora.map((log) => {
                  const accionLabel: Record<string, string> = {
                    CREATE: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó',
                    LOGIN: 'Inició sesión', EXPORT: 'Exportó', UPLOAD: 'Subió archivo',
                  }
                  const entidadLabel: Record<string, string> = {
                    usuario: 'usuario', proyecto: 'proyecto', cliente: 'cliente',
                    proceso: 'proceso', artefacto: 'artefacto', documento: 'documento',
                    audit_log: 'registro de auditoría',
                  }
                  const verbo = accionLabel[log.accion] ?? log.accion
                  const entidad = entidadLabel[log.entidad] ?? log.entidad.replace(/_/g, ' ')
                  const detalleNombre = (log.detalle?.nombre ?? log.detalle?.email ?? log.detalle?.titulo ?? '') as string
                  const ahora = new Date()
                  const fecha = new Date(log.created_at)
                  const diffMin = Math.floor((ahora.getTime() - fecha.getTime()) / 60000)
                  const tiempoRelativo = diffMin < 1 ? 'hace un momento'
                    : diffMin < 60 ? `hace ${diffMin} min`
                    : diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)}h`
                    : fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })

                  return (
                    <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                        log.accion === 'CREATE' ? 'bg-emerald-400' :
                        log.accion === 'DELETE' ? 'bg-red-400' :
                        log.accion === 'UPDATE' ? 'bg-blue-400' :
                        log.accion === 'LOGIN'  ? 'bg-indigo-400' :
                        log.accion === 'UPLOAD' ? 'bg-amber-400' :
                        'bg-slate-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">
                          <span className="font-medium text-white">{log.usuario?.nombre ?? 'Sistema'}</span>
                          {' '}{verbo}{' '}
                          <span className="text-slate-300">{entidad}</span>
                          {detalleNombre && (
                            <span className="text-slate-400"> · <span className="italic">{String(detalleNombre).slice(0, 60)}</span></span>
                          )}
                        </p>
                        {log.detalle && Object.keys(log.detalle).length > 0 && (
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {Object.entries(log.detalle)
                              .filter(([k]) => !['nombre', 'email', 'titulo'].includes(k))
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">{tiempoRelativo}</p>
                        <p className="text-xs text-slate-700 mt-0.5">
                          {fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
