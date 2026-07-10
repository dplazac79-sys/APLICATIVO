export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Circle, Lock, ChevronRight, FolderKanban } from 'lucide-react'
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
      .limit(50)
    bitacora = (logs ?? []) as unknown as typeof bitacora
  }

  let equipo: { nombre: string; rol: string }[] = []
  let statsProyecto = { documentos: 0, procesos: 0, procesosAprobados: 0, artefactos: 0 }

  if (proyectoMeta) {
    const [miembrosRes, docsRes, procesosRes] = await Promise.all([
      admin.from('usuario_proyecto').select('usuario:usuario_id(nombre, rol)').eq('proyecto_id', proyectoMeta.id),
      admin.from('documento').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoMeta.id),
      admin.from('proceso').select('id, estado_oferta', { count: 'exact' }).eq('proyecto_id', proyectoMeta.id),
    ])
    equipo = (miembrosRes.data ?? []).map((m: any) => ({ nombre: m.usuario?.nombre ?? '', rol: m.usuario?.rol ?? '' }))
    // Artefactos solo de procesos aceptados — misma convención que Process Architect,
    // para que "artefactos generados" signifique lo mismo en toda la app.
    const idsAceptados = (procesosRes.data ?? []).filter((p: any) => p.estado_oferta === 'aceptado').map((p: any) => p.id)
    const artefactosRes = idsAceptados.length > 0
      ? await admin.from('artefacto').select('id', { count: 'exact', head: true }).in('proceso_id', idsAceptados)
      : { count: 0 }
    statsProyecto = {
      documentos: docsRes.count ?? 0,
      procesos: procesosRes.count ?? 0,
      procesosAprobados: idsAceptados.length,
      artefactos: artefactosRes.count ?? 0,
    }
  }

  const nombre = usuario?.nombre?.split(' ')[0] ?? 'Equipo'
  const cliente = proyectoMeta?.cliente as { razon_social?: string; industria?: string } | null

  // Cálculo de estado de fases para el carril de bienvenida
  const faseActiva = fases?.find(f => f.status === 'activa') ?? null
  const fasesCompletadas = fases?.filter(f => f.status === 'completada') ?? []
  const fasesBloqueadas = fases?.filter(f => f.status === 'bloqueada') ?? []
  const pctProgreso = fases ? Math.round((fasesCompletadas.length / fases.length) * 100) : 0

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-7">
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Saludo nombre={nombre} />
              {proyectoMeta ? (
                <p className="text-slate-400 mt-2 text-base">
                  Proyecto activo: <span className="text-slate-200 font-medium">{proyectoMeta.nombre}</span>
                  {cliente?.razon_social && <> · <span className="text-slate-300">{cliente.razon_social}</span></>}
                </p>
              ) : (
                <p className="text-slate-400 mt-2">No hay proyectos activos asignados aún.</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {proyectoMeta && (
                <Link href="/dashboard" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                  Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              {esSuperAdmin && (
                <Link href="/admin/onboarding" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                  + Nuevo cliente
                </Link>
              )}
            </div>
          </div>
          {proyectoMeta && fases && (
            <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
              {/* Barra de progreso global */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all"
                    style={{ width: `${pctProgreso}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 shrink-0 font-mono">{fasesCompletadas.length}/{fases.length} fases · {pctProgreso}%</span>
              </div>

              {/* Carril de fases */}
              <div className="flex items-start gap-1 flex-wrap">
                {fases.map((fase, idx) => {
                  const esActiva = fase.status === 'activa'
                  const esCompleta = fase.status === 'completada'
                  const esBloqueada = fase.status === 'bloqueada'
                  return (
                    <div key={fase.id} className="flex items-center gap-1">
                      <Link
                        href={esBloqueada ? '#' : fase.href}
                        aria-disabled={esBloqueada}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          esCompleta
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-950'
                            : esActiva
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/50 ring-1 ring-indigo-500/30 hover:bg-indigo-600/30'
                            : 'bg-slate-800/40 text-slate-600 border border-slate-800 pointer-events-none'
                        }`}
                      >
                        {esCompleta ? (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        ) : esActiva ? (
                          <ChevronRight className="w-3 h-3 shrink-0 animate-pulse" />
                        ) : (
                          <Lock className="w-3 h-3 shrink-0" />
                        )}
                        <span>F{fase.id}</span>
                        {(esCompleta || esActiva) && (
                          <span className={`hidden sm:inline ${esActiva ? 'text-indigo-400' : 'text-emerald-500'}`}>
                            · {fase.nombre}
                          </span>
                        )}
                      </Link>
                      {idx < fases.length - 1 && (
                        <span className="text-slate-700 text-xs">›</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Próximo paso */}
              {faseActiva && (
                <div className="flex items-center gap-2 bg-indigo-950/30 border border-indigo-800/30 rounded-lg px-3 py-2">
                  <Circle className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-xs text-slate-400">Próximo paso:</span>
                  <Link href={faseActiva.href} className="text-xs text-indigo-300 font-medium hover:text-indigo-200 transition-colors">
                    F{faseActiva.id} — {faseActiva.nombre}
                  </Link>
                  {fasesBloqueadas.length > 0 && (
                    <span className="ml-auto text-xs text-slate-600">{fasesBloqueadas.length} fase{fasesBloqueadas.length > 1 ? 's' : ''} bloqueada{fasesBloqueadas.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Layout principal */}
      {esSuperAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Columna izquierda: resumen proyecto */}
          <div className="space-y-6">
            {proyectoMeta && fases ? (
              <ResumenProyecto proyecto={proyectoMeta as any} cliente={cliente} equipo={equipo} rol={usuario?.rol ?? ''} stats={statsProyecto} faseActual={fases?.find(f => f.status === 'activa') ?? null} />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-indigo-950 rounded-2xl flex items-center justify-center mx-auto">
                  <FolderKanban className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-white font-medium text-sm">Sin proyecto activo</p>
                <p className="text-slate-400 text-xs">Crea un cliente y proyecto desde el onboarding.</p>
              </div>
            )}
          </div>

          {/* Columna derecha: bitácora */}
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-white">Bitácora de actividad</h2>
              <p className="text-xs text-slate-500 mt-0.5">{bitacora.length} acciones recientes en el sistema</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {bitacora.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm">Sin actividad registrada aún.</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {bitacora.map((log, i) => {
                    const verbo = accionVerbo[log.accion] ?? log.accion
                    const entidad = entidadNombre[log.entidad] ?? log.entidad.replace(/_/g, ' ')
                    const detNombre = String(log.detalle?.nombre ?? log.detalle?.email ?? log.detalle?.titulo ?? log.detalle?.nombre_archivo ?? '').slice(0, 50)
                    const fecha = new Date(log.created_at)
                    const diffMin = Math.floor((Date.now() - fecha.getTime()) / 60000)
                    const cuando = diffMin < 1 ? 'ahora mismo'
                      : diffMin < 60 ? `hace ${diffMin} min`
                      : diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)}h`
                      : fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                    const colorDot = log.accion === 'CREATE' ? 'bg-emerald-400'
                      : log.accion === 'DELETE' ? 'bg-red-400'
                      : log.accion === 'UPDATE' ? 'bg-blue-400'
                      : log.accion === 'LOGIN' ? 'bg-indigo-400'
                      : log.accion === 'RUN' ? 'bg-violet-400'
                      : 'bg-slate-500'
                    return (
                      <div key={log.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors ${i < bitacora.length - 1 ? 'border-b border-slate-800/60' : ''}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colorDot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 leading-snug">
                            <span className="font-semibold text-white">{log.usuario?.nombre ?? 'Sistema'}</span>
                            {' '}<span className="text-slate-400">{verbo}</span>{' '}
                            <span className="text-slate-300">{entidad}</span>
                            {detNombre && <span className="text-slate-500"> — {detNombre}</span>}
                          </p>
                          {(() => {
                            // Solo campos legibles y no técnicos: nunca IDs, UUIDs ni claves internas
                            const esIdOInterno = (k: string, v: unknown) =>
                              k === 'id' || k.endsWith('_id') || k.startsWith('_') ||
                              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v))
                            const extra = Object.entries(log.detalle ?? {})
                              .filter(([k, v]) => !['nombre','email','titulo','nombre_archivo'].includes(k) && !esIdOInterno(k, v))
                              .slice(0, 2)
                            return extra.length > 0 ? (
                              <p className="text-xs text-slate-600 mt-0.5 truncate">
                                {extra.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v).slice(0, 25)}`).join(' · ')}
                              </p>
                            ) : null
                          })()}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs text-slate-500 whitespace-nowrap">{cuando}</p>
                          <p className="text-xs text-slate-700">{fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : proyectoMeta && fases ? (
        /* Vista cliente: ResumenProyecto + CTA prominente a Dashboard */
        <div className="space-y-4">
          <ResumenProyecto proyecto={proyectoMeta as any} cliente={cliente} equipo={equipo} rol={usuario?.rol ?? ''} stats={statsProyecto} faseActual={fases?.find(f => f.status === 'activa') ?? null} />

          {/* CTA: siguiente paso hacia Dashboard */}
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/40 via-indigo-800/20 to-slate-900 border border-indigo-500/30 rounded-2xl p-6">
            <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-indigo-300 uppercase tracking-widest font-medium">Siguiente paso</p>
                <h3 className="text-white text-lg font-semibold">Revisa el avance del proyecto</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  En el Dashboard verás el progreso detallado de cada fase, los documentos cargados, los procesos descubiertos y el próximo módulo a trabajar.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold px-6 py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/40 shrink-0"
              >
                Ir al Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-950 rounded-2xl flex items-center justify-center mx-auto">
            <FolderKanban className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Sin proyecto asignado</h3>
            <p className="text-slate-400 text-sm mt-1">Un administrador debe crear un proyecto y asignarte a él para comenzar.</p>
          </div>
        </div>
      )}

    </div>
  )
}
