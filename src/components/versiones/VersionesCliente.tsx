'use client'

import { useState } from 'react'
import { formatFecha, formatFechaRelativa } from '@/lib/format'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'
import {
  FileText, Download, ChevronDown, Clock,
  GitBranch, Sparkles, Star, AlertCircle,
  FileCheck, History, ArrowRight, Layers, User, Filter, Search,
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
  autor: string | null
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

const fmtDate = formatFecha

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

interface CambioDetalle {
  tipo: string
  observacion: string
  texto_original?: string
  fecha?: string
}

// Reemplazo de texto real que la IA aplicó sobre el documento al consolidar
// una versión (buscar → reemplazar_por) — guardado en metadata_ia.versiones
// junto al resto de la versión. A diferencia de detalleCorrecciones (que
// registra la decisión del cliente), esto es el cambio literal que quedó
// en el documento, lo que permite mostrar un diff real palabra por palabra.
interface CambioAplicado {
  tipo: string
  seccion: string
  buscar: string
  reemplazar_por: string
  descripcion: string
  aplicado?: boolean
}

interface VersionEntry {
  // 'documento': una versión del documento completo (Original o V1, V2... generadas
  // desde Discovery/Hallazgos). 'artefacto': una edición puntual a un artefacto
  // metodológico (SIPOC, BPMN, etc.) — también es una modificación real sobre el
  // proceso, así que debe quedar igual de trazable en esta misma línea de tiempo.
  kind: 'documento' | 'artefacto'
  label: string
  numero: number | null
  fecha: string
  descripcion: string
  detalleCorrecciones: CambioDetalle[]
  cambiosAplicados: CambioAplicado[]
  isLatest: boolean
  isOriginal: boolean
  documentoId: string | null
  artefactoTipo?: string
  artefactoVersion?: number
  autor?: string | null
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
    kind: 'documento',
    label: 'Original',
    numero: 0,
    fecha: p.created_at,
    descripcion: docInfo
      ? `Documento base "${docInfo.nombre_archivo}" subido en Centro Documental.`
      : 'Documento base subido en Centro Documental.',
    detalleCorrecciones: [],
    cambiosAplicados: [],
    isLatest: versiones.length === 0,
    isOriginal: true,
    documentoId: p.documento_origen_id ?? null,
  })

  versiones.forEach((v, i) => {
    const numero = (v.numero as number) ?? (i + 1)
    const detalleCorrecciones = (v.detalle_correcciones ?? []) as CambioDetalle[]
    const cambiosAplicados = (v.cambios_aplicados ?? []) as CambioAplicado[]

    entries.push({
      kind: 'documento',
      label: `V${numero}`,
      numero,
      fecha: (v.fecha as string) ?? p.updated_at,
      descripcion: (v.descripcion as string) ?? `Versión ${numero}`,
      detalleCorrecciones,
      cambiosAplicados,
      isLatest: i === versiones.length - 1,
      isOriginal: false,
      documentoId: null,
    })
  })

  return entries
}

// Incorpora las ediciones de artefactos (artefacto_historial) a la misma línea
// de tiempo — cada edición de un SIPOC, BPMN, etc. es una modificación real
// sobre el proceso y debe quedar trazable acá, no solo en la ficha del
// artefacto. Se combina con las versiones de documento y se ordena por fecha.
function mergeConHistorialArtefactos(
  timelineDocumentos: VersionEntry[],
  historialDelProceso: HistorialArtefacto[],
): VersionEntry[] {
  const entradasArtefactos: VersionEntry[] = historialDelProceso.map(h => ({
    kind: 'artefacto',
    label: LABEL_ARTEFACTO[h.tipo as keyof typeof LABEL_ARTEFACTO] ?? h.tipo,
    numero: null,
    fecha: h.created_at,
    descripcion: h.motivo_cambio?.trim() || 'Edición sin motivo registrado.',
    detalleCorrecciones: [],
    cambiosAplicados: [],
    isLatest: false,
    isOriginal: false,
    documentoId: null,
    artefactoTipo: h.tipo,
    artefactoVersion: h.version,
    autor: h.autor,
  }))

  return [...timelineDocumentos, ...entradasArtefactos].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  )
}

