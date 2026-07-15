'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, BarChart3, CheckCircle2, MessageSquare, Download, Eye, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatFecha as fecha } from '@/lib/format'

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface ArtefactoItem {
  id: string
  tipo: string
  updated_at: string
}
export interface EntregableItem {
  id: string
  nombre: string
  tipo: string
  updated_at: string
}
export interface TimelineEvento {
  id: string
  fecha: string
  titulo: string
  detalle: string
  tipo: 'documento' | 'entregable' | 'notificacion'
}

const ARTEFACTO_LABEL: Record<string, string> = {
  as_is: 'Mapa del proceso actual',
  to_be: 'Proceso optimizado propuesto',
  raci: 'Matriz de responsabilidades',
  kpi_sla: 'Indicadores y niveles de servicio',
  dashboard_brechas: 'Análisis de brechas',
  bpmn: 'Diagrama del proceso',
  sipoc: 'Resumen del proceso (SIPOC)',
  flujograma: 'Flujograma del proceso',
  riesgo_control: 'Riesgos y controles',
  diagnostico: 'Diagnóstico',
  historias_usuario: 'Historias de usuario',
  cierre_ejecutivo: 'Cierre ejecutivo',
}
const labelArtefacto = (t: string) => ARTEFACTO_LABEL[t] ?? t


