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

interface CambioDetalle {
  tipo: string
  observacion: string
  texto_original?: string
  fecha?: string
}

interface VersionEntry {
  label: string
  numero: number
  fecha: string
  descripcion: string
  detalleCorrecciones: CambioDetalle[]
  isLatest: boolean
  isOriginal: boolean
  documentoId: string | null
}

const TIPO_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  hallazgo:  { label: 'Hallazgo',    color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  riesgo:    { label: 'Riesgo',      color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/20'   },
  brecha:    { label: 'Brecha',      color: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/20'},
  rol:       { label: 'Rol',         color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20'},
  proceso:   { label: 'Proceso',     color: 'text-sky-300',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20'   },
  otro:      { label: 'Cambio',      color: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
}

function getTipo(tipo: string) {
  return TIPO_LABELS[tipo?.toLowerCase()] ?? TIPO_LABELS.otro
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
    detalleCorrecciones: [],
    isLatest: versiones.length === 0,
    isOriginal: true,
    documentoId: p.documento_origen_id ?? null,
  })

  versiones.forEach((v, i) => {
    const numero = (v.numero as number) ?? (i + 1)
    const detalleCorrecciones = (v.detalle_correcciones ?? []) as CambioDetalle[]

    entries.push({
      label: `V${numero}`,
      numero,
      fecha: (v.fecha as string) ?? p.updated_at,
      descripcion: (v.descripcion as string) ?? `Versión ${numero}`,
      detalleCorrecciones,
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

// ─── Change Detail Card ────────────────────────────────────────────────────────

function CambioCard({ cambio, index }: { cambio: CambioDetalle; index: number }) {
  const cfg = getTipo(cambio.tipo)
  return (
    <div className={`rounded-xl border p-3.5 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
          {cfg.label}
        </span>
        <span className="text-[10px] text-slate-600 flex-shrink-0">#{index + 1}</span>
      </div>

      {cambio.texto_original && (
        <div className="mb-2">
          <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1 font-medium">Texto original</div>
          <div className="text-[11px] text-slate-500 leading-relaxed bg-black/20 rounded-lg px-2.5 py-2 border border-white/[0.04] italic">
            "{cambio.texto_original.slice(0, 200)}{cambio.texto_original.length > 200 ? '…' : ''}"
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1 font-medium">Observación del cliente</div>
        <div className={`text-xs leading-relaxed font-medium ${cfg.color}`}>
          {cambio.observacion}
        </div>
      </div>

      {cambio.fecha && (
        <div className="mt-2 text-[10px] text-slate-600">
          Registrado: {new Date(cambio.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}

// ─── Version Row ───────────────────────────────────────────────────────────────

function VersionRow({ entry, codigoProceso, procesoId, isLast }: {
  entry: VersionEntry
  codigoProceso: string
  procesoId: string
  isLast: boolean
}) {
  const totalCambios = entry.detalleCorrecciones.length
  const isExpanded = !entry.isOriginal && totalCambios > 0

  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-white/[0.05]" />
      )}

      {/* Timeline dot */}
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
        <div className={`rounded-2xl border overflow-hidden transition-all
          ${entry.isLatest && !entry.isOriginal
            ? 'bg-emerald-500/[0.04] border-emerald-500/20'
            : 'bg-white/[0.025] border-white/[0.06]'
          }`}
        >
          {/* Version header */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{codigoProceso} {entry.label}</span>
                  <VersionBadge label={entry.label} isLatest={entry.isLatest} isOriginal={entry.isOriginal} />
                  {entry.isLatest && !entry.isOriginal && (
                    <span className="text-[10px] text-emerald-400/70 font-semibold">Para entrega tecnológica</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {fmtDate(entry.fecha)}
                  </span>
                  {totalCambios > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-sky-400/70 font-medium">
                      <ChevronDown className="w-3 h-3" />
                      {totalCambios} cambio{totalCambios !== 1 ? 's' : ''} incorporado{totalCambios !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <DownloadBtn entry={entry} codigoProceso={codigoProceso} procesoId={procesoId} />
            </div>

            {/* Version description */}
            <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">{entry.descripcion}</p>
          </div>

          {/* Changes detail — always visible when there are changes */}
          {!entry.isOriginal && (
            <div className="border-t border-white/[0.05] px-4 pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-sky-500/50" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                  Qué cambió respecto a la versión anterior
                </span>
              </div>
              {totalCambios > 0 ? (
                <div className="grid gap-2.5">
                  {entry.detalleCorrecciones.map((c, i) => (
                    <CambioCard key={i} cambio={c} index={i} />
                  ))}
                </div>
              ) : (
                /* Fallback for versions created before the detail structure was added */
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-start gap-3">
                  <GitBranch className="w-4 h-4 text-sky-400/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 leading-relaxed">{entry.descripcion}</p>
                    <p className="mt-1.5 text-[11px] text-slate-600">
                      El detalle de cambios está disponible en versiones nuevas generadas desde esta actualización.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Original: no changes, just info */}
          {entry.isOriginal && (
            <div className="border-t border-white/[0.04] px-4 py-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <span className="text-[11px] text-slate-600">
                Este es el documento de referencia. Las versiones V1, V2... reflejan los cambios validados.
              </span>
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

          {/* Timeline — más reciente arriba, original abajo */}
          {[...timeline].reverse().map((entry, i) => (
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
  const procesosConCambios = procesos.filter(p =>
    ((p.metadata_ia?.versiones ?? []) as unknown[]).length > 0
  ).length
  const ultimaActividad = procesos.reduce((latest, p) => {
    const d = new Date(p.updated_at).getTime()
    return d > latest ? d : latest
  }, 0)
  const ultimaActividadStr = ultimaActividad
    ? new Date(ultimaActividad).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

        {/* Hero header card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]">
          {/* Ambient glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-10 w-60 h-60 rounded-full bg-sky-500/8 blur-3xl pointer-events-none" />

          <div className="relative px-7 pt-7 pb-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-slate-600 mb-4">
              <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{clienteNombre || proyectoNombre}</span>
              <span className="text-slate-700">·</span>
              <span>Proyecto activo</span>
            </div>

            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Control de Versiones</h1>
                <p className="mt-1.5 text-sm text-slate-500 max-w-xl leading-relaxed">
                  Rastro documental completo de cada proceso — desde el archivo original hasta la versión vigente lista para entrega tecnológica.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] text-[11px] text-emerald-400 font-medium">
                <Star className="w-3 h-3" /> Proyecto activo
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Stat 1 */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Procesos</span>
                </div>
                <div className="text-3xl font-bold text-white">{procesos.length}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">aceptados para implementación</div>
              </div>

              {/* Stat 2 */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                    <History className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Versiones</span>
                </div>
                <div className="text-3xl font-bold text-white">{totalVersiones}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{procesosConCambios} proceso{procesosConCambios !== 1 ? 's' : ''} con cambios</div>
              </div>

              {/* Stat 3 */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Última actividad</span>
                </div>
                <div className="text-lg font-bold text-white leading-tight">{ultimaActividadStr}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">última modificación registrada</div>
              </div>
            </div>

            {/* Legend / flow indicator */}
            <div className="mt-5 pt-4 border-t border-white/[0.05] flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span className="text-slate-700 font-medium mr-1">Flujo:</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <FileText className="w-3 h-3 text-slate-500" /> Original
              </span>
              <ArrowRight className="w-3 h-3 text-slate-700" />
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <GitBranch className="w-3 h-3 text-sky-500" /> V1, V2...
              </span>
              <ArrowRight className="w-3 h-3 text-slate-700" />
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400">
                <Star className="w-3 h-3" /> Versión actual · Para entrega
              </span>
            </div>
          </div>
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
