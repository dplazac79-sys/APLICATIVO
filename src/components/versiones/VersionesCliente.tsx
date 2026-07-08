'use client'

import { useState, useMemo } from 'react'
import {
  GitBranch, Download, Clock, CheckCircle2, ChevronDown, ChevronRight,
  FileText, Layers, Sparkles, ArrowRight, RotateCcw, Loader2, Eye,
  ChevronUp, Brain, AlertCircle, Circle, Zap,
} from 'lucide-react'

/* ─── tipos ─────────────────────────────────────────────── */

interface Proceso {
  id: string
  nombre: string
  codigo: string | null
  orden: number
  estado_oferta: string
  created_at: string
  updated_at: string
  metadata_ia: Record<string, unknown> | null
}

interface Artefacto {
  id: string
  tipo: string
  version: number
  estado_validacion: string
  updated_at: string
  created_at: string
  proceso_id: string
  generado_por_ia: boolean
}

interface HistorialArtefacto {
  id: string
  artefacto_id: string
  tipo: string
  version: number
  motivo_cambio: string | null
  created_at: string
  proceso_id: string
  contenido?: Record<string, unknown>
}

interface HistorialProceso {
  id: string
  proceso_id: string
  version: number
  tipo_cambio: string
  descripcion: string
  detalle: Record<string, unknown> | null
  created_at: string
}

interface Props {
  procesos: Proceso[]
  artefactos: Artefacto[]
  historialArtefactos: HistorialArtefacto[]
  historialProcesos: HistorialProceso[]
  proyectoNombre: string
  clienteNombre: string
  rol: string
}

/* ─── constantes ─────────────────────────────────────────── */

const TIPO_LABELS: Record<string, string> = {
  sipoc: 'SIPOC',
  as_is: 'Proceso Actual (AS-IS)',
  bpmn: 'Diagrama BPMN',
  historias_usuario: 'Historias de Usuario',
  flujograma: 'Flujograma',
  raci: 'Matriz RACI',
  riesgo_control: 'Riesgo y Control',
  kpi_sla: 'KPI / SLA',
  diagnostico: 'Diagnóstico',
  to_be: 'Proceso Futuro (TO-BE)',
  dashboard_brechas: 'Dashboard de Brechas',
  cierre_ejecutivo: 'Cierre Ejecutivo',
  checklist: 'Checklist',
  backlog: 'Backlog',
  cinco_porques: '5 Porqués',
  acta_inicio: 'Acta de Inicio',
  plan_pruebas: 'Plan de Pruebas',
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  pendiente:  { label: 'En revisión',  color: 'text-amber-400',   dot: 'bg-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  validado:   { label: 'Aprobado',     color: 'text-sky-400',     dot: 'bg-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20' },
  publicado:  { label: 'Publicado',    color: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

const TIPO_CAMBIO_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  discovery_ia:      { icon: Brain,         color: 'text-violet-400', label: 'Análisis IA generado' },
  correccion_cliente:{ icon: Sparkles,      color: 'text-indigo-400', label: 'Correcciones del cliente aplicadas' },
  estado_oferta:     { icon: CheckCircle2,  color: 'text-emerald-400',label: 'Cambio de estado' },
  edicion_manual:    { icon: FileText,      color: 'text-sky-400',    label: 'Edición manual' },
  nueva_version:     { icon: GitBranch,     color: 'text-amber-400',  label: 'Nueva versión generada' },
}

const CAMPOS_OCULTOS = new Set(['updated_at', 'created_at', 'id', 'edges'])
const ROLES_INTERNOS = new Set(['super_admin', 'director_proyecto', 'consultor'])

/* ─── diff engine ────────────────────────────────────────── */

type DiffCampo = { campo: string; esArray: boolean; antes: string | string[]; despues: string | string[] }

function etiquetaLegible(item: unknown): string {
  if (typeof item === 'string') return item
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>
    if (obj.data && typeof obj.data === 'object') {
      const d = obj.data as Record<string, unknown>
      return d.actor ? `${d.label} (${d.actor})` : (d.label as string ?? '')
    }
    for (const key of ['descripcion', 'nombre', 'titulo', 'label', 'rol', 'nombre_kpi']) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string
    }
    return JSON.stringify(obj).slice(0, 80)
  }
  return String(item)
}