// ─── Version Badge ─────────────────────────────────────────────────────────────

function VersionBadge({ kind, label, isLatest, isOriginal }: { kind: 'documento' | 'artefacto'; label: string; isLatest: boolean; isOriginal: boolean }) {
  if (kind === 'artefacto') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/25">
        <Layers className="w-2.5 h-2.5" /> Artefacto
      </span>
    )
  }
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

// ─── Diff de texto palabra por palabra ─────────────────────────────────────────
// LCS clásico sobre tokens (palabras + espacios, para conservar el espaciado
// real) — suficiente para los fragmentos cortos (una oración) que la IA usa
// como "buscar"/"reemplazar_por" al consolidar una versión.

type TokenDiff = { tipo: 'igual' | 'quitado' | 'agregado'; texto: string }

function diffPalabras(a: string, b: string): TokenDiff[] {
  const wa = a.split(/(\s+)/)
  const wb = b.split(/(\s+)/)
  const n = wa.length
  const m = wb.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = wa[i] === wb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const result: TokenDiff[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (wa[i] === wb[j]) { result.push({ tipo: 'igual', texto: wa[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { result.push({ tipo: 'quitado', texto: wa[i] }); i++ }
    else { result.push({ tipo: 'agregado', texto: wb[j] }); j++ }
  }
  while (i < n) { result.push({ tipo: 'quitado', texto: wa[i] }); i++ }
  while (j < m) { result.push({ tipo: 'agregado', texto: wb[j] }); j++ }
  return result
}

function DiffTexto({ antes, despues }: { antes: string; despues: string }) {
  const tokens = diffPalabras(antes, despues)
  return (
    <p className="text-[11px] leading-relaxed font-mono">
      {tokens.map((t, i) => {
        if (t.tipo === 'igual') return <span key={i} className="text-slate-400">{t.texto}</span>
        if (t.tipo === 'quitado') return <span key={i} className="text-red-400/90 line-through bg-red-500/10">{t.texto}</span>
        return <span key={i} className="text-emerald-300 bg-emerald-500/10">{t.texto}</span>
      })}
    </p>
  )
}

function CambioAplicadoCard({ cambio }: { cambio: CambioAplicado }) {
  const cfg = getTipo(cambio.tipo)
  return (
    <div className={`rounded-xl border p-3.5 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
          {cfg.label}
        </span>
        {cambio.seccion && (
          <span className="text-[10px] text-slate-400 italic truncate max-w-[60%] text-right">{cambio.seccion}</span>
        )}
      </div>
      <DiffTexto antes={cambio.buscar} despues={cambio.reemplazar_por} />
      {cambio.descripcion && (
        <p className="mt-2.5 text-[11px] text-slate-400 leading-relaxed border-t border-white/[0.05] pt-2">
          {cambio.descripcion}
        </p>
      )}
    </div>
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
        <span className="text-[10px] text-slate-400 flex-shrink-0">#{index + 1}</span>
      </div>

      {cambio.texto_original && (
        <div className="mb-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-medium">Texto original</div>
          <div className="text-[11px] text-slate-400 leading-relaxed bg-black/20 rounded-lg px-2.5 py-2 border border-white/[0.04] italic">
            &quot;{cambio.texto_original.slice(0, 200)}{cambio.texto_original.length > 200 ? '…' : ''}&quot;
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-medium">Observación del cliente</div>
        <div className={`text-xs leading-relaxed font-medium ${cfg.color}`}>
          {cambio.observacion}
        </div>
      </div>

      {cambio.fecha && (
        <div className="mt-2 text-[10px] text-slate-400">
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
  const esArtefacto = entry.kind === 'artefacto'
  // Solo los reemplazos con texto real de "antes" y "después" tienen algo
  // que diffear — las decisiones "aceptado tal cual" no tocaron el
  // documento, así que no generan buscar/reemplazar_por.
  const cambiosConDiff = entry.cambiosAplicados.filter(c => c.buscar?.trim() && c.reemplazar_por?.trim() && c.aplicado !== false)

  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-white/[0.05]" />
      )}

      {/* Timeline dot */}
      <div className="flex-shrink-0 mt-1">
        {esArtefacto ? (
          <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
        ) : entry.isLatest && !entry.isOriginal ? (
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

      {/* Card — entradas de artefacto: card compacta, sin descarga ni detalle expandido */}
      {esArtefacto ? (
        <div className="flex-1 pb-5">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{entry.label}</span>
                  <VersionBadge kind="artefacto" label={entry.label} isLatest={false} isOriginal={false} />
                </div>
                <span className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {fmtDate(entry.fecha)}
                  </span>
                  {entry.autor && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <User className="w-3 h-3" />
                      {entry.autor}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">
              <span className="text-violet-300 font-medium">Motivo del cambio: </span>{entry.descripcion}
            </p>
          </div>
        </div>
      ) : (
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
                  <VersionBadge kind={entry.kind} label={entry.label} isLatest={entry.isLatest} isOriginal={entry.isOriginal} />
                  {entry.isLatest && !entry.isOriginal && (
                    <span className="text-[10px] text-emerald-400/70 font-semibold">Para entrega tecnológica</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
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
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
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
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      El detalle de cambios está disponible en versiones nuevas generadas desde esta actualización.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diff real palabra por palabra de lo que la IA cambió en el
              documento — complementa "Qué cambió" (la decisión del cliente)
              con el texto literal antes/después. */}
          {!entry.isOriginal && cambiosConDiff.length > 0 && (
            <div className="border-t border-white/[0.05] px-4 pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-violet-500/50" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Diff del documento — antes / después
                </span>
              </div>
              <div className="grid gap-2.5">
                {cambiosConDiff.map((c, i) => (
                  <CambioAplicadoCard key={i} cambio={c} />
                ))}
              </div>
            </div>
          )}

          {/* Original: no changes, just info */}
          {entry.isOriginal && (
            <div className="border-t border-white/[0.04] px-4 py-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <span className="text-[11px] text-slate-400">
                Este es el documento de referencia. Las versiones V1, V2... reflejan los cambios validados.
              </span>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// ─── Proceso Card ──────────────────────────────────────────────────────────────

// Un entry matchea si el texto buscado aparece en su descripción, en
// cualquiera de sus detalleCorrecciones (observación o texto original), o
// en su label (ej. el tipo de artefacto).
function entryCoincide(entry: VersionEntry, q: string): boolean {
  if (!q) return true
  const t = q.toLowerCase()
  if (entry.descripcion?.toLowerCase().includes(t)) return true
  if (entry.label?.toLowerCase().includes(t)) return true
  if (entry.detalleCorrecciones.some(c =>
    c.observacion?.toLowerCase().includes(t) || c.texto_original?.toLowerCase().includes(t)
  )) return true
  return entry.cambiosAplicados.some(c =>
    c.buscar?.toLowerCase().includes(t) || c.reemplazar_por?.toLowerCase().includes(t) || c.seccion?.toLowerCase().includes(t)
  )
}

function ProcesoCard({ proceso, artefactos, docInfo, historialArtefactos, historialProcesos: _historialProcesos, busqueda }: {
  proceso: Proceso
  artefactos: Artefacto[]
  docInfo: DocumentoInfo | undefined
  historialArtefactos: HistorialArtefacto[]
  historialProcesos: HistorialProceso[]
  busqueda: string
}) {
  const codigo = scCode(proceso)
  // "timeline" (solo documento) define el badge de versión vigente en el
  // header — la edición de un artefacto no reemplaza el documento entregable.
  // "timelineCompleta" (documento + artefactos) es lo que se ve al expandir,
  // para que todo quede trazable en un solo lugar.
  const timeline = buildVersionTimeline(proceso, docInfo)
  const timelineCompleta = mergeConHistorialArtefactos(timeline, historialArtefactos)

  const q = busqueda.trim().toLowerCase()
  const procesoCoincide = !q || proceso.nombre.toLowerCase().includes(q) || codigo.toLowerCase().includes(q)
  // Si el proceso en sí coincide por nombre/código, se muestra la línea de
  // tiempo completa (no tiene sentido ocultar entradas de un proceso que el
  // cliente buscó explícitamente); si no, se filtra a las entradas que sí
  // mencionan el término buscado.
  const timelineBuscada = !q || procesoCoincide ? timelineCompleta : timelineCompleta.filter(e => entryCoincide(e, q))
  const hayCoincidencia = !q || procesoCoincide || timelineBuscada.length > 0

  const [openManual, setOpenManual] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'documento' | 'artefacto'>('todos')
  // Con una búsqueda activa que sí tiene resultados, el proceso se abre solo
  // — no tiene sentido pedirle al cliente que además haga clic para
  // desplegar algo que ya encontró.
  const open = openManual || (q.length > 0 && hayCoincidencia)
  const timelineFiltrada = filtro === 'todos' ? timelineBuscada : timelineBuscada.filter(e => e.kind === filtro)
  const latestVersion = timeline[timeline.length - 1]
  const totalArtefactos = artefactos.length
  const totalDocumento = timelineBuscada.filter(e => e.kind === 'documento').length
  const totalArtefactoEntradas = timelineBuscada.filter(e => e.kind === 'artefacto').length

  if (q.length > 0 && !hayCoincidencia) return null

  return (
    <div className={`rounded-2xl border transition-all duration-200
      ${open ? 'bg-white/[0.04] border-white/[0.1]' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.09]'}`}
    >
      <button onClick={() => setOpenManual(o => !o)} className="w-full flex items-center gap-4 p-5 text-left">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/25 to-purple-600/25 border border-indigo-400/20 flex items-center justify-center">
          <span className="text-xs font-bold text-indigo-200">{codigo}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{proceso.nombre}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-400">{timeline.length} versión{timeline.length !== 1 ? 'es' : ''}</span>
            {totalArtefactos > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-400">{totalArtefactos} artefacto{totalArtefactos !== 1 ? 's' : ''} generado{totalArtefactos !== 1 ? 's' : ''}</span>
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
            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${latestVersion.isOriginal ? 'text-slate-400 bg-white/5' : 'text-indigo-300 bg-indigo-500/15 border border-indigo-500/25'}`}>{latestVersion.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 text-right">{fmtDateShort(latestVersion.fecha)}</div>
          </div>
          <div className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-6">
          {/* Timeline header + filtro por tipo de cambio */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Historial de versiones</span>
            </div>
            {(totalDocumento > 0 && totalArtefactoEntradas > 0) && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-slate-600 mr-0.5" />
                {[
                  { key: 'todos' as const, label: `Todos (${timelineBuscada.length})` },
                  { key: 'documento' as const, label: `Documento (${totalDocumento})` },
                  { key: 'artefacto' as const, label: `Artefacto (${totalArtefactoEntradas})` },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltro(f.key)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all font-medium ${
                      filtro === f.key
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'border-white/8 text-slate-400 hover:text-slate-300 hover:border-white/15'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timeline — más reciente arriba, original abajo. Incluye tanto
              versiones de documento como ediciones puntuales de artefactos. */}
          {[...timelineFiltrada].reverse().map((entry, i) => (
            <VersionRow
              key={`${entry.kind}-${entry.label}-${entry.fecha}-${i}`}
              entry={entry}
              codigoProceso={codigo}
              procesoId={proceso.id}
              isLast={i === timelineFiltrada.length - 1}
            />
          ))}

          {timelineFiltrada.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">Sin entradas para este filtro.</p>
          )}

          {/* Hint when only Original exists */}
          {timelineCompleta.length === 1 && (
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
  documentosMap, proyectoNombre, clienteNombre, rol: _rol,
}: Props) {
  const totalVersiones = procesos.reduce((sum, p) => {
    const vs = ((p.metadata_ia?.versiones ?? []) as unknown[]).length
    return sum + 1 + vs
  }, 0)
  const procesosConCambios = procesos.filter(p =>
    ((p.metadata_ia?.versiones ?? []) as unknown[]).length > 0
  ).length
  // Se calcula a partir de eventos reales y auditados (ediciones de artefactos,
  // historial de artefactos/procesos) — NO desde proceso.updated_at, que puede
  // ser tocado por migraciones o scripts sin pasar por ningún flujo auditado,
  // mostrando una fecha de "actividad" que nunca ocurrió realmente en la app.
  const ultimaActividad = [
    ...artefactos.map(a => a.updated_at),
    ...historialArtefactos.map(h => h.created_at),
    ...historialProcesos.map(h => h.created_at),
  ].reduce((latest, fecha) => {
    const d = new Date(fecha).getTime()
    return d > latest ? d : latest
  }, 0)
  const ultimaActividadStr = ultimaActividad
    ? new Date(ultimaActividad).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
  const ultimaActividadRelativa = ultimaActividad ? formatFechaRelativa(ultimaActividad) : null

  const [busqueda, setBusqueda] = useState('')
  const q = busqueda.trim().toLowerCase()
  const hayResultados = !q || procesos.some(p => {
    const codigo = scCode(p)
    if (p.nombre.toLowerCase().includes(q) || codigo.toLowerCase().includes(q)) return true
    const timeline = mergeConHistorialArtefactos(
      buildVersionTimeline(p, p.documento_origen_id ? documentosMap[p.documento_origen_id] : undefined),
      historialArtefactos.filter(h => h.proceso_id === p.id),
    )
    return timeline.some(e => entryCoincide(e, q))
  })

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">

        {/* Hero header card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]">
          {/* Ambient glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-10 w-60 h-60 rounded-full bg-sky-500/8 blur-3xl pointer-events-none" />

          <div className="relative px-7 pt-7 pb-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{clienteNombre || proyectoNombre}</span>
              <span className="text-slate-700">·</span>
              <span>Proyecto activo</span>
            </div>

            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Control de Versiones</h1>
                <p className="mt-1.5 text-sm text-slate-400 max-w-xl leading-relaxed">
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
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Procesos</span>
                </div>
                <div className="text-3xl font-bold text-white">{procesos.length}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">aceptados para implementación</div>
              </div>

              {/* Stat 2 */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                    <History className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Versiones</span>
                </div>
                <div className="text-3xl font-bold text-white">{totalVersiones}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{procesosConCambios} proceso{procesosConCambios !== 1 ? 's' : ''} con cambios</div>
              </div>

              {/* Stat 3 */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Última actividad</span>
                </div>
                <div className="text-lg font-bold text-white leading-tight">{ultimaActividadRelativa ?? '—'}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{ultimaActividadStr !== '—' ? `${ultimaActividadStr} · última modificación` : 'sin actividad registrada'}</div>
              </div>
            </div>

            {/* Legend / flow indicator */}
            <div className="mt-5 pt-4 border-t border-white/[0.05] flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="text-slate-400 font-medium mr-1">Flujo:</span>
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

        {/* Buscador de texto libre — sobre motivos, observaciones, textos
            originales y nombre/código de proceso, en toda la línea de
            tiempo. Útil recién cuando el historial crece; con poco volumen
            no aporta mucho, pero no molesta tenerlo siempre disponible. */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en el historial — motivo, observación, proceso…"
            className="w-full pl-11 pr-10 py-3 rounded-2xl border border-white/8 bg-white/[0.02] text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/40 transition-colors"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Processes */}
        {hayResultados ? (
          <div className="space-y-3">
            {procesos.map(p => (
              <ProcesoCard
                key={p.id}
                proceso={p}
                artefactos={artefactos.filter(a => a.proceso_id === p.id)}
                docInfo={p.documento_origen_id ? documentosMap[p.documento_origen_id] : undefined}
                historialArtefactos={historialArtefactos.filter(h => h.proceso_id === p.id)}
                historialProcesos={historialProcesos.filter(h => h.proceso_id === p.id)}
                busqueda={busqueda}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-400">Sin resultados para &quot;{busqueda}&quot;.</p>
          </div>
        )}

        {/* Cierre de flujo — Control de Versiones es la última fase (F5): a
            diferencia de Artefactos/Horizonte, acá no hay "siguiente paso"
            dentro del proyecto, así que el CTA lleva de vuelta al Dashboard
            en lugar de a otra fase. */}
        {!busqueda && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Rastro documental completo</p>
                <p className="text-xs text-slate-400 mt-0.5">Ya revisaste el historial de versiones y cambios del proyecto — puedes volver al Dashboard.</p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors flex-shrink-0"
            >
              Ir al Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
