'use client'

import { useState, useMemo } from 'react'
import {
  GitBranch,
  Download,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Loader2,
  Eye,
  ChevronUp,
} from 'lucide-react'

/* ─── tipos ─────────────────────────────────────────────── */

interface Proceso {
  id: string
  nombre: string
  codigo: string | null
}

interface Artefacto {
  id: string
  tipo: string
  version: number
  estado_validacion: string
  updated_at: string
  proceso_id: string
}

interface HistorialEntry {
  id: string
  artefacto_id: string
  tipo: string
  version: number
  motivo_cambio: string | null
  created_at: string
  proceso_id: string
  contenido?: Record<string, unknown>
}

interface Props {
  procesos: Proceso[]
  artefactos: Artefacto[]
  historial: HistorialEntry[]
  proyectoNombre: string
  clienteNombre: string
  rol: string
}

/* ─── labels ─────────────────────────────────────────────── */

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

const TIPO_ICON_COLOR: Record<string, string> = {
  bpmn: 'text-violet-400',
  to_be: 'text-emerald-400',
  kpi_sla: 'text-amber-400',
  raci: 'text-sky-400',
  diagnostico: 'text-rose-400',
  sipoc: 'text-indigo-400',
  as_is: 'text-orange-400',
  cierre_ejecutivo: 'text-teal-400',
}

const NOMBRE_CAMPO: Record<string, string> = {
  nodes: 'Pasos del diagrama',
  titulo: 'Título',
  proveedores: 'Proveedores',
  entradas: 'Entradas',
  proceso: 'Descripción del proceso',
  salidas: 'Salidas',
  clientes: 'Clientes / Destinatarios',
  notas: 'Notas',
  limite_entrada: 'Inicio del proceso',
  limite_salida: 'Fin del proceso',
  descripcion_estado_actual: 'Estado actual',
  actores: 'Actores involucrados',
  sistemas_involucrados: 'Sistemas utilizados',
  pasos: 'Pasos del proceso',
  puntos_dolor: 'Problemas actuales',
  tiempo_ciclo_actual: 'Tiempo de ciclo actual',
  volumen_transacciones: 'Volumen de transacciones',
  descripcion_estado_futuro: 'Estado futuro',
  sistemas_requeridos: 'Sistemas requeridos',
  mejoras_respecto_asis: 'Mejoras respecto al estado actual',
  tiempo_ciclo_objetivo: 'Tiempo de ciclo objetivo',
  reduccion_estimada: 'Reducción estimada',
  historias: 'Historias de usuario',
  actividades: 'Actividades',
  roles: 'Roles',
  riesgos: 'Riesgos identificados',
}

const CAMPOS_OCULTOS = new Set(['updated_at', 'created_at', 'id', 'edges'])
const ROLES_INTERNOS = new Set(['super_admin', 'director_proyecto', 'consultor'])

/* ─── diff engine ────────────────────────────────────────── */

type DiffCampo = {
  campo: string
  esArray: boolean
  antes: string | string[]
  despues: string | string[]
}

function etiquetaLegible(item: unknown): string {
  if (typeof item === 'string') return item
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>
    if (obj.data && typeof obj.data === 'object') {
      const d = obj.data as Record<string, unknown>
      return d.actor ? `${d.label} (${d.actor})` : (d.label as string ?? '')
    }
    for (const key of ['descripcion', 'nombre', 'titulo', 'label', 'rol', 'problema', 'nombre_kpi']) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string
    }
    return JSON.stringify(obj).slice(0, 80)
  }
  return String(item)
}

function valorALista(v: unknown): string[] {
  if (v === null || v === undefined) return []
  if (Array.isArray(v)) return v.map(etiquetaLegible).filter(Boolean)
  return []
}

function resumirTexto(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v.slice(0, 200) + (v.length > 200 ? '…' : '')
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v).slice(0, 200)
}

