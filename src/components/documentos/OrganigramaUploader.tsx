'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Users, Sparkles, ChevronDown, ChevronUp, ChevronRight, Info } from 'lucide-react'
import ProyectoSelectorDropdown from './ProyectoSelectorDropdown'

interface Organigrama {
  id: string
  nombre_archivo: string
  estado: string
  created_at: string
}

interface MapeoRol {
  tipo: 'mapeo_directo' | 'equivalencia' | 'crear_cargo'
  rol_proceso: string
  cargo_sugerido?: string
  persona_sugerida?: string
  confianza: number
  justificacion: string
  gap_detectado?: string
  accion_recomendada: string
  skills_requeridos?: string[]
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
  mapeos?: MapeoRol[]
}

interface Proyecto {
  id: string
  nombre: string
  cliente: { razon_social: string } | null
}

interface Props {
  proyectos: Proyecto[]
  proyectoPreseleccionado?: string | null
}

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
const MAX_SIZE_MB = 10

export default function OrganigramaUploader({ proyectos, proyectoPreseleccionado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [proyectoId, setProyectoId] = useState<string>(
    proyectoPreseleccionado ?? (proyectos.length === 1 ? proyectos[0].id : '')
  )
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advertenciaSubida, setAdvertenciaSubida] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)
  const [verMapeos, setVerMapeos] = useState(false)
  const [lanzando, setLanzando] = useState(false)
  const [organigramas, setOrganigramas] = useState<Organigrama[]>([])
  const [analisis, setAnalisis] = useState<GlosarioAnalisis | null>(null)
  const [cargando, setCargando] = useState(false)

  // cargarDatos se llama tanto desde el effect (al cambiar de proyecto) como
  // manualmente tras subir un archivo — este ref permite descartar respuestas
  // de un fetch para un proyecto que ya no es el vigente (ej. usuario cambia
  // de proyecto dos veces rápido), sin importar desde dónde se disparó el fetch.
  const proyectoVigenteRef = useRef(proyectoId)
  proyectoVigenteRef.current = proyectoId

  useEffect(() => {
    if (!proyectoId) return
    cargarDatos(proyectoId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  async function cargarDatos(pid: string) {
    setCargando(true)
    try {
      const [orgRes, analRes] = await Promise.all([
        fetch(`/api/portal/organigrama?proyecto_id=${pid}`),
        fetch(`/api/portal/glosario-roles?proyecto_id=${pid}`),
      ])
      const orgData = await orgRes.json()
      const analData = await analRes.json()
      if (proyectoVigenteRef.current !== pid) return
      setOrganigramas(orgData.organigramas ?? [])
      setAnalisis(analData.analisis ?? null)
      if (analData.analisis?.estado === 'generando') iniciarPolling(pid)
    } catch { /* silent */ }
    finally { if (proyectoVigenteRef.current === pid) setCargando(false) }
  }

  function validarArchivo(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Formato no soportado. Usa PDF, PNG o JPG.'
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `El archivo supera ${MAX_SIZE_MB} MB.`
    return null
  }

  async function subirOrganigrama(file: File) {
    if (!proyectoId) { setError('Selecciona un proyecto primero.'); return }
    const err = validarArchivo(file)
    if (err) { setError(err); return }
    setError(null)
    setAdvertenciaSubida(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('proyecto_id', proyectoId)
      const res = await fetch('/api/portal/organigrama', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al subir'); return }
      await cargarDatos(proyectoId)
      // Si el backend no pudo leer texto del archivo (imagen, escaneo, u
      // otro formato), no hay análisis que lanzar — antes esto igual
      // arrancaba el polling y mostraba "Analizando roles con IA…" 80
      // segundos sin que nada estuviera corriendo.
      if (data.advertencia) {
        setAdvertenciaSubida(data.advertencia)
      } else {
        iniciarPolling(proyectoId)
      }
    } catch { setError('Error de red al subir el archivo.') }
    finally { setUploading(false) }
  }

  function iniciarPolling(pid: string) {
    setLanzando(true)
    let intentos = 0
    const poll = setInterval(async () => {
      intentos++
      try {
        const res = await fetch(`/api/portal/glosario-roles?proyecto_id=${pid}`)
        const data = await res.json()
        setAnalisis(data.analisis ?? null)
        if (data.analisis?.estado === 'completado' || data.analisis?.estado === 'error' || intentos >= 20) {
          clearInterval(poll)
          setLanzando(false)
        }
      } catch { clearInterval(poll); setLanzando(false) }
    }, 4000)
  }

  async function lanzarAnalisis() {
    if (!proyectoId) return
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
      iniciarPolling(proyectoId)
    } catch { setError('Error de red.'); setLanzando(false) }
  }

  const orgActual = organigramas[0] ?? null
  const tieneOrg = !!orgActual
  const analisisListo = analisis?.estado === 'completado'
  const analisisGenerando = analisis?.estado === 'generando' || lanzando
  const score = analisis?.score_cobertura_organizacional ?? 0
  const scoreColor = score >= 75 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400'
  const scoreBarColor = score >= 75 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/20 to-slate-900/40">

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpandido(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-900/40 border border-violet-700/30 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Organigrama del cliente</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {!proyectoId
                ? 'Selecciona un proyecto para gestionar el organigrama'
                : tieneOrg
                ? analisisListo
                  ? `Cruce IA completado · ${analisis?.total_mapeados ?? 0} match · ${analisis?.total_equivalencias ?? 0} equiv · ${analisis?.total_crear_cargo ?? 0} contratar`
                  : analisisGenerando
                  ? 'Analizando roles con IA…'
                  : `${orgActual.nombre_archivo} · Análisis pendiente`
                : 'Sin organigrama cargado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {analisisListo && (
            <span className={`text-lg font-black tabular-nums ${scoreColor}`}>{score}%</span>
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

          {/* Advertencia: el archivo se guardó pero no se pudo leer su texto */}
          {advertenciaSubida && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-2 text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">{advertenciaSubida}</span>
              <button onClick={() => setAdvertenciaSubida(null)} className="text-amber-500 hover:text-amber-300 shrink-0">✕</button>
            </div>
          )}

          {/* ── SELECTOR DE PROYECTO ── */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Proyecto</p>
            <ProyectoSelectorDropdown proyectos={proyectos} proyectoId={proyectoId} onChange={setProyectoId} placeholder="Selecciona un proyecto…" />
          </div>

          {/* Contenido dependiente del proyecto */}
          {proyectoId && (
            <>
              {/* Drop zone */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {tieneOrg ? 'Reemplazar organigrama' : 'Subir organigrama'}
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setDragging(false)
                    const f = e.dataTransfer.files[0]; if (f) subirOrganigrama(f)
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                    dragging ? 'border-violet-500 bg-violet-950/30' : 'border-slate-700/50 hover:border-violet-600/60 hover:bg-violet-950/10'
                  }`}
                >
                  <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) subirOrganigrama(f) }} />
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
                          Arrastra el organigrama aquí o <span className="text-violet-400">haz clic para seleccionar</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">PDF, PNG o JPG · máx {MAX_SIZE_MB} MB</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  {['PDF con texto seleccionable', `Máx ${MAX_SIZE_MB} MB`, 'No sirven fotos ni escaneos', 'Cruce IA con procesos'].map((v, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />{v}
                    </span>
                  ))}
                </div>

                {/* Cómo debe estar escrito — sin esto, un cliente sube "cualquier
                    archivo" (una foto del organigrama de la pared, un PDF con solo
                    nombres sin cargo, etc.) esperando el mismo resultado que un
                    archivo bien estructurado, y el cruce de roles sale pobre o
                    vacío sin que entienda por qué. */}
                <div className="mt-4 rounded-xl border border-violet-700/20 bg-violet-950/10 p-4">
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Info className="w-3 h-3" /> Cómo debe estar escrito para que el cruce funcione
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">
                    Por cada persona, el documento debe indicar tres datos como texto (no como imagen dentro del PDF):
                  </p>
                  <ul className="text-xs text-slate-400 leading-relaxed space-y-1 mb-3 list-disc list-inside">
                    <li><span className="text-slate-200 font-medium">Cargo</span> — lo más específico posible. &quot;Jefe de Bodega Central&quot; le sirve más a la IA que &quot;Encargado&quot;.</li>
                    <li><span className="text-slate-200 font-medium">Nombre</span> de la persona que ocupa ese cargo.</li>
                    <li><span className="text-slate-200 font-medium">Área o departamento</span> al que pertenece.</li>
                  </ul>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">
                    Ejemplo de una línea bien escrita: <span className="text-slate-300 font-mono text-[11px]">Jefe de Supply Chain — Carolina Vidal — Área: Cadena de Suministro</span>
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Con esos tres datos por persona, la IA puede comparar cada cargo real contra los roles que exige cada proceso y decidir: si hay un <span className="text-emerald-400">calce directo</span>, si alguien de tu equipo podría cubrirlo por <span className="text-amber-400">equivalencia de funciones</span> aunque el cargo se llame distinto, o si de verdad falta <span className="text-red-400">crear el cargo</span>. Sin cargo o sin nombre, ese cruce no se puede hacer — la persona queda invisible para el análisis aunque el archivo se haya subido bien.
                  </p>
                </div>
              </div>

              {/* Organigrama actual */}
              {tieneOrg && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{orgActual.nombre_archivo}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(orgActual.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {orgActual.estado === 'listo' ? ' · Texto extraído ✓' : orgActual.estado === 'error' ? ' · No se pudo leer el texto' : ' · Procesando…'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                    orgActual.estado === 'listo'
                      ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-400'
                      : orgActual.estado === 'error'
                      ? 'bg-red-950/40 border-red-700/30 text-red-400'
                      : 'bg-amber-950/40 border-amber-700/30 text-amber-400'
                  }`}>
                    {orgActual.estado === 'listo' ? 'Listo' : orgActual.estado === 'error' ? 'No legible' : 'Procesando'}
                  </span>
                </div>
              )}

              {tieneOrg && orgActual.estado === 'error' && (
                <div className="rounded-lg border border-red-700/30 bg-red-950/10 px-4 py-2.5 text-xs text-red-300">
                  No se pudo leer el texto de este archivo, así que no se puede cruzar con los procesos. Sube una versión en PDF con texto seleccionable (exportada desde Word, Excel o Google Docs) — no una foto ni un escaneo.
                </div>
              )}

              {/* CTA análisis */}
              {tieneOrg && orgActual.estado === 'listo' && !analisisListo && !analisisGenerando && (
                <button onClick={lanzarAnalisis}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/30">
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
                    <p className="text-xs text-slate-400 mt-0.5">Cruzando roles del organigrama con documentos de proceso. 20–40 s.</p>
                  </div>
                </div>
              )}

              {/* Sin organigrama */}
              {!tieneOrg && !cargando && (
                <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 p-4 text-center">
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                    Sube el organigrama del cliente. AICOUNTS extraerá su texto, lo cruzará con los roles de todos los documentos de proceso y entregará un diagnóstico de cobertura organizacional.
                  </p>
                </div>
              )}

              {/* Resultados */}
              {analisisListo && analisis && (
                <div className="space-y-4">
                  {/* Score bar */}
                  <div className="rounded-2xl border border-violet-700/30 bg-violet-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Cobertura organizacional</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-black tabular-nums ${scoreColor}`}>{score}%</span>
                        <button onClick={lanzarAnalisis} disabled={lanzando} title="Re-analizar"
                          className="text-slate-400 hover:text-violet-400 transition-colors">
                          <RefreshCw className={`w-3 h-3 ${lanzando ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className={`h-full rounded-full ${scoreBarColor}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" />{analisis.total_mapeados ?? 0} match directo</span>
                      <span className="flex items-center gap-1.5 text-xs text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" />{analisis.total_equivalencias ?? 0} equivalencia</span>
                      <span className="flex items-center gap-1.5 text-xs text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />{analisis.total_crear_cargo ?? 0} a contratar</span>
                    </div>
                    {analisis.resumen_ejecutivo && (
                      <p className="text-xs text-slate-400 leading-relaxed border-t border-violet-700/20 pt-3">{analisis.resumen_ejecutivo}</p>
                    )}
                  </div>

                  {/* Alertas */}
                  {(analisis.alertas_criticas?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-red-700/30 bg-red-950/10 p-4 space-y-2">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> Alertas críticas
                      </p>
                      {analisis.alertas_criticas!.map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-red-500 text-xs shrink-0 mt-0.5">▸</span>
                          <p className="text-xs text-red-300 leading-relaxed">{a}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Plan */}
                  {(analisis.plan_accion_30_dias?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-violet-700/30 bg-violet-950/10 p-4 space-y-2">
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Plan de acción — 30 días</p>
                      {analisis.plan_accion_30_dias!.map((p, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-800/60 border border-violet-700/40 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0">{i+1}</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{p}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Detalle roles */}
                  {(analisis.mapeos?.length ?? 0) > 0 && (
                    <div>
                      <button onClick={() => setVerMapeos(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50 transition-all text-xs font-semibold text-slate-400">
                        <span className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" />
                          Ver detalle de roles ({analisis.mapeos!.length} analizados)
                        </span>
                        {verMapeos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {verMapeos && (
                        <div className="mt-2 space-y-2">
                          {analisis.mapeos!.map((m, i) => {
                            const esDir = m.tipo === 'mapeo_directo'
                            const esEq = m.tipo === 'equivalencia'
                            const bc = esDir ? 'border-emerald-800/30' : esEq ? 'border-amber-800/30' : 'border-red-800/30'
                            const bar = esDir ? 'bg-emerald-500' : esEq ? 'bg-amber-500' : 'bg-red-500'
                            const lbl = esDir ? '✓ Match directo' : esEq ? '⇄ Equivalencia' : '✕ Crear cargo'
                            const lc = esDir ? 'text-emerald-400' : esEq ? 'text-amber-400' : 'text-red-400'
                            return (
                              <div key={i} className={`rounded-xl border ${bc} overflow-hidden`}>
                                <div className={`w-full h-0.5 ${bar}`} />
                                <div className="p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Rol requerido</p>
                                      <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold ${lc} shrink-0`}>{lbl}</span>
                                  </div>
                                  {(m.persona_sugerida || m.cargo_sugerido) && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-slate-500">→</span>
                                      <span className="text-slate-200 font-medium">{m.persona_sugerida ?? m.cargo_sugerido}</span>
                                      {m.persona_sugerida && m.cargo_sugerido && <span className="text-slate-400">({m.cargo_sugerido})</span>}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                                      {/* Sin clamp acá antes — mismo hallazgo que ConfianzaBar en GlosarioRoles.tsx */}
                                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, m.confianza))}%` }} />
                                    </div>
                                    <span className="text-[10px] text-slate-400 tabular-nums">{Math.max(0, Math.min(100, m.confianza))}%</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                  {m.gap_detectado && (
                                    <p className="text-[11px] text-amber-300 bg-amber-950/20 rounded-lg px-3 py-1.5">Gap: {m.gap_detectado}</p>
                                  )}
                                  {(m.skills_requeridos?.length ?? 0) > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {m.skills_requeridos!.map((s, si) => (
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