const humanizar = (k: string) => {
  const s = k.replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const APROBADOS_KEY = 'apip_artefactos_aprobados'

function leerAprobados(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(APROBADOS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// ── Render legible del contenido JSONB del artefacto ─────────────────────────
function ValorLegible({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) return <span className="text-slate-400">—</span>
  if (typeof valor === 'boolean') return <span>{valor ? 'Sí' : 'No'}</span>
  if (typeof valor === 'number') return <span>{valor.toLocaleString('es-CL')}</span>
  if (typeof valor === 'string') return <span>{valor}</span>
  if (Array.isArray(valor)) {
    return (
      <ul className="list-disc list-inside space-y-1">
        {valor.map((item, i) => (
          <li key={i} className="text-slate-300">
            {typeof item === 'object' && item !== null ? (
              <span className="text-slate-400">
                {Object.entries(item as Record<string, unknown>)
                  .map(([k, v]) => `${humanizar(k)}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                  .join(' · ')}
              </span>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    )
  }
  if (typeof valor === 'object') {
    return (
      <div className="space-y-1 pl-2 border-l border-slate-800">
        {Object.entries(valor as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="text-sm">
            <span className="text-slate-400">{humanizar(k)}: </span>
            <span className="text-slate-300"><ValorLegible valor={v} /></span>
          </div>
        ))}
      </div>
    )
  }
  return <span>{String(valor)}</span>
}

function ContenidoLegible({ contenido }: { contenido: Record<string, unknown> }) {
  if (!contenido || Object.keys(contenido).length === 0) {
    return <p className="text-slate-400 text-sm">Este documento no tiene contenido adicional.</p>
  }
  return (
    <div className="space-y-3">
      {Object.entries(contenido).map(([k, v]) => (
        <div key={k}>
          <p className="text-xs font-medium text-indigo-300 mb-1">{humanizar(k)}</p>
          <div className="text-sm text-slate-300"><ValorLegible valor={v} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Tarjeta de documento (artefacto) ─────────────────────────────────────────
function DocumentoRow({
  artefacto,
  aprobado,
  onAprobado,
}: {
  artefacto: ArtefactoItem
  aprobado: boolean
  onAprobado: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [contenido, setContenido] = useState<Record<string, unknown> | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmandoAprobar, setConfirmandoAprobar] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function verDocumento() {
    if (abierto) {
      setAbierto(false)
      return
    }
    setAbierto(true)
    if (contenido) return
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/portal/artefacto/${artefacto.id}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'No se pudo cargar')
      setContenido((d.artefacto?.contenido ?? {}) as Record<string, unknown>)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setCargando(false)
    }
  }

  async function aprobar() {
    setConfirmandoAprobar(false)
    setEnviando(true)
    try {
      const res = await fetch(`/api/portal/artefacto/${artefacto.id}`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'No se pudo aprobar')
      }
      onAprobado(artefacto.id)
      setMensaje('Documento aprobado. El equipo fue notificado.')
    } catch (e) {
      setMensaje(String(e instanceof Error ? e.message : e))
    } finally {
      setEnviando(false)
    }
  }

  async function enviarComentario() {
    if (!comentario.trim()) return
    setEnviando(true)
    try {
      const res = await fetch('/api/portal/comentario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artefacto_id: artefacto.id, texto: comentario.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'No se pudo enviar')
      }
      setComentario('')
      setMensaje('Comentario enviado al equipo.')
    } catch (e) {
      setMensaje(String(e instanceof Error ? e.message : e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-slate-200 truncate">{labelArtefacto(artefacto.tipo)}</span>
          {aprobado && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprobado por ti
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 hidden sm:inline">{fecha(artefacto.updated_at)}</span>
          <button
            onClick={verDocumento}
            className="text-xs text-slate-300 border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg flex items-center gap-1"
          >
            <Eye className="w-3 h-3" /> {abierto ? 'Ocultar' : 'Ver documento'}
          </button>
        </div>
      </div>

      {abierto && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4">
          {cargando && <p className="text-slate-400 text-sm">Cargando documento...</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {!cargando && !error && contenido && <ContenidoLegible contenido={contenido} />}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            {!aprobado && (
              confirmandoAprobar ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">¿Confirmas que revisaste este documento?</span>
                  <button onClick={aprobar} disabled={enviando} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {enviando ? 'Aprobando...' : 'Sí, aprobar'}
                  </button>
                  <button onClick={() => setConfirmandoAprobar(false)} disabled={enviando} className="text-slate-400 hover:text-slate-300 text-xs px-1">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmandoAprobar(true)}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar documento
                </button>
              )
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Dejar un comentario al equipo
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              placeholder="Escribe tu observación o duda..."
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded px-3 py-2"
            />
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={enviarComentario}
                disabled={enviando || !comentario.trim()}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                Enviar comentario
              </button>
              {mensaje && <span className="text-xs text-slate-400">{mensaje}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Botón descarga PDF para entregables ──────────────────────────────────────
function DescargarPdfBtn({ entregable }: { entregable: EntregableItem }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function descargar() {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/entregables/${entregable.id}/exportar-pdf`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'No se pudo generar el PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${entregable.nombre}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={descargar}
        disabled={cargando}
        className="text-xs text-slate-300 border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
      >
        <Download className="w-3 h-3" /> {cargando ? 'Generando...' : 'Descargar PDF'}
      </button>
    </div>
  )
}

// ── Sección Documentos disponibles (interactiva) ─────────────────────────────
export function SeccionDocumentos({ artefactos }: { artefactos: ArtefactoItem[] }) {
  const [aprobados, setAprobados] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setAprobados(leerAprobados())
  }, [])

  const marcarAprobado = useCallback((id: string) => {
    setAprobados((prev) => {
      const next = { ...prev, [id]: true }
      try {
        localStorage.setItem(APROBADOS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  return (
    <section id="documentos">
      <h2 className="flex items-center gap-2 text-lg font-medium text-slate-200 mb-3">
        <FileText className="w-5 h-5 text-emerald-400" /> Documentos disponibles
      </h2>
      {artefactos.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay documentos publicados por ahora.</p>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0 divide-y divide-slate-800">
            {artefactos.map((a) => (
              <DocumentoRow
                key={a.id}
                artefacto={a}
                aprobado={!!aprobados[a.id]}
                onAprobado={marcarAprobado}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}

// ── Sección Análisis de impacto (con descarga PDF) ───────────────────────────
export function SeccionEntregables({ entregables }: { entregables: EntregableItem[] }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-medium text-slate-200 mb-3">
        <BarChart3 className="w-5 h-5 text-amber-400" /> Análisis de impacto
      </h2>
      {entregables.length === 0 ? (
        <p className="text-slate-400 text-sm">Todavía no hay análisis de impacto compartidos.</p>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0 divide-y divide-slate-800">
            {entregables.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-slate-200 truncate">{e.nombre}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400 hidden sm:inline">{fecha(e.updated_at)}</span>
                  <DescargarPdfBtn entregable={e} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}

// ── Línea de tiempo del proyecto ─────────────────────────────────────────────
const PUNTO_COLOR: Record<TimelineEvento['tipo'], string> = {
  documento: 'bg-emerald-500',
  entregable: 'bg-amber-500',
  notificacion: 'bg-indigo-500',
}

export function SeccionTimeline({ eventos }: { eventos: TimelineEvento[] }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-medium text-slate-200 mb-3">
        <Clock className="w-5 h-5 text-slate-400" /> Línea de tiempo del proyecto
      </h2>
      {eventos.length === 0 ? (
        <p className="text-slate-400 text-sm">Aún no hay eventos registrados.</p>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <ol className="relative border-l border-slate-800 ml-2 space-y-4">
              {eventos.map((ev) => (
                <li key={ev.id} className="ml-4">
                  <span
                    className={`absolute -left-1.5 w-3 h-3 rounded-full border-2 border-slate-900 ${PUNTO_COLOR[ev.tipo]}`}
                  />
                  <p className="text-sm text-slate-200">{ev.titulo}</p>
                  <p className="text-xs text-slate-400">{ev.detalle}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fecha(ev.fecha)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

// ── Link "Ver documentos" con scroll suave ───────────────────────────────────
export function VerDocumentosLink({ pendientes }: { pendientes: number }) {
  return (
    <button
      onClick={() => document.getElementById('documentos')?.scrollIntoView({ behavior: 'smooth' })}
      className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
    >
      Ver documentos{pendientes > 0 ? ` (${pendientes} por revisar)` : ''}
    </button>
  )
}
