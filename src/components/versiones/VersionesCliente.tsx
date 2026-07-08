'use client'

import { useState } from 'react'
import {
  FileText, Download, ChevronDown, ChevronUp, Clock,
  GitBranch, Sparkles, Star, AlertCircle,
  FileCheck, History, ArrowRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Proceso {
  id: string
  nombre: string
  codigo: string | null
  orden: number
  estado_oferta: string
  created_at: string
  updated_at: string
  metadata_ia: Record<string, unknown> | null
  documento_origen_id: string | null
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

interface DocumentoInfo {
  nombre_archivo: string
  url_storage: string
  tipo: string
}

interface Props {
  procesos: Proceso[]
  artefactos: Artefacto[]
  historialArtefactos: HistorialArtefacto[]
  historialProcesos: HistorialProceso[]
  documentosMap: Record<string, DocumentoInfo>
  proyectoNombre: string
  clienteNombre: string
  rol: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scCode(p: Proceso) {
  if (p.codigo) return p.codigo
  // Same logic as Process Discovery: derive from documento_referencia filename
  const docRef = (p.metadata_ia?.documento_referencia as string | null)
  if (docRef) return docRef.replace(/\.[^.]+$/, '').toUpperCase()
  // Last resort: orden is 0-indexed so add 1
  return `SC${String((p.orden ?? 0) + 1).padStart(2, '0')}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

interface VersionEntry {
  label: string
  numero: number
  fecha: string
  descripcion: string
  cambios: string[]
  isLatest: boolean
  isOriginal: boolean
  documentoId: string | null  // for original doc download via signed-url API
}

function buildVersionTimeline(p: Proceso, docInfo: DocumentoInfo | undefined): VersionEntry[] {
  const meta = p.metadata_ia ?? {}
  const versiones = (meta.versiones ?? []) as Array<Record<string, unknown>>
  const entries: VersionEntry[] = []

  entries.push({
    label: 'Original',
    numero: 0,
    fecha: p.created_at,
    descripcion: docInfo
      ? `Documento base "${docInfo.nombre_archivo}" subido en Centro Documental.`
      : 'Documento base subido en Centro Documental.',
    cambios: [],
    isLatest: versiones.length === 0,
    isOriginal: true,
    documentoId: p.documento_origen_id ?? null,
  })

  versiones.forEach((v, i) => {
    const numero = (v.numero as number) ?? (i + 1)
    const detalle = (v.detalle_correcciones ?? []) as Array<{ tipo: string; observacion: string }>
    const cambios = detalle.slice(0, 4).map(c =>
      `${c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}: ${(c.observacion ?? '').slice(0, 90)}${(c.observacion?.length ?? 0) > 90 ? '…' : ''}`
    )
    if (detalle.length > 4) cambios.push(`+${detalle.length - 4} cambio${detalle.length - 4 > 1 ? 's' : ''} más`)

    entries.push({
      label: `V${numero}`,
      numero,
      fecha: (v.fecha as string) ?? p.updated_at,
      descripcion: (v.descripcion as string) ?? `Versión ${numero}`,
      cambios,
      isLatest: i === versiones.length - 1,
      isOriginal: false,
      documentoId: null,
    })
  })

  return entries
}

// ─── Version Badge ─────────────────────────────────────────────────────────────

function VersionBadge({ label, isLatest, isOriginal }: { label: string; isLatest: boolean; isOriginal: boolean }) {
  if (isLatest && !isOriginal) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <Star className="w-2.5 h-2.5" /> {label} · Actual
      </span>
    )
  }
  if (isOriginal) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-600/40 text-slate-400 border border-slate-500/20">
        {label}
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/20">
      {label}
    </span>
  )
}

// ─── Download Button ───────────────────────────────────────────────────────────

function DownloadBtn({ entry, codigoProceso, procesoId }: {
  entry: VersionEntry
  codigoProceso: string
  procesoId: string
}) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      if (entry.isOriginal && entry.documentoId) {
        // Get signed URL for original document from storage
        const res = await fetch(`/api/documentos/signed-url?id=${entry.documentoId}`)
        if (res.ok) {
          const { url } = await res.json()
          window.open(url, '_blank')
        }
      } else {
        const res = await fetch(`/api/versiones/${procesoId}/descargar?v=${entry.numero}`)
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${codigoProceso}_${entry.label}.txt`
          a.click()
          URL.revokeObjectURL(url)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = entry.isOriginal && !entry.documentoId
  const isCurrentVersion = entry.isLatest && !entry.isOriginal

  return (
    <button
      onClick={handleDownload}
      disabled={loading || isDisabled}
      title={isDisabled ? 'Sin documento base asociado' : `Descargar ${codigoProceso} ${entry.label}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
        ${isCurrentVersion
          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
          : 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 border border-white/[0.08]'
        } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {loading
        ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        : <Download className="w-3 h-3" />
      }
      Descargar
    </button>
  )
}

// ─── Version Row ───────────────────────────────────────────────────────────────

function VersionRow({ entry, codigoProceso, procesoId, isLast }: {
  entry: VersionEntry
  codigoProceso: string
  procesoId: string
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-white/[0.05]" />
      )}

      {/* Dot */}
      <div className="flex-shrink-0 mt-1">
        {entry.isLatest && !entry.isOriginal ? (
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
            <Star className="w-4 h-4 text-emerald-400" />
          </div>
        ) : entry.isOriginal ? (
          <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-sky-400" />
          </div>
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-5">
        <div className={`rounded-xl border p-4 transition-all
          ${entry.isLatest && !entry.isOriginal
            ? 'bg-emerald-500/[0.05] border-emerald-500/20'
            : 'bg-white/[0.025] border-white/[0.05] hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">
                  {codigoProceso} {entry.label}
                </span>
                <VersionBadge label={entry.label} isLatest={entry.isLatest} isOriginal={entry.isOriginal} />
                {entry.isLatest && !entry.isOriginal && (
                  <span className="text-[10px] text-emerald-400/60 font-medium">Para entrega tecnológica</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {fmtDate(entry.fecha)}
              </div>
            </div>
            <DownloadBtn entry={entry} codigoProceso={codigoProceso} procesoId={procesoId} />
          </div>

          <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">{entry.descripcion}</p>

          {entry.cambios.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {entry.cambios.filter(c => !c.startsWith('+')).length} cambio{entry.cambios.filter(c => !c.startsWith('+')).length !== 1 ? 's' : ''} respecto a la versión anterior
              </button>
              {expanded && (
                <ul className="mt-2.5 space-y-1.5 pl-1">
                  {entry.cambios.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
                      <span className="mt-1 w-1 h-1 rounded-full bg-sky-400/50 flex-shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Proceso Card ──────────────────────────────────────────────────────────────

function ProcesoCard({ proceso, artefactos, docInfo, historialProcesos }: {
  proceso: Proceso
  artefactos: Artefacto[]
  docInfo: DocumentoInfo | undefined
  historialProcesos: HistorialProceso[]
}) {
  const [open, setOpen] = useState(false)
  const codigo = scCode(proceso)
  const timeline = buildVersionTimeline(proceso, docInfo)
  const latestVersion = timeline[timeline.length - 1]
  const totalArtefactos = artefactos.length

  return (
    <div className={`rounded-2xl border transition-all duration-200
      ${open ? 'bg-white/[0.04] border-white/[0.1]' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.09]'}`}
    >
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-5 text-left">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/25 to-purple-600/25 border border-indigo-400/20 flex items-center justify-center">
          <span className="text-xs font-bold text-indigo-200">{codigo}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{proceso.nombre}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500">{timeline.length} versión{timeline.length !== 1 ? 'es' : ''}</span>
            {totalArtefactos > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-500">{totalArtefactos} documento{totalArtefactos !== 1 ? 's' : ''} generado{totalArtefactos !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-3">
          {!docInfo && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-400/60">
              <AlertCircle className="w-3 h-3" /> Sin doc. base
            </span>
          )}
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-slate-300">{latestVersion.label}</div>
            <div className="text-[10px] text-slate-600">{fmtDateShort(latestVersion.fecha)}</div>
          </div>
          <div className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-6">
          {/* Timeline header */}
          <div className="flex items-center gap-2 mb-4">
            <History className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">Historial de versiones</span>
          </div>

          {/* Timeline */}
          {timeline.map((entry, i) => (
            <VersionRow
              key={entry.label}
              entry={entry}
              codigoProceso={codigo}
              procesoId={proceso.id}
              isLast={i === timeline.length - 1}
            />
          ))}

          {/* Hint when only Original exists */}
          {timeline.length === 1 && (
            <div className="mt-1 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/10 flex items-start gap-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-400/60 leading-relaxed">
                Las versiones se generan cuando el cliente registra observaciones en Process Discovery y el equipo las incorpora.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function VersionesCliente({
  procesos, artefactos, historialArtefactos, historialProcesos,
  documentosMap, proyectoNombre, clienteNombre, rol,
}: Props) {
  const totalVersiones = procesos.reduce((sum, p) => {
    const vs = ((p.metadata_ia?.versiones ?? []) as unknown[]).length
    return sum + 1 + vs
  }, 0)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileCheck className="w-3.5 h-3.5" />
            <span>{clienteNombre || proyectoNombre}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Control de Versiones</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Cada proceso mantiene su rastro documental desde el archivo original hasta la versión vigente lista para entrega tecnológica.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { label: 'Procesos activos', value: procesos.length, Icon: GitBranch, color: 'text-indigo-400' },
            { label: 'Versiones totales', value: totalVersiones, Icon: History, color: 'text-sky-400' },
          ] as const).map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-2">
              <s.Icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 px-1">
          <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> Original</span>
          <ArrowRight className="w-3 h-3 text-slate-700" />
          <span className="flex items-center gap-1.5"><GitBranch className="w-3 h-3 text-sky-600" /> Versiones con cambios</span>
          <ArrowRight className="w-3 h-3 text-slate-700" />
          <span className="flex items-center gap-1.5"><Star className="w-3 h-3 text-emerald-500" /> Versión actual · Para entrega</span>
        </div>

        {/* Processes */}
        <div className="space-y-3">
          {procesos.map(p => (
            <ProcesoCard
              key={p.id}
              proceso={p}
              artefactos={artefactos.filter(a => a.proceso_id === p.id)}
              docInfo={p.documento_origen_id ? documentosMap[p.documento_origen_id] : undefined}
              historialProcesos={historialProcesos.filter(h => h.proceso_id === p.id)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
