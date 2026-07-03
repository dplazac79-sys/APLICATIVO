'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, X, Users, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface Organigrama {
  id: string
  nombre_archivo: string
  estado: string
  created_at: string
}

interface GlosarioAnalisis {
  id: string
  estado: string
  score_cobertura_organizacional: number
  resumen_ejecutivo: string
  alertas_criticas?: string[]
  plan_accion_30_dias?: string[]
  total_mapeados?: number
  total_equivalencias?: number
  total_crear_cargo?: number
  roles_en_procesos?: Array<{ rol: string; descripcion: string; procesos: string[] }>
  mapeos?: Array<{
    tipo: 'mapeo_directo' | 'equivalencia' | 'crear_cargo'
    rol_proceso: string
    cargo_sugerido?: string
    persona_sugerida?: string
    confianza: number
    justificacion: string
    gap_detectado?: string
    accion_recomendada: string
    skills_requeridos?: string[]
  }>
}

interface Props {
  proyectoId: string
  proyectoNombre?: string
}

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
const MAX_SIZE_MB = 10

export default function OrganigramaUploader({ proyectoId, proyectoNombre }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organigramas, setOrganigramas] = useState<Organigrama[]>([])
  const [analisis, setAnalisis] = useState<GlosarioAnalisis | null>(null)
  const [cargando, setCargando] = useState(true)
  const [lanzando, setLanzando] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [verMapeos, setVerMapeos] = useState(false)

  useEffect(() => {
    if (!proyectoId) return
    cargarDatos()
  }, [proyectoId])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [orgRes, analRes] = await Promise.all([
        fetch(`/api/portal/organigrama?proyecto_id=${proyectoId}`),
        fetch(`/api/portal/glosario-roles?proyecto_id=${proyectoId}`),
      ])
      const orgData = await orgRes.json()
      const analData = await analRes.json()
      setOrganigramas(orgData.organigramas ?? [])
      setAnalisis(analData.analisis ?? null)
    } catch { /* silent */ }
    finally { setCargando(false) }
  }

  function validarArchivo(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return `Formato no soportado. Usa PDF, PNG o JPG.`
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `El archivo supera ${MAX_SIZE_MB} MB.`
    return null
  }

  async function subirOrganigrama(file: File) {
    const err = validarArchivo(file)
    if (err) { setError(err); return }
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('proyecto_id', proyectoId)
      const res = await fetch('/api/portal/organigrama', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al subir'); return }
      // Recargar datos — el auto-trigger del análisis ya está corriendo en backend
      await cargarDatos()
      // Polling si se lanzó análisis automáticamente
      iniciarPolling()
    } catch { setError('Error de red al subir el archivo.') }
    finally { setUploading(false) }
  }

  function iniciarPolling() {
    let intentos = 0
    const poll = setInterval(async () => {
      intentos++
      const res = await fetch(`/api/portal/glosario-roles?proyecto_id=${proyectoId}`)
      const data = await res.json()
      if (data.analisis?.estado === 'completado') {
        setAnalisis(data.analisis)
        clearInterval(poll)
        setLanzando(false)
      } else if (data.analisis?.estado === 'error' || intentos >= 20) {
        if (data.analisis) setAnalisis(data.analisis)
        clearInterval(poll)
        setLanzando(false)
      } else if (data.analisis?.estado === 'generando') {
        setAnalisis(data.analisis)
        setLanzando(true)
      }
    }, 4000)
  }

  async function lanzarAnalisis() {
    setLanzando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/glosario-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al lanzar análisis'); setLanzando(false); return }
      iniciarPolling()
    } catch { setError('Error de red.'); setLanzando(false) }
  }

  const orgActual = organigramas[0] ?? null
  const tieneOrg = !!orgActual
  const analisisListo = analisis?.estado === 'completado'
  const analisisGenerando = analisis?.estado === 'generando' || lanzando

  const scoreColor = (analisis?.score_cobertura_organizacional ?? 0) >= 75
    ? 'text-emerald-400' : (analisis?.score_cobertura_organizacional ?? 0) >= 45
    ? 'text-amber-400' : 'text-red-400'
  const scoreBarColor = (analisis?.score_cobertura_organizacional ?? 0) >= 75
    ? 'bg-emerald-500' : (analisis?.score_cobertura_organizacional ?? 0) >= 45
    ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/20 to-slate-900/40 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpandido(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-900/40 border border-violet-700/30 flex items-center justify-center shrink-0">
            <Users className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Organigrama del cliente</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {tieneOrg
                ? analisisListo
                  ? `Cruce IA completado · ${analisis?.total_mapeados ?? 0} match directo · ${analisis?.total_equivalencias ?? 0} equivalencia · ${analisis?.total_crear_cargo ?? 0} a contratar`
                  : analisisGenerando
                  ? 'Analizando roles con IA…'
                  : `${orgActual.nombre_archivo} · Análisis pendiente`
                : 'Sube el organigrama para cruzar roles con IA'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {analisisListo && (
            <span className={`text-lg font-black tabular-nums ${scoreColor}`}>
              {analisis?.score_cobertura_organizacional}%
            </span>
          )}
          {analisisGenerando && (
            <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          )}
          {expandido ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expandido && (
        <div className="border-t border-violet-700/20 p-5 space-y-5">

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
            </div>
          )}

          {/* ── ZONA DE SUBIDA ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              {tieneOrg ? 'Actualizar organigrama' : 'Subir organigrama'}
            </p>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) subirOrganigrama(f)
              }}
              onClick={() => inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                dragging
                  ? 'border-violet-500 bg-violet-950/30'
                  : 'border-slate-700/50 hover:border-violet-600/60 hover:bg-violet-950/10'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirOrganigrama(f) }}
              />
              {uploading ? (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-violet-900/40 border border-violet-700/30 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
                  </div>
                  <p className="text-sm text-violet-300 font-medium">Subiendo y extrayendo texto…</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-violet-900/30 border border-violet-700/20 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200">
                      {tieneOrg ? 'Reemplazar organigrama' : 'Arrastra el organigrama aquí'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PDF, PNG o JPG · máx {MAX_SIZE_MB} MB</p>
                  </div>
                </>
              )}
            </div>

            {/* Validaciones visibles */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'PDF / PNG / JPG', ok: true },
                { label: `Máx ${MAX_SIZE_MB} MB`, ok: true },
                { label: 'Texto extraído automáticamente', ok: true },
              ].map((v, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />{v.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── ORGANIGRAMA ACTUAL ── */}
          {tieneOrg && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">{orgActual.nombre_archivo}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subido {new Date(orgActual.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {orgActual.estado === 'listo' ? ' · Texto extraído ✓' : ' · Procesando…'}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                orgActual.estado === 'listo'
                  ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-700/30 text-amber-400'
              }`}>
                {orgActual.estado === 'listo' ? 'Listo' : 'Procesando'}
              </span>
            </div>
          )}

          {/* ── CTA ANÁLISIS ── */}
          {tieneOrg && orgActual.estado === 'listo' && !analisisListo && !analisisGenerando && (
            <button
              onClick={lanzarAnalisis}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/30"
            >
              <Sparkles className="w-4 h-4" />
              Cruzar organigrama con documentos de proceso
            </button>
          )}

          {/* Generando */}
          {analisisGenerando && (
            <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 px-4 py-3 flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-xs text-violet-300 font-semibold">Motor IA analizando…</p>
                <p className="text-xs text-slate-500 mt-0.5">Leyendo roles del organigrama y cruzando contra documentos de proceso. Esto toma 20–40 segundos.</p>
              </div>
            </div>
          )}

          {/* ── RESULTADOS DEL ANÁLISIS ── */}
          {analisisListo && analisis && (
            <div className="space-y-4">

              {/* Score + resumen */}
              <div className="rounded-2xl border border-violet-700/30 bg-violet-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Cobertura organizacional</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-black tabular-nums ${scoreColor}`}>
                      {analisis.score_cobertura_organizacional}%
                    </span>
                    <button
                      onClick={lanzarAnalisis}
                      disabled={lanzando}
                      className="text-xs text-slate-500 hover:text-violet-400 transition-colors flex items-center gap-1"
                      title="Re-analizar"
                    >
                      <RefreshCw className={`w-3 h-3 ${lanzando ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${scoreBarColor}`}
                    style={{ width: `${analisis.score_cobertura_organizacional}%` }} />
                </div>
                <div className="flex gap-4 pt-1">
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{analisis.total_mapeados ?? 0} match directo
                  </span>
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{analisis.total_equivalencias ?? 0} equivalencia
                  </span>
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{analisis.total_crear_cargo ?? 0} a contratar
                  </span>
                </div>
                {analisis.resumen_ejecutivo && (
                  <p className="text-xs text-slate-400 leading-relaxed border-t border-violet-700/20 pt-3">
                    {analisis.resumen_ejecutivo}
                  </p>
                )}
              </div>

              {/* Alertas críticas */}
              {analisis.alertas_criticas && analisis.alertas_criticas.length > 0 && (
                <div className="rounded-xl border border-red-700/30 bg-red-950/10 p-4 space-y-2">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Alertas críticas de cobertura
                  </p>
                  {analisis.alertas_criticas.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-500 text-xs shrink-0 mt-0.5">▸</span>
                      <p className="text-xs text-red-300 leading-relaxed">{a}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Plan 30 días */}
              {analisis.plan_accion_30_dias && analisis.plan_accion_30_dias.length > 0 && (
                <div className="rounded-xl border border-violet-700/30 bg-violet-950/10 p-4 space-y-2">
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Plan de acción — 30 días</p>
                  {analisis.plan_accion_30_dias.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-800/60 border border-violet-700/40 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0">{i+1}</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{p}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Ver mapeos detallados */}
              {analisis.mapeos && analisis.mapeos.length > 0 && (
                <div>
                  <button
                    onClick={() => setVerMapeos(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50 transition-all text-xs font-semibold text-slate-400"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      Ver detalle de roles ({analisis.mapeos.length} roles analizados)
                    </span>
                    {verMapeos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {verMapeos && (
                    <div className="mt-2 space-y-2">
                      {analisis.mapeos.map((m, i) => {
                        const borderColor = m.tipo === 'mapeo_directo' ? 'border-emerald-800/30' : m.tipo === 'equivalencia' ? 'border-amber-800/30' : 'border-red-800/30'
                        const barColor = m.tipo === 'mapeo_directo' ? 'bg-emerald-500' : m.tipo === 'equivalencia' ? 'bg-amber-500' : 'bg-red-500'
                        const label = m.tipo === 'mapeo_directo' ? '✓ Match directo' : m.tipo === 'equivalencia' ? '⇄ Equivalencia' : '✕ Crear cargo'
                        const labelColor = m.tipo === 'mapeo_directo' ? 'text-emerald-400' : m.tipo === 'equivalencia' ? 'text-amber-400' : 'text-red-400'
                        return (
                          <div key={i} className={`rounded-xl border ${borderColor} overflow-hidden`}>
                            <div className={`w-full h-0.5 ${barColor}`} />
                            <div className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-slate-500">Rol requerido por el proceso</p>
                                  <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                </div>
                                <span className={`text-[10px] font-bold ${labelColor} shrink-0`}>{label}</span>
                              </div>
                              {(m.persona_sugerida || m.cargo_sugerido) && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-500">→</span>
                                  <span className="text-slate-200 font-medium">{m.persona_sugerida ?? m.cargo_sugerido}</span>
                                  {m.persona_sugerida && m.cargo_sugerido && <span className="text-slate-500">({m.cargo_sugerido})</span>}
                                </div>
                              )}
                              {/* Barra de confianza */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${m.confianza}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-500 tabular-nums">{m.confianza}%</span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                              {m.gap_detectado && (
                                <p className="text-[11px] text-amber-300 leading-relaxed bg-amber-950/20 rounded-lg px-3 py-1.5">
                                  Gap: {m.gap_detectado}
                                </p>
                              )}
                              {m.skills_requeridos && m.skills_requeridos.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {m.skills_requeridos.map((s, si) => (
                                    <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/40 text-slate-400">{s}</span>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-start gap-1.5 bg-slate-700/30 rounded-lg px-3 py-2">
                                <Sparkles className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-slate-300 leading-relaxed">{m.accion_recomendada}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Estado: sin documentos aún */}
          {!cargando && !tieneOrg && (
            <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 p-4 text-center space-y-2">
              <p className="text-xs text-slate-500">
                Una vez subas el organigrama, AICOUNTS extraerá automáticamente su texto, leerá los roles de todos los documentos de proceso cargados, y cruzará ambos con IA para decirte quién puede cubrir cada rol, qué brechas existen, y qué perfiles necesitas contratar.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