function calcularDiff(antes: Record<string, unknown>, despues: Record<string, unknown>): DiffCampo[] {
  const cambios: DiffCampo[] = []
  const campos = Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)]))
  for (const campo of campos) {
    if (CAMPOS_OCULTOS.has(campo)) continue
    const vA = antes[campo] ?? null
    const vD = despues[campo] ?? null
    if (JSON.stringify(vA) === JSON.stringify(vD)) continue
    const esArray = Array.isArray(vA) || Array.isArray(vD)
    cambios.push(esArray
      ? { campo, esArray: true, antes: valorALista(vA), despues: valorALista(vD) }
      : { campo, esArray: false, antes: resumirTexto(vA), despues: resumirTexto(vD) }
    )
  }
  return cambios
}

/* ─── Glass primitive ────────────────────────────────────── */

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}>
      {children}
    </div>
  )
}

function VersionBadge({ v, isCurrent }: { v: number; isCurrent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border
      ${isCurrent
        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
        : 'bg-white/5 border-white/10 text-slate-500'}`}>
      v{v}
      {isCurrent && <CheckCircle2 className="w-3 h-3" />}
    </span>
  )
}

/* ─── Componente de diff visual ──────────────────────────── */

function DiffView({ diff }: { diff: DiffCampo[] }) {
  if (diff.length === 0) return (
    <p className="text-slate-600 text-xs italic">Sin cambios de contenido detectados</p>
  )
  return (
    <div className="space-y-3">
      {diff.map(d => (
        <div key={d.campo}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
            {NOMBRE_CAMPO[d.campo] ?? d.campo.replace(/_/g, ' ')}
          </p>
          {d.esArray ? (
            <div className="space-y-0.5">
              {(d.antes as string[]).filter(x => !(d.despues as string[]).includes(x)).map((x, i) => (
                <div key={i} className="flex gap-1.5 items-start text-xs">
                  <span className="text-red-500 shrink-0">−</span>
                  <span className="text-red-400/80 line-through leading-snug">{x}</span>
                </div>
              ))}
              {(d.despues as string[]).filter(x => !(d.antes as string[]).includes(x)).map((x, i) => (
                <div key={i} className="flex gap-1.5 items-start text-xs">
                  <span className="text-emerald-500 shrink-0">+</span>
                  <span className="text-emerald-400 leading-snug">{x}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {(d.antes as string) !== '—' && (
                <div className="flex gap-1.5 items-start text-xs">
                  <span className="text-red-500 shrink-0">−</span>
                  <span className="text-red-400/80 line-through leading-snug break-all">{d.antes as string}</span>
                </div>
              )}
              <div className="flex gap-1.5 items-start text-xs">
                <span className="text-emerald-500 shrink-0">+</span>
                <span className="text-emerald-400 leading-snug break-all">{d.despues as string}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Fila de artefacto ──────────────────────────────────── */

function ArtefactoRow({
  artefacto,
  historialEntries,
  rol,
  contenidoActual,
}: {
  artefacto: Artefacto
  historialEntries: HistorialEntry[]
  rol: string
  contenidoActual: Record<string, unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const [diffsAbiertos, setDiffsAbiertos] = useState<Set<string>>(new Set())
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [historialCargado, setHistorialCargado] = useState<HistorialEntry[] | null>(null)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const label = TIPO_LABELS[artefacto.tipo] ?? artefacto.tipo
  const color = TIPO_ICON_COLOR[artefacto.tipo] ?? 'text-slate-400'
  const tieneHistorial = historialEntries.length > 0
  const esInterno = ROLES_INTERNOS.has(rol)

  async function cargarHistorialConContenido() {
    if (historialCargado !== null) return
    setCargandoHistorial(true)
    try {
      const res = await fetch(`/api/artefactos/${artefacto.id}/historial`)
      const d = await res.json()
      setHistorialCargado(d.historial ?? [])
    } catch {
      setHistorialCargado([])
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function handleExpand() {
    if (!expanded && tieneHistorial) {
      await cargarHistorialConContenido()
    }
    setExpanded(e => !e)
  }

  function toggleDiff(id: string) {
    setDiffsAbiertos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function restaurar(histId: string, version: number) {
    if (!confirm(`¿Restaurar v${version}? La versión actual se guardará en el historial antes de ser reemplazada.`)) return
    setRestaurando(histId)
    try {
      const res = await fetch(`/api/artefactos/${artefacto.id}/historial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historial_id: histId }),
      })
      if (!res.ok) throw new Error()
      window.location.reload()
    } catch {
      alert('No se pudo restaurar la versión')
      setRestaurando(null)
    }
  }

  function getDiff(idx: number): DiffCampo[] {
    const entries = historialCargado ?? []
    if (entries.length === 0) return []
    const antes = entries[idx].contenido ?? {}
    const despues = idx === 0 ? contenidoActual : (entries[idx - 1].contenido ?? {})
    return calcularDiff(antes, despues)
  }

  function handleDownload() {
    const blob = new Blob(
      [JSON.stringify({ tipo: artefacto.tipo, version: artefacto.version, exportado: new Date().toISOString(), contenido: contenidoActual }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artefacto.tipo}_v${artefacto.version}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden transition-all">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={handleExpand}
      >
        <FileText className={`w-4 h-4 shrink-0 ${color}`} />
        <span className="flex-1 text-sm text-slate-200 font-medium">{label}</span>

        <div className="flex items-center gap-3">
          <VersionBadge v={artefacto.version} isCurrent />
          <span className="text-xs text-slate-600 hidden sm:block">
            {new Date(artefacto.updated_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>

          <button
            onClick={e => { e.stopPropagation(); handleDownload() }}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Descargar</span>
          </button>

          {tieneHistorial
            ? (expanded
              ? <ChevronDown className="w-4 h-4 text-slate-500" />
              : <ChevronRight className="w-4 h-4 text-slate-500" />)
            : <div className="w-4" />}
        </div>
      </div>

      {/* Historial expandido */}
      {expanded && tieneHistorial && (
        <div className="border-t border-white/[0.06] px-4 py-4 space-y-3 bg-white/[0.02]">
          <p className="text-xs text-slate-600 uppercase tracking-wider">Historial de cambios</p>

          {cargandoHistorial && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span className="text-xs text-slate-600">Cargando versiones…</span>
            </div>
          )}

          {(historialCargado ?? []).map((h, idx) => {
            const diff = getDiff(idx)
            const diffAbierto = diffsAbiertos.has(h.id)

            return (
              <div key={h.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* timeline dot */}
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <VersionBadge v={h.version} />
                      <span className="text-xs text-slate-600">
                        {new Date(h.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {h.motivo_cambio
                      ? <p className="text-xs text-slate-400">{h.motivo_cambio}</p>
                      : <p className="text-xs text-slate-600 italic">Sin descripción</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Ver diff */}
                    <button
                      onClick={() => toggleDiff(h.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors
                        ${diffAbierto
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                          : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'}`}
                    >
                      <Eye className="w-3 h-3" />
                      <span className="hidden sm:block">{diff.length} cambios</span>
                    </button>

                    {/* Restaurar — solo roles internos */}
                    {esInterno && (
                      <button
                        onClick={() => restaurar(h.id, h.version)}
                        disabled={restaurando === h.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                        title="Restaurar esta versión"
                      >
                        {restaurando === h.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RotateCcw className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Diff expandido */}
                {diffAbierto && (
                  <div className="border-t border-white/[0.06] bg-black/20 px-4 py-3">
                    <DiffView diff={diff} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Tarjeta de proceso ─────────────────────────────────── */

function ProcesoCard({
  proceso,
  artefactos,
  historial,
  defaultOpen,
  rol,
}: {
  proceso: Proceso
  artefactos: Artefacto[]
  historial: HistorialEntry[]
  defaultOpen: boolean
  rol: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const totalVersiones = artefactos.reduce((s, a) => s + a.version, 0)
  const ultimaActualizacion = artefactos.reduce(
    (latest, a) => (!latest || a.updated_at > latest ? a.updated_at : latest), '' as string
  )

  return (
    <GlassCard>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors rounded-2xl"
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <span className="text-indigo-400 font-bold text-xs">{proceso.codigo ?? '—'}</span>
        </div>

        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-slate-100">{proceso.nombre}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">
              {artefactos.length} artefacto{artefactos.length !== 1 ? 's' : ''}
            </span>
            {ultimaActualizacion && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(ultimaActualizacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="text-lg font-bold text-white tabular-nums">{totalVersiones}</span>
          <span className="text-xs text-slate-600">versiones totales</span>
        </div>

        {open
          ? <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          : <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-white/[0.06] pt-4">
          {artefactos.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">
              No hay artefactos publicados para este proceso.
            </p>
          ) : (
            artefactos.map(a => (
              <ArtefactoRow
                key={a.id}
                artefacto={a}
                historialEntries={historial.filter(h => h.artefacto_id === a.id)}
                rol={rol}
                contenidoActual={{}}
              />
            ))
          )}
        </div>
      )}
    </GlassCard>
  )
}

/* ─── Componente principal ───────────────────────────────── */

export default function VersionesCliente({
  procesos,
  artefactos,
  historial,
  proyectoNombre,
  clienteNombre,
  rol,
}: Props) {
  const artefactosPorProceso = useMemo(() => {
    const map: Record<string, Artefacto[]> = {}
    for (const a of artefactos) {
      if (!map[a.proceso_id]) map[a.proceso_id] = []
      map[a.proceso_id].push(a)
    }
    return map
  }, [artefactos])

  const totalArtefactos = artefactos.length
  const totalVersiones = artefactos.reduce((s, a) => s + a.version, 0)
  const totalCambios = historial.length
  const esInterno = ROLES_INTERNOS.has(rol)

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
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Control de Versiones
          </h1>
          <p className="text-slate-500 text-sm max-w-xl">
            Registro completo de cada artefacto entregado, historial de cambios con diff campo a campo{esInterno ? ' y restauración de versiones anteriores' : ', y descarga de la versión oficial'}.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Artefactos publicados', value: totalArtefactos, icon: Layers, color: 'text-indigo-400' },
            { label: 'Versiones totales', value: totalVersiones, icon: GitBranch, color: 'text-violet-400' },
            { label: 'Cambios registrados', value: totalCambios, icon: Sparkles, color: 'text-emerald-400' },
          ].map(s => (
            <GlassCard key={s.label} className="px-4 py-4 flex flex-col gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-600 leading-tight">{s.label}</p>
            </GlassCard>
          ))}
        </div>

        {/* Nota */}
        <GlassCard className="px-5 py-4 flex items-start gap-3 border-emerald-500/10 bg-emerald-500/[0.03]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm text-slate-200 font-medium">La versión marcada como actual es la entrega oficial</p>
            <p className="text-xs text-slate-500">
              {esInterno
                ? 'Puedes expandir cada artefacto para ver el diff exacto entre versiones y restaurar versiones anteriores si es necesario.'
                : 'Descarga cualquier artefacto para obtener la versión más reciente validada — es la recomendada para compartir con un partner tecnológico o usar en Horizonte de Impacto.'}
            </p>
          </div>
        </GlassCard>

        {/* Lista de procesos */}
        <div className="space-y-3">
          {procesos.map((p, idx) => (
            <ProcesoCard
              key={p.id}
              proceso={p}
              artefactos={artefactosPorProceso[p.id] ?? []}
              historial={historial.filter(h => h.proceso_id === p.id)}
              defaultOpen={idx === 0}
              rol={rol}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
