import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FileText, FolderOpen, Brain, Layers, Sparkles, ArrowRight, AlertCircle, GitBranch, Clock, History, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import FaseWorkflow from '@/components/fases/FaseWorkflow'
import { getFasesProyecto } from '@/lib/fases'
import { getProcesosAceptadosIds, contarArtefactosDeProcesosAceptados, contarArtefactosAprobadosDeProcesosAceptados, contarModificacionesDeProcesosAceptados, obtenerUltimaActividadDeProcesosAceptados, obtenerHitosRecientesDeProcesosAceptados, obtenerUltimaSimulacionDeProcesosAceptados } from '@/lib/domain/procesos'
import { formatFechaRelativa } from '@/lib/format'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  hallazgo: 'Hallazgo', riesgo: 'Riesgo', brecha: 'Brecha', rol: 'Rol', proceso: 'Proceso', otro: 'Cambio',
}

function labelHito(origen: 'documento' | 'artefacto', tipo: string): string {
  if (origen === 'artefacto') return LABEL_ARTEFACTO[tipo as keyof typeof LABEL_ARTEFACTO] ?? tipo
  return TIPO_DOCUMENTO_LABEL[tipo?.toLowerCase()] ?? 'Cambio'
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol, usuario_proyecto(proyecto_id)')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const esSuperAdmin = usuario?.rol === 'super_admin'
  const proyectoIds = (usuario?.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)

  type ProyectoMeta = { id: string; nombre: string; estado_general: string; cliente: { razon_social?: string } | null }
  let proyectoMeta: ProyectoMeta | null = null
  let fases = null

  if (esSuperAdmin) {
    const { data: p } = await admin
      .from('proyecto')
      .select('id, nombre, estado_general, cliente:cliente_id(razon_social)')
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (p) { proyectoMeta = p as unknown as ProyectoMeta; fases = (await getFasesProyecto(p.id, usuario?.rol)).fases }
  } else if (proyectoIds.length > 0) {
    const { data: p } = await admin
      .from('proyecto')
      .select('id, nombre, estado_general, cliente:cliente_id(razon_social)')
      .in('id', proyectoIds)
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (p) { proyectoMeta = p as unknown as ProyectoMeta; fases = (await getFasesProyecto(p.id, usuario?.rol)).fases }
  }

  // Stats del proyecto activo
  let stats = { documentos: 0, docsListos: 0, procesosTotal: 0, procesosAprobados: 0, artefactos: 0 }
  let modificaciones = { documentos: 0, artefactos: 0, total: 0 }
  let ultimaActividad: string | null = null
  let hitosRecientes: Awaited<ReturnType<typeof obtenerHitosRecientesDeProcesosAceptados>> = []
  let ultimaSimulacion: Awaited<ReturnType<typeof obtenerUltimaSimulacionDeProcesosAceptados>> = null
  let artefactosAprobados = { aprobados: 0, total: 0 }
  if (proyectoMeta) {
    const [docsRes, docsListosRes, procesosRes, aceptados, totalArtefactos, modsRes, ultimaActividadRes, hitosRes, simulacionRes, artAprobadosRes] = await Promise.all([
      admin.from('documento').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoMeta.id),
      admin.from('documento').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoMeta.id).eq('estado_procesamiento', 'listo'),
      admin.from('proceso').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoMeta.id),
      getProcesosAceptadosIds(proyectoMeta.id),
      contarArtefactosDeProcesosAceptados(proyectoMeta.id),
      contarModificacionesDeProcesosAceptados(proyectoMeta.id),
      obtenerUltimaActividadDeProcesosAceptados(proyectoMeta.id),
      obtenerHitosRecientesDeProcesosAceptados(proyectoMeta.id, 3),
      obtenerUltimaSimulacionDeProcesosAceptados(proyectoMeta.id),
      contarArtefactosAprobadosDeProcesosAceptados(proyectoMeta.id),
    ])
    stats = {
      documentos: docsRes.count ?? 0,
      docsListos: docsListosRes.count ?? 0,
      procesosTotal: procesosRes.count ?? 0,
      procesosAprobados: aceptados.total,
      artefactos: totalArtefactos,
    }
    modificaciones = modsRes
    ultimaActividad = ultimaActividadRes
    hitosRecientes = hitosRes
    ultimaSimulacion = simulacionRes
    artefactosAprobados = artAprobadosRes
  }

  const faseActiva = fases?.find(f => f.status === 'activa')
  const fasesCompletadas = fases?.filter(f => f.status === 'completada').length ?? 0
  const totalFases = fases?.length ?? 6
  const pctGlobal = Math.round((fasesCompletadas / totalFases) * 100)
  const pctProcesos = stats.procesosTotal > 0 ? Math.round((stats.procesosAprobados / stats.procesosTotal) * 100) : 0

  // Salud del proyecto — semáforo que combina aprobación de procesos y de
  // artefactos en un solo número, en vez de obligar al cliente a mentalmente
  // cruzar el 80% de "Avance del proyecto" (que solo cuenta fases) con el
  // detalle de "Artefactos generados". Se promedian solo las dimensiones
  // que ya tienen datos — si aún no hay artefactos, no se castiga el score
  // por algo que todavía no corresponde medir.
  const pctArtefactosAprobados = artefactosAprobados.total > 0
    ? Math.round((artefactosAprobados.aprobados / artefactosAprobados.total) * 100)
    : null
  const dimensionesSalud = [
    stats.procesosTotal > 0 ? pctProcesos : null,
    pctArtefactosAprobados,
  ].filter((v): v is number => v !== null)
  const saludScore = dimensionesSalud.length > 0
    ? Math.round(dimensionesSalud.reduce((a, b) => a + b, 0) / dimensionesSalud.length)
    : null
  const salud = saludScore === null ? null : saludScore >= 80
    ? { label: 'Saludable', color: '#34d399', textColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
    : saludScore >= 50
      ? { label: 'En progreso', color: '#fbbf24', textColor: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
      : { label: 'Atención requerida', color: '#f87171', textColor: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  const RING_R = 26
  const RING_CIRC = 2 * Math.PI * RING_R
  const ringOffset = saludScore === null ? RING_CIRC : RING_CIRC * (1 - saludScore / 100)

  const kpis = [
    {
      label: 'Documentos cargados',
      value: stats.documentos,
      icon: FileText,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-900/40',
      href: '/documentos',
      sub: stats.documentos === 0 ? 'Sin documentos aún' : `${stats.documentos} archivo${stats.documentos !== 1 ? 's' : ''}`,
      subColor: stats.documentos === 0 ? 'text-amber-500' : 'text-slate-400',
    },
    {
      label: 'Procesos descubiertos',
      value: stats.procesosTotal,
      icon: Brain,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-900/40',
      href: '/discovery',
      sub: stats.procesosTotal > 0 ? `${stats.procesosAprobados} aprobados (${pctProcesos}%)` : 'Ejecuta Discovery AI',
      subColor: stats.procesosTotal === 0 ? 'text-slate-400' : pctProcesos === 100 ? 'text-emerald-400' : 'text-slate-400',
    },
    {
      label: 'Artefactos generados',
      value: stats.artefactos,
      icon: Layers,
      color: 'text-violet-400',
      bg: 'bg-violet-950/40 border-violet-900/40',
      href: '/artefactos',
      sub: stats.artefactos === 0 ? 'Sin artefactos aún' : `${stats.artefactos} artefacto${stats.artefactos !== 1 ? 's' : ''} metodológico${stats.artefactos !== 1 ? 's' : ''}`,
      subColor: 'text-slate-400',
    },
    {
      label: 'Avance del proyecto',
      value: `${pctGlobal}%`,
      icon: FolderOpen,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-900/40',
      href: null,
      sub: `${fasesCompletadas} de ${totalFases} fases completadas`,
      subColor: 'text-slate-400',
    },
    {
      label: 'Modificaciones incorporadas',
      value: modificaciones.total,
      icon: GitBranch,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-900/40',
      href: '/versiones',
      sub: modificaciones.total === 0
        ? 'Sin cambios registrados aún'
        : `${modificaciones.documentos} en documentos · ${modificaciones.artefactos} en artefactos`,
      subColor: 'text-slate-400',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {proyectoMeta
              ? <>Proyecto: <span className="text-slate-200 font-medium">{proyectoMeta.nombre}</span>{proyectoMeta.cliente?.razon_social && <> · {proyectoMeta.cliente.razon_social}</>}</>
              : `Bienvenido, ${usuario?.nombre}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {ultimaActividad && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400/80 bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5" /> Actividad: {formatFechaRelativa(ultimaActividad)}
            </span>
          )}
          <Link
            href="/bienvenida"
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ver resumen del proyecto
          </Link>
        </div>
      </div>

      {/* Salud del proyecto — semáforo visual que cruza aprobación de
          procesos y de artefactos en un solo vistazo, para que el cliente
          no tenga que ir a comparar dos pantallas distintas mentalmente. */}
      {salud && saludScore !== null && (
        <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${salud.bg} ${salud.border}`}>
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r={RING_R} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.06]" />
              <circle
                cx="32" cy="32" r={RING_R} fill="none" stroke={salud.color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{saludScore}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Salud del proyecto</p>
            <p className={`text-base font-semibold ${salud.textColor}`}>{salud.label}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {stats.procesosTotal > 0 && (
                <span className="text-[11px] text-slate-400">{stats.procesosAprobados}/{stats.procesosTotal} procesos aprobados</span>
              )}
              {pctArtefactosAprobados !== null && (
                <span className="text-[11px] text-slate-400">{artefactosAprobados.aprobados}/{artefactosAprobados.total} artefactos aprobados</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerta si no hay documentos */}
      {proyectoMeta && stats.documentos === 0 && (
        <div className="flex items-center gap-3 bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm flex-1">
            Sin documentos cargados. Para ejecutar Discovery AI necesitas subir al menos un documento del proyecto.
          </p>
          <Link href="/documentos" className="text-xs text-amber-400 hover:text-amber-300 underline shrink-0 flex items-center gap-1">
            Cargar ahora <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* KPI cards del proyecto */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          const inner = (
            <div className={`bg-slate-900 border ${kpi.bg} rounded-xl p-5 space-y-3 ${kpi.href ? 'hover:border-slate-600 transition-colors' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-xs uppercase tracking-wide">{kpi.label}</p>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className={`text-xs ${kpi.subColor}`}>{kpi.sub}</p>
            </div>
          )
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href}>{inner}</Link>
          ) : (
            <div key={kpi.label}>{inner}</div>
          )
        })}
      </div>

      {/* Impacto proyectado estimado — resumen de la última simulación de
          Horizonte de Impacto guardada por el equipo consultor. Es el dato
          que conecta todo el trabajo de fases anteriores con un resultado
          de negocio concreto, así que va destacado con su propio bloque en
          vez de camuflado como una KPI card más. Solo existe si el equipo
          consultor ya guardó una simulación — puede no haber ninguna. */}
      {ultimaSimulacion && (
        <Link
          href="/horizonte"
          className="relative overflow-hidden flex items-center justify-between gap-6 flex-wrap bg-gradient-to-r from-emerald-900/25 via-emerald-800/10 to-slate-900 border border-emerald-600/30 rounded-2xl p-6 hover:border-emerald-500/50 transition-colors group"
        >
          <div className="absolute right-0 top-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-emerald-300 uppercase tracking-widest font-medium">
                Impacto proyectado estimado · {ultimaSimulacion.procesoCodigo}
              </p>
              <h2 className="text-white text-base font-semibold mt-0.5">
                {ultimaSimulacion.headline || 'Simulación de impacto disponible'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">{formatFechaRelativa(ultimaSimulacion.fecha)}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-6 shrink-0">
            {ultimaSimulacion.ahorroAnualClp > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">
                  ${ultimaSimulacion.ahorroAnualClp.toLocaleString('es-CL')}
                </p>
                <p className="text-[11px] text-slate-400">ahorro anual estimado</p>
              </div>
            )}
            {ultimaSimulacion.reduccionTiempoPorcentaje > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">-{ultimaSimulacion.reduccionTiempoPorcentaje}%</p>
                <p className="text-[11px] text-slate-400">tiempo de proceso</p>
              </div>
            )}
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      )}

      {/* Fase activa — próximo paso destacado */}
      {faseActiva && (
        <div className="flex items-center gap-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <span className="text-indigo-300 text-sm font-bold">F{faseActiva.id}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Fase activa ahora</p>
            <p className="text-white font-semibold text-sm">{faseActiva.nombre}</p>
            <p className="text-slate-400 text-xs truncate">{faseActiva.descripcion}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-slate-400">Progreso</p>
              <p className="text-indigo-300 font-semibold">{faseActiva.progreso}%</p>
            </div>
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${faseActiva.progreso}%` }} />
            </div>
          </div>
          <Link
            href={faseActiva.href}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            Ir al módulo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* CTA próximo paso contextual — flujo: docs → analizar docs → discovery → aprobar */}
      {proyectoMeta && (() => {
        // Paso 1: sin documentos → ir a cargar
        if (stats.documentos === 0) return (
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-900/30 via-cyan-800/10 to-slate-900 border border-cyan-600/30 rounded-2xl p-6">
            <div className="absolute right-0 top-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-cyan-300 uppercase tracking-widest font-medium">Paso 1 · Fase 1</p>
                <h3 className="text-white text-base font-semibold">Carga los documentos del proyecto</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  Sube los documentos base: propuesta, diagnóstico, organigramas, manuales. El Centro Documental los organiza y la IA los analizará para extraer contexto del negocio.
                </p>
              </div>
              <Link href="/documentos" className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm shadow-lg shadow-cyan-900/30 shrink-0">
                Centro Documental <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )
        // Paso 2: hay docs (del super_admin o propios) → ir a Centro Documental a revisarlos y subir los propios
        if (stats.documentos > 0 && stats.procesosTotal === 0) return (
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-900/30 via-cyan-800/10 to-slate-900 border border-cyan-600/30 rounded-2xl p-6">
            <div className="absolute right-0 top-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-cyan-300 uppercase tracking-widest font-medium">Paso 2 · Fase 1 — {stats.documentos} doc{stats.documentos !== 1 ? 's' : ''} disponible{stats.documentos !== 1 ? 's' : ''}</p>
                <h3 className="text-white text-base font-semibold">Revisa los documentos del proyecto</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  Hay documentos cargados por el equipo consultor. Revísalos en el Centro Documental y sube los tuyos si tienes información adicional del negocio. Cuando estés listo, pasa a Process Discovery AI.
                </p>
              </div>
              <Link href="/documentos" className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm shadow-lg shadow-cyan-900/30 shrink-0">
                Centro Documental <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )
        // Paso 3: ya hay procesos descubiertos, o docs listos → ir a Discovery AI
        if (stats.docsListos > 0 && stats.procesosTotal === 0) return (
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-900/30 via-violet-800/10 to-slate-900 border border-violet-600/30 rounded-2xl p-6">
            <div className="absolute right-0 top-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-violet-300 uppercase tracking-widest font-medium">Paso 1 · Fase 2 — {stats.docsListos} doc{stats.docsListos !== 1 ? 's' : ''} analizado{stats.docsListos !== 1 ? 's' : ''}</p>
                <h3 className="text-white text-base font-semibold">Ejecuta el Process Discovery AI</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  Los documentos están analizados. Ahora ejecuta Discovery AI para que el sistema identifique automáticamente todos los procesos del negocio a partir del contenido.
                </p>
              </div>
              <Link href="/discovery" className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm shadow-lg shadow-violet-900/30 shrink-0">
                Process Discovery AI <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )
        // Paso 4: procesos descubiertos sin aprobar → revisar
        if (stats.procesosAprobados < stats.procesosTotal) return (
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900/30 via-emerald-800/10 to-slate-900 border border-emerald-600/30 rounded-2xl p-6">
            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-emerald-300 uppercase tracking-widest font-medium">Paso 2 · Fase 2 — {stats.procesosAprobados}/{stats.procesosTotal} aprobados</p>
                <h3 className="text-white text-base font-semibold">Revisa y aprueba los procesos descubiertos</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  La IA ya identificó {stats.procesosTotal} procesos. Revísalos, edítalos si es necesario y aprueba los que sean correctos para avanzar a la siguiente fase.
                </p>
              </div>
              <Link href="/discovery" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm shadow-lg shadow-emerald-900/30 shrink-0">
                Revisar procesos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )
        return null
      })()}

      {/* Actividad reciente — feed compacto de los últimos hitos reales
          (cambios de documento + ediciones de artefacto), misma fuente que
          Control de Versiones pero recortado a los 3 más recientes para que
          el Dashboard también se sienta un proyecto vivo, no solo un
          tablero de progreso estático. */}
      {hitosRecientes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-white">Actividad reciente</h2>
            </div>
            <Link href="/versiones" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              Ver todo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {hitosRecientes.map((h, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  h.origen === 'artefacto' ? 'bg-violet-500/15' : 'bg-sky-500/15'
                }`}>
                  <GitBranch className={`w-3 h-3 ${h.origen === 'artefacto' ? 'text-violet-400' : 'text-sky-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white">{h.procesoCodigo}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      h.origen === 'artefacto' ? 'text-violet-300 bg-violet-500/10' : 'text-sky-300 bg-sky-500/10'
                    }`}>{labelHito(h.origen, h.tipo)}</span>
                    <span className="text-[10px] text-slate-500">{formatFechaRelativa(h.fecha)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{h.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow de fases */}
      {proyectoMeta && fases ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Workflow del proyecto</h2>
          <FaseWorkflow fases={fases} hideProgressHeader />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400 text-sm">
            Sin proyecto activo asignado.{' '}
            {esSuperAdmin && (
              <Link href="/admin/onboarding" className="text-indigo-400 hover:underline">
                Crear cliente y proyecto
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