function calcularDiff(antes: Record<string, unknown>, despues: Record<string, unknown>): DiffCampo[] {
  const campos = Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)]))
  return campos.flatMap(campo => {
    if (CAMPOS_OCULTOS.has(campo)) return []
    const vA = antes[campo] ?? null
    const vD = despues[campo] ?? null
    if (JSON.stringify(vA) === JSON.stringify(vD)) return []
    const esArray = Array.isArray(vA) || Array.isArray(vD)
    const lista = (v: unknown) => Array.isArray(v) ? v.map(etiquetaLegible).filter(Boolean) : []
    const texto = (v: unknown) => {
      if (v === null || v === undefined) return '—'
      if (typeof v === 'string') return v.slice(0, 200)
      return JSON.stringify(v).slice(0, 200)
    }
    return [esArray
      ? { campo, esArray: true,  antes: lista(vA), despues: lista(vD) }
      : { campo, esArray: false, antes: texto(vA), despues: texto(vD) }]
  })
}

/* ─── utilidades de fecha ────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── primitivos UI ──────────────────────────────────────── */

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}>{children}</div>
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: 'text-slate-500', dot: 'bg-slate-500', bg: 'bg-slate-500/10 border-slate-500/20' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function VersionBadge({ v, latest }: { v: number; latest?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border
      ${latest ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-500'}`}>
      v{v}{latest && <CheckCircle2 className="w-3 h-3" />}
    </span>
  )
}

/* ─── Vista de cambios ───────────────────────────────────── */

function CambiosView({ diff }: { diff: DiffCampo[] }) {
  if (diff.length === 0) return <p className="text-slate-600 text-xs italic">Sin cambios de contenido detectados</p>
  return (
    <div className="space-y-3">
      {diff.map(d => (
        <div key={d.campo}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
            {d.campo.replace(/_/g, ' ')}
          </p>
          {d.esArray ? (
            <div className="space-y-0.5">
              {(d.antes as string[]).filter(x => !(d.despues as string[]).includes(x)).map((x, i) => (
                <div key={i} className="flex gap-1.5 items-start text-xs"><span className="text-red-500 shrink-0">−</span><span className="text-red-400/80 line-through">{x}</span></div>
              ))}
              {(d.despues as string[]).filter(x => !(d.antes as string[]).includes(x)).map((x, i) => (
                <div key={i} className="flex gap-1.5 items-start text-xs"><span className="text-emerald-500 shrink-0">+</span><span className="text-emerald-400">{x}</span></div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {(d.antes as string) !== '—' && <div className="flex gap-1.5 items-start text-xs"><span className="text-red-500 shrink-0">−</span><span className="text-red-400/80 line-through break-all">{d.antes as string}</span></div>}
              <div className="flex gap-1.5 items-start text-xs"><span className="text-emerald-500 shrink-0">+</span><span className="text-emerald-400 break-all">{d.despues as string}</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Fila de artefacto ──────────────────────────────────── */

function ArtefactoFila({
  artefacto, historial, rol,
}: {
  artefacto: Artefacto
  historial: HistorialArtefacto[]
  rol: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [diffsAbiertos, setDiffsAbiertos] = useState<Set<string>>(new Set())
  const [historialCargado, setHistorialCargado] = useState<HistorialArtefacto[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [restaurando, setRestaurando] = useState<string | null>(null)

  const label = TIPO_LABELS[artefacto.tipo] ?? artefacto.tipo
  const esInterno = ROLES_INTERNOS.has(rol)
  const tieneHistorial = historial.length > 0

  async function expandir() {
    if (!expanded && tieneHistorial && historialCargado === null) {
      setCargando(true)
      try {
        const r = await fetch(`/api/artefactos/${artefacto.id}/historial`)
        const d = await r.json()
        setHistorialCargado(d.historial ?? [])
      } catch { setHistorialCargado([]) }
      finally { setCargando(false) }
    }
    setExpanded(e => !e)
  }

  function getDiff(idx: number) {
    const entries = historialCargado ?? []
    if (!entries[idx]) return []
    const antes = entries[idx].contenido ?? {}
    const despues = idx === 0 ? {} : (entries[idx - 1].contenido ?? {})
    return calcularDiff(antes, despues)
  }

  async function restaurar(histId: string, v: number) {
    if (!confirm(`¿Restaurar v${v}? La versión actual se guardará en el historial.`)) return
    setRestaurando(histId)
    try {
      const r = await fetch(`/api/artefactos/${artefacto.id}/historial`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historial_id: histId }),
      })
      if (!r.ok) throw new Error()
      window.location.reload()
    } catch { alert('No se pudo restaurar'); setRestaurando(null) }
  }

  function handleDownload() {
    const blob = new Blob(
      [JSON.stringify({ tipo: artefacto.tipo, version: artefacto.version, generado: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${artefacto.tipo}_v${artefacto.version}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={expandir}
      >
        <FileText className="w-4 h-4 shrink-0 text-slate-500" />
        <span className="flex-1 text-sm text-slate-200 font-medium">{label}</span>

        <div className="flex items-center gap-2">
          <EstadoBadge estado={artefacto.estado_validacion} />
          <VersionBadge v={artefacto.version} latest />
          <span className="text-xs text-slate-700 hidden sm:block">{fmtDate(artefacto.updated_at)}</span>

          <button
            onClick={e => { e.stopPropagation(); handleDownload() }}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg border border-indigo-500/20 hover:border-indigo-400/40 hover:bg-indigo-500/10 transition-all"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:block">Descargar</span>
          </button>

          {tieneHistorial
            ? (expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />)
            : <div className="w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-4 bg-white/[0.01]">
          {cargando ? (
            <div className="flex items-center gap-2 py-3 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span className="text-xs text-slate-600">Cargando versiones…</span>
            </div>
          ) : !tieneHistorial ? (
            <p className="text-xs text-slate-600 italic text-center py-3">Primera versión — aún no hay versiones anteriores.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 uppercase tracking-wider mb-3">Versiones anteriores</p>
              {(historialCargado ?? []).map((h, idx) => {
                const diff = getDiff(idx)
                const abierto = diffsAbiertos.has(h.id)
                return (
                  <div key={h.id} className="rounded-xl bg-black/20 border border-white/[0.05] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <VersionBadge v={h.version} />
                          <span className="text-xs text-slate-600">{fmtDateTime(h.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {h.motivo_cambio ?? <span className="italic text-slate-600">Sin descripción registrada</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {diff.length > 0 && (
                          <button
                            onClick={() => setDiffsAbiertos(prev => { const n = new Set(prev); n.has(h.id) ? n.delete(h.id) : n.add(h.id); return n })}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors
                              ${abierto ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:block">{diff.length} cambios</span>
                          </button>
                        )}
                        {esInterno && (
                          <button
                            onClick={() => restaurar(h.id, h.version)}
                            disabled={restaurando === h.id}
                            title="Restaurar esta versión"
                            className="p-1.5 rounded-lg border border-white/10 text-slate-600 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                          >
                            {restaurando === h.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                    {abierto && (
                      <div className="border-t border-white/[0.05] px-3 py-3 bg-black/30">
                        <CambiosView diff={diff} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Timeline de eventos del proceso ───────────────────── */

function TimelineEvento({ evento, isLast }: {
  evento: { fecha: string; tipo: string; descripcion: string; detalle?: Record<string, unknown> | null }
  isLast: boolean
}) {
  const cfg = TIPO_CAMBIO_CONFIG[evento.tipo] ?? { icon: Circle, color: 'text-slate-500', label: evento.tipo }
  const Icon = cfg.icon

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-white/[0.06] mt-1 min-h-[20px]" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-xs text-slate-200 font-medium mb-0.5">{evento.descripcion}</p>
        <p className="text-xs text-slate-600">{fmtDateTime(evento.fecha)}</p>
      </div>
    </div>
  )
}

/* ─── Tarjeta de proceso ─────────────────────────────────── */

function ProcesoCard({
  proceso, artefactos, historialArtefactos, historialProcesos, defaultOpen, rol,
}: {
  proceso: Proceso
  artefactos: Artefacto[]
  historialArtefactos: HistorialArtefacto[]
  historialProcesos: HistorialProceso[]
  defaultOpen: boolean
  rol: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<'artefactos' | 'timeline'>('artefactos')

  // Versiones del proceso desde metadata_ia
  const versionesMeta = (proceso.metadata_ia?.versiones as Array<Record<string, unknown>> | undefined) ?? []

  // Timeline unificado: eventos de proceso_historial + versiones de metadata_ia
  const timeline = useMemo(() => {
    const eventos: Array<{ fecha: string; tipo: string; descripcion: string; detalle?: Record<string, unknown> | null }> = []

    // Creación del proceso
    eventos.push({
      fecha: proceso.created_at,
      tipo: 'discovery_ia',
      descripcion: 'Proceso identificado y analizado por IA',
    })

    // Versiones de metadata_ia (correcciones del cliente)
    for (const v of versionesMeta) {
      if ((v.numero as number) >= 2) {
        eventos.push({
          fecha: v.fecha as string,
          tipo: 'correccion_cliente',
          descripcion: v.descripcion as string ?? `Versión ${v.numero} generada`,
          detalle: v as Record<string, unknown>,
        })
      }
    }

    // proceso_historial
    for (const h of historialProcesos) {
      eventos.push({
        fecha: h.created_at,
        tipo: h.tipo_cambio,
        descripcion: h.descripcion,
        detalle: h.detalle,
      })
    }

    // Cambios de artefactos más relevantes (publicaciones)
    for (const a of artefactos) {
      if (a.estado_validacion === 'publicado') {
        eventos.push({
          fecha: a.updated_at,
          tipo: 'estado_oferta',
          descripcion: `${TIPO_LABELS[a.tipo] ?? a.tipo} publicado (v${a.version})`,
        })
      }
    }

    return eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  }, [proceso, versionesMeta, historialProcesos, artefactos])

  const totalVersiones = artefactos.reduce((s, a) => s + a.version, 0) + versionesMeta.length
  const ultimaActualizacion = artefactos.reduce(
    (latest, a) => (!latest || a.updated_at > latest ? a.updated_at : latest),
    proceso.updated_at
  )

  const artefactosPublicados = artefactos.filter(a => a.estado_validacion === 'publicado').length
  const artefactosTotal = artefactos.length

  return (
    <GlassCard>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors rounded-2xl"
      >
        {/* Código SC */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <span className="text-indigo-300 font-bold text-xs leading-tight text-center">
            {proceso.codigo ?? `P${proceso.orden + 1}`}
          </span>
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{proceso.nombre}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {artefactosPublicados}/{artefactosTotal} publicados
            </span>
            {ultimaActualizacion && (
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmtDate(ultimaActualizacion)}
              </span>
            )}
          </div>
        </div>

        {/* Progreso de artefactos */}
        <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {artefactosTotal > 0 ? (
              <>
                <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                    style={{ width: `${artefactosTotal > 0 ? (artefactosPublicados / artefactosTotal) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{Math.round(artefactosTotal > 0 ? (artefactosPublicados / artefactosTotal) * 100 : 0)}%</span>
              </>
            ) : (
              <span className="text-xs text-slate-700">Sin artefactos</span>
            )}
          </div>
          <span className="text-xs text-slate-600">{totalVersiones} versiones</span>
        </div>

        {open
          ? <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          : <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />}
      </button>

      {/* Contenido expandido */}
      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Tabs */}
          <div className="flex gap-1 px-5 py-3 border-b border-white/[0.06]">
            {([
              { id: 'artefactos', label: 'Artefactos', count: artefactosTotal },
              { id: 'timeline', label: 'Historial del proceso', count: timeline.length },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium
                  ${tab === t.id
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10'}`}
              >
                {t.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.05] text-slate-600'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            {tab === 'artefactos' && (
              <div className="space-y-2">
                {artefactos.length === 0 ? (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <AlertCircle className="w-4 h-4 text-slate-600" />
                    <p className="text-xs text-slate-600">Los artefactos se generarán durante la fase de Artefactos.</p>
                  </div>
                ) : (
                  artefactos.map(a => (
                    <ArtefactoFila
                      key={a.id}
                      artefacto={a}
                      historial={historialArtefactos.filter(h => h.artefacto_id === a.id)}
                      rol={rol}
                    />
                  ))
                )}
              </div>
            )}

            {tab === 'timeline' && (
              <div className="pt-2">
                {timeline.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">Sin eventos registrados aún.</p>
                ) : (
                  timeline.map((ev, idx) => (
                    <TimelineEvento key={`${ev.fecha}-${idx}`} evento={ev} isLast={idx === timeline.length - 1} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

/* ─── Componente principal ───────────────────────────────── */

export default function VersionesCliente({
  procesos, artefactos, historialArtefactos, historialProcesos,
  proyectoNombre, clienteNombre, rol,
}: Props) {
  const artefactosPorProceso = useMemo(() => {
    const map: Record<string, Artefacto[]> = {}
    for (const a of artefactos) {
      if (!map[a.proceso_id]) map[a.proceso_id] = []
      map[a.proceso_id].push(a)
    }
    return map
  }, [artefactos])

  const totalArtefactos    = artefactos.length
  const totalPublicados    = artefactos.filter(a => a.estado_validacion === 'publicado').length
  const totalVersiones     = artefactos.reduce((s, a) => s + a.version, 0) + historialProcesos.length
  const totalCambios       = historialArtefactos.length + historialProcesos.length

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-x-hidden">
      {/* Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 uppercase tracking-wider">
            <GitBranch className="w-3.5 h-3.5" />
            <span>{clienteNombre || proyectoNombre}</span>
            <ArrowRight className="w-3 h-3" />
            <span>Control de Versiones</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Control de Versiones</h1>
          <p className="text-slate-500 text-sm max-w-xl">
            Cada proceso, cada artefacto y cada cambio realizado — organizado por proceso, con el historial completo de qué se modificó y cuándo.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Procesos activos',    value: procesos.length, icon: Zap,          color: 'text-indigo-400' },
            { label: 'Artefactos totales',  value: totalArtefactos, icon: Layers,        color: 'text-violet-400' },
            { label: 'Publicados',          value: totalPublicados, icon: CheckCircle2,  color: 'text-emerald-400' },
            { label: 'Cambios registrados', value: totalCambios,    icon: GitBranch,     color: 'text-amber-400' },
          ].map(s => (
            <GlassCard key={s.label} className="px-4 py-3 flex flex-col gap-1.5">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </GlassCard>
          ))}
        </div>

        {/* Leyenda de estados */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2 h-2 rounded-full ${v.dot}`} />
              {v.label}
            </div>
          ))}
          <span className="text-xs text-slate-700">· La versión más reciente de cada artefacto es la entrega oficial.</span>
        </div>

        {/* Lista de procesos */}
        <div className="space-y-4">
          {procesos.map((p, idx) => (
            <ProcesoCard
              key={p.id}
              proceso={p}
              artefactos={artefactosPorProceso[p.id] ?? []}
              historialArtefactos={historialArtefactos}
              historialProcesos={historialProcesos.filter(h => h.proceso_id === p.id)}
              defaultOpen={idx === 0}
              rol={rol}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
