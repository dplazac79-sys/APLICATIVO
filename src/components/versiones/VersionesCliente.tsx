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
}

interface Props {
  procesos: Proceso[]
  artefactos: Artefacto[]
  historial: HistorialEntry[]
  proyectoNombre: string
  clienteNombre: string
}

/* ─── labels legibles ────────────────────────────────────── */

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

function tipoColor(tipo: string) {
  return TIPO_ICON_COLOR[tipo] ?? 'text-slate-400'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ─── Glass primitives ───────────────────────────────────── */

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}>
      {children}
    </div>
  )
}

/* ─── Badge de versión ───────────────────────────────────── */

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

/* ─── Fila de artefacto ──────────────────────────────────── */

function ArtefactoRow({
  artefacto,
  historialEntries,
}: {
  artefacto: Artefacto
  historialEntries: HistorialEntry[]
}) {
  const [expanded, setExpanded] = useState(false)
  const label = TIPO_LABELS[artefacto.tipo] ?? artefacto.tipo
  const color = tipoColor(artefacto.tipo)
  const totalVersiones = artefacto.version
  const tieneHistorial = historialEntries.length > 0

  function handleDownload() {
    const content = `Artefacto: ${label}\nVersión actual: v${totalVersiones}\nÚltima actualización: ${formatDate(artefacto.updated_at)}\n\n[Contenido exportado desde ProcessOS]`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artefacto.tipo}_v${totalVersiones}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden transition-all">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => tieneHistorial && setExpanded(e => !e)}
      >
        <FileText className={`w-4 h-4 shrink-0 ${color}`} />
        <span className="flex-1 text-sm text-slate-200 font-medium">{label}</span>

        <div className="flex items-center gap-3">
          <VersionBadge v={artefacto.version} isCurrent />
          <span className="text-xs text-slate-600 hidden sm:block">{formatDate(artefacto.updated_at)}</span>

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

      {/* Timeline de versiones anteriores */}
      {expanded && tieneHistorial && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-2 bg-white/[0.02]">
          <p className="text-xs text-slate-600 uppercase tracking-wider mb-3">Historial de cambios</p>
          {historialEntries.map((h, idx) => (
            <div key={h.id} className="flex items-start gap-3">
              {/* línea de tiempo */}
              <div className="flex flex-col items-center pt-1">
                <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                {idx < historialEntries.length - 1 && (
                  <div className="w-px flex-1 bg-slate-800 mt-1 min-h-[20px]" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <VersionBadge v={h.version} />
                  <span className="text-xs text-slate-600">{formatDateTime(h.created_at)}</span>
                </div>
                {h.motivo_cambio ? (
                  <p className="text-xs text-slate-400">{h.motivo_cambio}</p>
                ) : (
                  <p className="text-xs text-slate-600 italic">Sin descripción de cambio</p>
                )}
              </div>
            </div>
          ))}
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
}: {
  proceso: Proceso
  artefactos: Artefacto[]
  historial: HistorialEntry[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const totalArtefactos = artefactos.length
  const totalVersiones = artefactos.reduce((s, a) => s + a.version, 0)
  const ultimaActualizacion = artefactos.reduce((latest, a) =>
    !latest || a.updated_at > latest ? a.updated_at : latest, '' as string)

  return (
    <GlassCard>
      {/* Header del proceso */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors rounded-2xl"
      >
        {/* código */}
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <span className="text-indigo-400 font-bold text-xs">{proceso.codigo ?? '—'}</span>
        </div>

        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-slate-100">{proceso.nombre}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">
              {totalArtefactos} artefacto{totalArtefactos !== 1 ? 's' : ''}
            </span>
            {ultimaActualizacion && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(ultimaActualizacion)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* stat versiones */}
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="text-lg font-bold text-white tabular-nums">{totalVersiones}</span>
          <span className="text-xs text-slate-600">versiones totales</span>
        </div>

        {open
          ? <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
          : <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />}
      </button>

      {/* Lista de artefactos */}
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
}: Props) {
  // Agrupar artefactos por proceso
  const artefactosPorProceso = useMemo(() => {
    const map: Record<string, Artefacto[]> = {}
    for (const a of artefactos) {
      if (!map[a.proceso_id]) map[a.proceso_id] = []
      map[a.proceso_id].push(a)
    }
    return map
  }, [artefactos])

  // Stats globales
  const totalArtefactos = artefactos.length
  const totalVersiones = artefactos.reduce((s, a) => s + a.version, 0)
  const totalCambios = historial.length

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-x-hidden">
      {/* Orbs de fondo */}
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
            Registro completo de cada artefacto entregado, sus versiones y el detalle de los cambios realizados en cada iteración.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Artefactos publicados', value: totalArtefactos, icon: Layers, color: 'text-indigo-400' },
            { label: 'Versiones totales', value: totalVersiones, icon: GitBranch, color: 'text-violet-400' },
            { label: 'Cambios registrados', value: totalCambios, icon: Sparkles, color: 'text-emerald-400' },
          ].map(stat => (
            <GlassCard key={stat.label} className="px-4 py-4 flex flex-col gap-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
              <p className="text-xs text-slate-600 leading-tight">{stat.label}</p>
            </GlassCard>
          ))}
        </div>

        {/* Nota de uso */}
        <GlassCard className="px-5 py-4 flex items-start gap-3 border-emerald-500/10 bg-emerald-500/[0.03]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm text-slate-200 font-medium">La versión marcada como actual es la entrega oficial</p>
            <p className="text-xs text-slate-500">
              Cada artefacto descargado corresponde a la última versión publicada y validada por el equipo consultor.
              Esta es la versión recomendada para compartir con un partner tecnológico o usar en simulaciones de impacto.
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}
