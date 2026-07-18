'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Brain, Sparkles, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Clock, Zap, Target, AlertTriangle, TrendingUp, Users, ArrowRight,
  Activity, Shield, BarChart3, Cpu, Layers, FileText, AlertCircle,
  Pencil, Save, X, RefreshCw
} from 'lucide-react'
import type { ProcesoConHijos, DocAnalisis } from './types'
import { SALUD_CONFIG, AUTOMATIZACION_CONFIG, CRITICIDAD_CONFIG } from './config'
import { ProcesoTabContent } from './ProcesoTabContent'

interface Resumen {
  diagnostico: string
  estado_salud: 'critico' | 'en_riesgo' | 'estable' | 'optimizado'
  nivel_madurez?: string
  impacto_negocio: string
  quick_win: string
  potencial_automatizacion: 'alto' | 'medio' | 'bajo'
  siguiente_paso: string
  brechas_principales?: string[]
  oportunidades_valor?: string[]
  riesgos_criticos?: string[]
  benchmark_industria?: string
  ancla_documental?: boolean
  documentos_considerados?: number
}

type Correccion = {
  tipo: 'riesgo' | 'hallazgo' | 'brecha' | 'rol'
  indice: number
  observacion: string
  estado: 'atendido' | 'archivado'
  fecha: string
}
type VersionDoc = {
  numero: number
  fecha: string
  descripcion: string
  correcciones_aplicadas: number
}

type ChecklistItem = { indice: number; texto: string; accion: 'realizado' | 'descartado'; fecha: string }

interface MetadataIA {
  resumen_ia?: Resumen
  oportunidades_checkeadas?: ChecklistItem[]
  quickwins_checkeados?: ChecklistItem[]
  pasos_checkeados?: ChecklistItem[]
  proyeccion_ia?: unknown
  correcciones?: Correccion[]
  versiones?: VersionDoc[]
  documento_referencia?: string
  justificacion_ia?: string
  puntos_mejora?: Array<{ id: string; texto: string; categoria: string | null; justificacion: string | null; estado: 'propuesto' | 'aceptado' | 'rechazado' }>
  [key: string]: unknown
}

export function ProcesoCard({ proceso, esHijo = false, proyectoId }: { proceso: ProcesoConHijos; esHijo?: boolean; proyectoId: string }) {
  const router = useRouter()
  const [expandido, setExpandido] = useState(false)
  const [tabDoc, setTabDoc] = useState<'proceso' | 'hallazgos' | 'oportunidades' | 'roles' | 'versiones'>('proceso')
  const [docAnalisis, setDocAnalisis] = useState<DocAnalisis | null>(null)
  const [cargandoDoc, setCargandoDoc] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [errorIA, setErrorIA] = useState<string | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(
    (proceso.metadata_ia as MetadataIA | null)?.resumen_ia ?? null
  )
  const [aprobando, setAprobando] = useState(false)
  const [estadoLocal, setEstadoLocal] = useState(proceso.estado_oferta)
  const [errorCorr, setErrorCorr] = useState<string | null>(null)
  const [versionDetalle, setVersionDetalle] = useState<number | null>(null)
  const [docVisorUrl, setDocVisorUrl] = useState<string | null>(null)
  const [cargandoVisor, setCargandoVisor] = useState(false)
  // Checklist persistente para oportunidades, quick wins y próximos pasos
  const [opChecked, setOpChecked] = useState<ChecklistItem[]>(
    ((proceso.metadata_ia as MetadataIA | null)?.oportunidades_checkeadas ?? [])
  )
  const [qwChecked, setQwChecked] = useState<ChecklistItem[]>(
    ((proceso.metadata_ia as MetadataIA | null)?.quickwins_checkeados ?? [])
  )
  const [pasosChecked, setPasosChecked] = useState<ChecklistItem[]>(
    ((proceso.metadata_ia as MetadataIA | null)?.pasos_checkeados ?? [])
  )

  // Puntos de mejora detectados por Discovery IA sobre este proceso —
  // cada uno se acepta o rechaza por separado, no en bloque.
  type PuntoMejora = { id: string; texto: string; categoria: string | null; justificacion: string | null; estado: 'propuesto' | 'aceptado' | 'rechazado' }
  const [puntosMejora, setPuntosMejora] = useState<PuntoMejora[]>(
    ((proceso.metadata_ia as MetadataIA | null)?.puntos_mejora ?? []) as PuntoMejora[]
  )
  const [guardandoPunto, setGuardandoPunto] = useState<string | null>(null)
  async function cambiarEstadoPunto(puntoId: string, estado: PuntoMejora['estado']) {
    setGuardandoPunto(puntoId)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/puntos-mejora`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ punto_id: puntoId, estado }),
      })
      if (!res.ok) return
      setPuntosMejora(prev => prev.map(p => p.id === puntoId ? { ...p, estado } : p))
    } finally { setGuardandoPunto(null) }
  }

  // Correcciones y versiones
  const metaInit = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const [correcciones, setCorrecciones] = useState<Correccion[]>((metaInit.correcciones ?? []) as Correccion[])
  const [versiones, setVersiones] = useState<VersionDoc[]>((metaInit.versiones ?? []) as VersionDoc[])
  const [textoCorr, setTextoCorr] = useState<Record<string, string>>({})
  const [expandCorr, setExpandCorr] = useState<Record<string, boolean>>({})
  const [guardandoCorr, setGuardandoCorr] = useState(false)
  const [generandoVersion, setGenerandoVersion] = useState(false)

  function claveCorr(tipo: string, indice: number) { return `${tipo}-${indice}` }
  function esAtendido(tipo: string, indice: number) {
    return correcciones.some(c => c.tipo === (tipo as Correccion['tipo']) && c.indice === indice && (c.estado === 'atendido' || c.estado === 'archivado'))
  }

  async function marcarAtendido(tipo: Correccion['tipo'], indice: number) {
    const obs = textoCorr[claveCorr(tipo, indice)] ?? ''
    if (!obs.trim()) { setErrorCorr('Debes escribir una observación antes de registrar.'); return }
    setErrorCorr(null)
    const nuevas = correcciones.filter(c => !(c.tipo === tipo && c.indice === indice))
    const nueva: Correccion = { tipo, indice, observacion: obs, estado: 'atendido', fecha: new Date().toISOString() }
    const updated = [...nuevas, nueva]
    setCorrecciones(updated)
    setExpandCorr(prev => ({ ...prev, [claveCorr(tipo, indice)]: false }))
    setGuardandoCorr(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/correcciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones: updated }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setErrorCorr(e.error ?? 'Error al guardar. Intenta de nuevo.')
      }
    } catch { setErrorCorr('Error de red. Intenta de nuevo.') }
    finally { setGuardandoCorr(false) }
  }

  async function desmarcarAtendido(tipo: Correccion['tipo'], indice: number) {
    const updated = correcciones.filter(c => !(c.tipo === tipo && c.indice === indice))
    setCorrecciones(updated)
    setErrorCorr(null)
    try {
      await fetch(`/api/procesos/${proceso.id}/correcciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones: updated }),
      })
    } catch { /* best effort */ }
  }

  async function generarNuevaVersion() {
    if (generandoVersion) return // guardia síncrona — evita consolidar dos versiones por doble clic
    setGenerandoVersion(true)
    setErrorCorr(null)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/nueva-version`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setVersiones(data.versiones)
        setCorrecciones(prev => prev.map(c => c.estado === 'atendido' ? { ...c, estado: 'archivado' as const } : c))
        setTabDoc('versiones')
        setVersionDetalle(data.version.numero)
      } else {
        setErrorCorr(data.error ?? 'Error al generar versión.')
      }
    } catch { setErrorCorr('Error de red al generar versión.') }
    finally { setGenerandoVersion(false) }
  }

  async function toggleChecked(
    indice: number, texto: string, accion: 'realizado' | 'descartado',
    current: Array<{indice:number;texto:string;accion:'realizado'|'descartado';fecha:string}>,
    setter: React.Dispatch<React.SetStateAction<Array<{indice:number;texto:string;accion:'realizado'|'descartado';fecha:string}>>>,
    key: string
  ) {
    const yaExiste = current.find(o => o.indice === indice)
    const updated = yaExiste
      ? current.filter(o => o.indice !== indice)
      : [...current, { indice, texto, accion, fecha: new Date().toISOString() }]
    setter(updated)
    try {
      await fetch(`/api/procesos/${proceso.id}/correcciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones, [key]: updated }),
      })
    } catch { /* best effort */ }
  }

  const toggleOportunidad = (i: number, t: string, a: 'realizado'|'descartado') =>
    toggleChecked(i, t, a, opChecked, setOpChecked, 'oportunidades_checkeadas')
  const toggleQW = (i: number, t: string, a: 'realizado'|'descartado') =>
    toggleChecked(i, t, a, qwChecked, setQwChecked, 'quickwins_checkeados')
  const togglePaso = (i: number, t: string, a: 'realizado'|'descartado') =>
    toggleChecked(i, t, a, pasosChecked, setPasosChecked, 'pasos_checkeados')

  async function abrirDocumento(documentoId: string) {
    setCargandoVisor(true)
    // Revocar blob URL anterior si existe
    if (docVisorUrl?.startsWith('blob:')) URL.revokeObjectURL(docVisorUrl)
    setDocVisorUrl(null)
    try {
      const res = await fetch(`/api/documentos/pdf-proxy?id=${documentoId}`)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        console.error('[abrirDocumento] proxy error:', res.status, errBody)
        setErrorCorr(`Error ${res.status}: ${errBody?.error ?? 'No se pudo abrir el documento'}`)
        return
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      setDocVisorUrl(blobUrl)
    } catch (e) {
      console.error('[abrirDocumento] catch:', e)
      setErrorCorr('Error al abrir el documento.')
    }
    finally { setCargandoVisor(false) }
  }

  const atendidasActivas = correcciones.filter(c => c.estado === 'atendido').length

  // Glosario de roles (análisis organigrama cross-reference)
  type MapeoRol = {
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
  type GlosarioAnalisis = {
    id: string
    score_cobertura_organizacional: number
    resumen_ejecutivo: string
    alertas_criticas?: string[]
    plan_accion_30_dias?: string[]
    mapeos: MapeoRol[]
    estado: string
    total_mapeados?: number
    total_equivalencias?: number
    total_crear_cargo?: number
  }
  const [glosarioData, setGlosarioData] = useState<GlosarioAnalisis | null>(null)
  const [cargandoGlosario, setCargandoGlosario] = useState(false)
  const [glosarioCargado, setGlosarioCargado] = useState(false)
  const [lanzandoGlosario, setLanzandoGlosario] = useState(false)
  const [errorGlosario, setErrorGlosario] = useState<string | null>(null)

  useEffect(() => {
    if (tabDoc === 'roles' && !glosarioCargado && !cargandoGlosario) {
      setCargandoGlosario(true)
      fetch(`/api/portal/glosario-roles?proyecto_id=${proyectoId}`)
        .then(r => r.json())
        .then(d => { if (d.analisis) setGlosarioData(d.analisis) })
        .catch(() => {})
        .finally(() => { setCargandoGlosario(false); setGlosarioCargado(true) })
    }
  }, [tabDoc, glosarioCargado, cargandoGlosario, proyectoId])

  const glosarioPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Si el usuario navega fuera de esta tarjeta a mitad del análisis, el
    // polling seguía llamando setState sobre un componente ya desmontado.
    return () => { if (glosarioPollRef.current) clearInterval(glosarioPollRef.current) }
  }, [])

  async function lanzarAnalisisRoles() {
    if (lanzandoGlosario) return
    setLanzandoGlosario(true)
    setErrorGlosario(null)
    try {
      const res = await fetch('/api/portal/glosario-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorGlosario(data.error ?? 'Error al lanzar análisis'); setLanzandoGlosario(false); return }
      // Polling cada 4s hasta que el estado sea completado o error (máx 60s)
      let intentos = 0
      glosarioPollRef.current = setInterval(async () => {
        intentos++
        const r = await fetch(`/api/portal/glosario-roles?proyecto_id=${proyectoId}`)
        const d = await r.json()
        if (d.analisis?.estado === 'completado') {
          setGlosarioData(d.analisis)
          if (glosarioPollRef.current) clearInterval(glosarioPollRef.current)
          setLanzandoGlosario(false)
        } else if (d.analisis?.estado === 'error' || intentos >= 15) {
          setErrorGlosario(d.analisis?.error_msg ?? 'El análisis tardó demasiado. Intenta de nuevo.')
          if (glosarioPollRef.current) clearInterval(glosarioPollRef.current)
          setLanzandoGlosario(false)
        }
      }, 4000)
    } catch { setErrorGlosario('Error de red.'); setLanzandoGlosario(false) }
  }

  // Inline edit state
  const [editando, setEditando] = useState(false)
  const [editNombre, setEditNombre] = useState(proceso.nombre)
  const [editDesc, setEditDesc] = useState(proceso.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)

  // Proyección IA
  type Proyeccion = {
    estado_actual: { diagnostico: string; nivel_madurez: number; principales_fricciones: string[]; costo_ineficiencia_estimado: string }
    mejoras_propuestas: Array<{ id: string; titulo: string; descripcion: string; impacto: string; esfuerzo: string; tipo: string; plazo_semanas: number; valor_estimado: string }>
    escenarios: { conservador: { descripcion: string; ahorro_estimado: string; probabilidad: number }; base: { descripcion: string; ahorro_estimado: string; probabilidad: number }; optimista: { descripcion: string; ahorro_estimado: string; probabilidad: number } }
    roadmap_90_dias: Array<{ semana: string; accion: string; responsable: string; entregable: string }>
    proyeccion_kpis: Array<{ kpi: string; valor_actual: string; valor_6_meses: string; valor_12_meses: string; unidad: string }>
    recomendacion_ejecutiva: string
    nivel_confianza: number
  }
  const proyeccionGuardada = (proceso.metadata_ia as MetadataIA | null)?.proyeccion_ia as Proyeccion | undefined
  const [proyeccion, setProyeccion] = useState<Proyeccion | null>(proyeccionGuardada ?? null)
  const [proyectando, setProyectando] = useState(false)
  const [errorProyeccion, setErrorProyeccion] = useState<string | null>(null)
  const [tabProyeccion, setTabProyeccion] = useState<'mejoras' | 'escenarios' | 'roadmap' | 'kpis'>('mejoras')

  async function generarProyeccion() {
    if (proyectando) return
    setProyectando(true)
    setErrorProyeccion(null)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/proyectar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.proyeccion) {
        setProyeccion(data.proyeccion)
      } else {
        setErrorProyeccion(data.error ?? 'Error generando la proyección. Intenta de nuevo.')
      }
    } catch {
      setErrorProyeccion('Error de conexión. Verifica tu red e intenta de nuevo.')
    }
    finally { setProyectando(false) }
  }

  async function cargarDocAnalisis() {
    if (docAnalisis || cargandoDoc) return
    setCargandoDoc(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/documento-analisis`)
      if (res.ok) setDocAnalisis(await res.json())
    } catch { /* silent */ }
    finally { setCargandoDoc(false) }
  }

  const meta = proceso.metadata_ia
  const criticidad = meta?.criticidad as string | undefined
  const critCfg = criticidad ? CRITICIDAD_CONFIG[criticidad] : null
  const saludCfg = resumen ? SALUD_CONFIG[resumen.estado_salud] ?? SALUD_CONFIG.estable : null

  const accentColor = critCfg?.accent ?? 'bg-violet-500'

  async function analizarConIA() {
    if (analizando) return
    setExpandido(true)
    if (resumen) return
    setAnalizando(true)
    setErrorIA(null)
    try {
      const res = await fetch('/api/discovery/resumir-proceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: proceso.id }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorIA(data.error ?? `Error ${res.status}`); return }
      if (data.resumen) { setResumen(data.resumen); router.refresh() }
      else setErrorIA('La IA no devolvió diagnóstico. Intenta de nuevo.')
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : 'Error de conexión')
    } finally { setAnalizando(false) }
  }

  async function reanalizarConIA() {
    setResumen(null)
    setAnalizando(true)
    setErrorIA(null)
    try {
      const res = await fetch('/api/discovery/resumir-proceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: proceso.id }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorIA(data.error ?? `Error ${res.status}`); return }
      if (data.resumen) { setResumen(data.resumen); router.refresh() }
      else setErrorIA('La IA no devolvió diagnóstico. Intenta de nuevo.')
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : 'Error de conexión')
    } finally { setAnalizando(false) }
  }

  async function cambiarEstado(nuevoEstado: 'aceptado' | 'rechazado' | 'propuesto') {
    setAprobando(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/revisar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_oferta: nuevoEstado }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrorCorr(err.error ?? `Error ${res.status} al guardar`)
        return
      }
      setEstadoLocal(nuevoEstado)
      router.refresh()
    } catch { setErrorCorr('Error de conexión al guardar') }
    finally { setAprobando(false) }
  }

  async function guardarEdicion() {
    setGuardando(true)
    try {
      await fetch(`/api/procesos/${proceso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre, descripcion: editDesc }),
      })
      setEditando(false)
    } catch { /* silent */ }
    finally { setGuardando(false) }
  }

  const estadoIcon = estadoLocal === 'aceptado'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    : estadoLocal === 'rechazado'
    ? <XCircle className="w-4 h-4 text-red-400" />
    : <Clock className="w-4 h-4 text-amber-400" />

  const tieneHijos = (proceso.hijos?.length ?? 0) > 0

  if (esHijo) {
    const meta = proceso.metadata_ia as MetadataIA | null
    const docCode = meta?.documento_referencia ? meta.documento_referencia.replace(/\.[^.]+$/, '') : null
    const justificacion: string | null = meta?.justificacion_ia ?? null

    const borderColor = estadoLocal === 'aceptado' ? 'border-emerald-700/50' :
      estadoLocal === 'rechazado' ? 'border-red-800/40' :
      proceso.origen === 'propuesta_ia' ? 'border-violet-700/50' : 'border-slate-700/50'

    const accentBar = estadoLocal === 'aceptado' ? 'bg-emerald-500' :
      estadoLocal === 'rechazado' ? 'bg-red-600' :
      critCfg?.accent ?? 'bg-slate-600'

    return (
      <div
        id={proceso.origen === 'propuesta_ia' ? `proceso-propuesta-ia-${proceso.id}` : undefined}
        className={`relative rounded-xl border transition-all duration-300 overflow-hidden ${borderColor} ${
          estadoLocal === 'rechazado' ? 'opacity-50' : ''
        } ${expandido ? 'bg-slate-900/70' : 'bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer'}`}
        onClick={() => { if (!expandido) { setExpandido(true); cargarDocAnalisis() } }}
        role={expandido ? undefined : 'button'}
        tabIndex={expandido ? undefined : 0}
        aria-expanded={expandido}
        onKeyDown={e => {
          if (!expandido && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpandido(true)
            cargarDocAnalisis()
          }
        }}
      >
        {/* Accent left bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentBar}`} />

        {/* ── Collapsed header (always visible) ── */}
        <div className="pl-3 pr-4 py-3.5 flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            estadoLocal === 'aceptado' ? 'bg-emerald-900/50 text-emerald-400' :
            estadoLocal === 'rechazado' ? 'bg-red-900/30 text-red-400' :
            'bg-slate-800 text-slate-400'
          }`}>
            {estadoIcon}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            {docCode && (
              <span className="text-xs font-bold font-mono text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">{docCode}</span>
            )}
            <p className="text-white text-sm font-semibold leading-snug">{proceso.nombre}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {estadoLocal === 'aceptado' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Aceptado</span>
            )}
            {estadoLocal === 'rechazado' && (
              <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><XCircle className="w-3.5 h-3.5" /> Rechazado</span>
            )}
            {proceso.origen === 'propuesta_ia' ? (
              <span title="Proceso propuesto por IA sin documento formal — requiere validación del consultor" className="text-xs px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-700/50 font-medium">✨ Propuesta IA</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/50 text-blue-300 border border-blue-800/40 font-medium">📄 Detectado</span>
            )}
            {expandido
              ? <button aria-label="Contraer proceso" className="text-slate-400 hover:text-slate-300 transition-colors" onClick={e => { e.stopPropagation(); setExpandido(false) }}><ChevronUp className="w-4 h-4" /></button>
              : <ChevronDown className="w-4 h-4 text-slate-500" />
            }
          </div>
        </div>

        {/* ── Expanded detail panel ── */}
        {expandido && (
          <div className="border-t border-slate-700/40" onClick={e => e.stopPropagation()}>

            {/* Loading skeleton */}
            {cargandoDoc && (
              <div className="p-6 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin shrink-0" />
                <span className="text-sm text-slate-400">Cargando análisis del documento...</span>
              </div>
            )}

            {!cargandoDoc && (
              <>
                {/* ── Tabs ── */}
                <div className="flex gap-0 border-b border-slate-700/50 bg-slate-900/40 px-4">
                  {([
                    { id: 'proceso', label: 'El Proceso', icon: FileText },
                    { id: 'hallazgos', label: 'Hallazgos', icon: AlertTriangle },
                    { id: 'oportunidades', label: 'Oportunidades', icon: TrendingUp },
                    { id: 'roles', label: 'Roles', icon: Users },
                    { id: 'versiones', label: 'Versiones', icon: Clock, badge: versiones.length },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTabDoc(t.id as typeof tabDoc)}
                      className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${
                        tabDoc === t.id
                          ? 'border-violet-500 text-violet-300'
                          : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />{t.label}
                      {'badge' in t && t.badge > 0 && (
                        <span className="bg-violet-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{t.badge}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ── TAB: El Proceso ── */}
                {tabDoc === 'proceso' && (
                  <ProcesoTabContent
                    proceso={proceso}
                    docAnalisis={docAnalisis}
                    critCfg={critCfg}
                    accentColor={accentColor}
                    justificacion={justificacion}
                  />
                )}

                {/* ── TAB: Hallazgos ── */}
                {tabDoc === 'hallazgos' && (() => {
                  const riesgosList = docAnalisis?.analisis_ia?.riesgos_criticos ?? []
                  const hallazgosList = docAnalisis?.analisis_ia?.hallazgos_criticos ?? []
                  const brechasList = docAnalisis?.analisis_ia?.brechas_documentacion ?? []
                  const totalItems = riesgosList.length + hallazgosList.length + brechasList.length
                  const resueltos = atendidasActivas
                  const pct = totalItems > 0 ? Math.round((resueltos / totalItems) * 100) : 0
                  return (
                    <div className="p-5 space-y-7">

                      {/* Error de guardado */}
                      {errorCorr && (
                        <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {errorCorr}
                          <button onClick={() => setErrorCorr(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
                        </div>
                      )}

                      {/* ── Progress header ── */}
                      {totalItems > 0 && (
                        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Estado de resolución</p>
                            <span className="text-lg font-black tabular-nums" style={{ color: pct === 100 ? '#34d399' : pct > 50 ? '#fbbf24' : '#f87171' }}>{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#059669,#34d399)' : pct > 50 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)' }} />
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">{resueltos} de {totalItems} puntos resueltos</p>
                        </div>
                      )}

                      {/* ── Exposiciones operacionales ── */}
                      {riesgosList.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center">
                                <Shield className="w-3.5 h-3.5 text-red-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Exposiciones operacionales</p>
                                <p className="text-xs text-slate-400">Riesgos activos identificados en el documento</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-950/60 border border-red-800/40 text-red-300">
                              {riesgosList.filter((_: unknown, i: number) => !esAtendido('riesgo', i)).length} activos
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(riesgosList as Array<{ riesgo: string; impacto: string; evidencia?: string }>).map((r, i) => {
                              const atendido = esAtendido('riesgo', i)
                              const key = claveCorr('riesgo', i)
                              const abierto = expandCorr[key]
                              const nivel = r.impacto === 'alto' ? 3 : r.impacto === 'medio' ? 2 : 1
                              return (
                                <div key={i}>
                                  {/* Card — overflow-hidden NO va aquí para no cortar el form */}
                                  <div className={`flex gap-0 rounded-2xl border ${
                                    atendido ? 'border-emerald-800/25 bg-emerald-950/5 opacity-60' :
                                    r.impacto === 'alto' ? 'border-red-900/50 bg-gradient-to-r from-red-950/20 to-transparent' :
                                    r.impacto === 'medio' ? 'border-amber-900/40 bg-gradient-to-r from-amber-950/15 to-transparent' :
                                    'border-slate-700/40 bg-slate-800/15'
                                  }`}>
                                    {/* Left severity bar */}
                                    <div className={`w-[3px] rounded-l-2xl shrink-0 ${
                                      atendido ? 'bg-emerald-500' :
                                      r.impacto === 'alto' ? 'bg-red-500' :
                                      r.impacto === 'medio' ? 'bg-amber-400' : 'bg-slate-500'
                                    }`} />

                                    <div className="flex-1 px-4 py-3.5">
                                      <div className="flex items-start gap-3">
                                        <p className={`text-sm font-semibold leading-snug flex-1 ${atendido ? 'line-through text-slate-400' : 'text-white'}`}>{r.riesgo}</p>
                                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                          {[1, 2, 3].map(n => (
                                            <div key={n} className={`w-2 h-2 rounded-full ${
                                              n <= nivel
                                                ? atendido ? 'bg-emerald-500' : r.impacto === 'alto' ? 'bg-red-500' : r.impacto === 'medio' ? 'bg-amber-400' : 'bg-slate-400'
                                                : 'bg-slate-700'
                                            }`} />
                                          ))}
                                          <span className={`text-xs font-bold ml-1.5 uppercase ${
                                            atendido ? 'text-emerald-400' : r.impacto === 'alto' ? 'text-red-400' : r.impacto === 'medio' ? 'text-amber-400' : 'text-slate-400'
                                          }`}>{atendido ? 'OK' : r.impacto}</span>
                                        </div>
                                      </div>

                                      {r.evidencia && !atendido && (
                                        <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                          <span className="text-red-400/70 font-medium">Evidencia · </span>{r.evidencia}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/5">
                                        {!atendido ? (
                                          <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
                                            <Pencil className="w-3 h-3" />
                                            {abierto ? 'Cerrar' : 'Registrar modificación y/o observación →'}
                                          </button>
                                        ) : (
                                          <button onClick={() => desmarcarAtendido('riesgo', i)}
                                            className="text-xs text-slate-400 hover:text-red-400 transition-colors">
                                            Reactivar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Formulario de corrección — FUERA del card para no ser cortado */}
                                  {abierto && !atendido && (
                                    <div className="mt-2 ml-3 p-4 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 space-y-3">
                                      <p className="text-xs text-emerald-400 font-semibold">¿Cómo está siendo gestionado este riesgo en tu organización?</p>
                                      <textarea
                                        value={textoCorr[key] ?? ''}
                                        onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Ej: ya implementamos un control dual desde enero 2025, la segregación de funciones está documentada en el procedimiento P-042..."
                                        rows={3}
                                        className="w-full text-sm text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                      />
                                      <div className="flex items-center gap-3">
                                        <button onClick={() => marcarAtendido('riesgo', i)} disabled={guardandoCorr}
                                          className="flex items-center gap-1.5 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                                          <CheckCircle2 className="w-4 h-4" /> Marcar como mitigado
                                        </button>
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                          className="text-xs text-slate-400 hover:text-slate-300 transition-colors">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Puntos de atención — timeline ── */}
                      {hallazgosList.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Puntos de atención</p>
                              <p className="text-xs text-slate-400">Aspectos críticos del estado actual · confirma cuáles ya están resueltos</p>
                            </div>
                          </div>

                          <div className="relative">
                            {/* Vertical line */}
                            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-gradient-to-b from-amber-700/40 via-amber-800/20 to-transparent" />

                            <div className="space-y-3">
                              {(hallazgosList as string[]).map((h, i) => {
                                const atendido = esAtendido('hallazgo', i)
                                const key = claveCorr('hallazgo', i)
                                const abierto = expandCorr[key]
                                return (
                                  <div key={i}>
                                    <div className="flex items-start gap-3">
                                      {/* Node */}
                                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                        atendido ? 'border-emerald-600/60 bg-emerald-900/50' : 'border-amber-600/50 bg-amber-950/40'
                                      }`}>
                                        {atendido
                                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                          : <span className="text-amber-300 text-sm font-black">{i + 1}</span>
                                        }
                                      </div>

                                      <div className={`flex-1 rounded-2xl border p-3.5 ${
                                        atendido ? 'border-emerald-800/20 bg-emerald-950/5' : 'border-slate-700/30 bg-slate-800/20'
                                      }`}>
                                        <p className={`text-sm leading-relaxed ${atendido ? 'line-through text-slate-400' : 'text-slate-200'}`}>{h}</p>
                                        <div className="flex items-center gap-3 mt-2.5">
                                          {!atendido ? (
                                            <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
                                              <Pencil className="w-3 h-3" /> {abierto ? 'Cerrar' : 'Registrar modificación y/o observación →'}
                                            </button>
                                          ) : (
                                            <span className="flex items-center gap-2 text-xs">
                                              <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resuelto</span>
                                              <button onClick={() => desmarcarAtendido('hallazgo', i)} className="text-slate-400 hover:text-slate-400 transition-colors">· desmarcar</button>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Formulario FUERA del flex-row para no ser cortado */}
                                    {abierto && !atendido && (
                                      <div className="mt-2 ml-14 p-4 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 space-y-3">
                                        <p className="text-xs text-emerald-400 font-semibold">¿Cómo está siendo gestionado o resuelto en tu organización?</p>
                                        <textarea
                                          value={textoCorr[key] ?? ''}
                                          onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                          placeholder="Ej: ya incorporado en nuestro proceso desde Q1, tenemos procedimiento P-021 vigente..."
                                          rows={3}
                                          className="w-full text-sm text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                        />
                                        <div className="flex items-center gap-3">
                                          <button onClick={() => marcarAtendido('hallazgo', i)}
                                            className="flex items-center gap-1.5 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors">
                                            <CheckCircle2 className="w-4 h-4" /> Marcar como resuelto
                                          </button>
                                          <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                            className="text-xs text-slate-400 hover:text-slate-300 transition-colors">
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Brechas ── */}
                      {brechasList.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Oportunidades de formalización</p>
                              <p className="text-xs text-slate-400">Áreas sin definición formal detectadas · indica cuáles ya están documentadas</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(brechasList as string[]).map((b, i) => {
                              const atendido = esAtendido('brecha', i)
                              const key = claveCorr('brecha', i)
                              const abierto = expandCorr[key]
                              return (
                                <div key={i}>
                                  <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                                    atendido
                                      ? 'border-emerald-800/25 bg-emerald-950/5 opacity-70'
                                      : 'border-slate-700/30 bg-slate-800/15'
                                  }`}>
                                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${atendido ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                    <p className={`flex-1 text-sm leading-relaxed ${atendido ? 'line-through text-slate-400' : 'text-slate-300'}`}>{b}</p>
                                    <div className="shrink-0 flex items-center gap-3">
                                      {!atendido ? (
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors whitespace-nowrap">
                                          <Pencil className="w-3 h-3" /> {abierto ? 'Cerrar' : 'Registrar oportunidad →'}
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold"><CheckCircle2 className="w-3 h-3" /> Formalizado</span>
                                          <button onClick={() => desmarcarAtendido('brecha', i)} className="text-xs text-slate-400 hover:text-slate-400 transition-colors">· desmarcar</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Formulario FUERA del card */}
                                  {abierto && !atendido && (
                                    <div className="mt-2 ml-5 p-4 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 space-y-3">
                                      <p className="text-xs text-emerald-400 font-semibold">¿Está esto ya documentado internamente?</p>
                                      <textarea
                                        value={textoCorr[key] ?? ''}
                                        onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Ej: tenemos procedimiento escrito P-014 vigente desde 2024, disponible en SharePoint..."
                                        rows={3}
                                        className="w-full text-sm text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                      />
                                      <div className="flex items-center gap-3">
                                        <button onClick={() => marcarAtendido('brecha', i)}
                                          className="flex items-center gap-1.5 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors">
                                          <CheckCircle2 className="w-4 h-4" /> Marcar como formalizado
                                        </button>
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                          className="text-xs text-slate-400 hover:text-slate-300 transition-colors">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── CTA nueva versión ── */}
                      {atendidasActivas > 0 && (
                        <div className="rounded-2xl border border-emerald-700/40 bg-gradient-to-r from-emerald-950/30 to-transparent p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-emerald-300">{atendidasActivas} punto{atendidasActivas > 1 ? 's' : ''} resuelto{atendidasActivas > 1 ? 's' : ''}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Genera la v{versiones.length + 1} del documento excluyendo los hallazgos ya incorporados en tu organización.</p>
                          </div>
                          <button onClick={generarNuevaVersion} disabled={generandoVersion}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-emerald-900/50">
                            {generandoVersion
                              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                              : <><Zap className="w-4 h-4" /> Consolidar v{versiones.length + 1}</>}
                          </button>
                        </div>
                      )}

                    </div>
                  )
                })()}

                {/* ── TAB: Oportunidades ── */}
                {tabDoc === 'oportunidades' && (() => {
                  const quickWins = (docAnalisis?.analisis_ia?.quick_wins ?? []) as string[]
                  const oportunidades = (docAnalisis?.analisis_ia?.oportunidades_valor ?? []) as Array<{ oportunidad: string; impacto_estimado: string; complejidad_implementacion: string }>
                  const pasos = (docAnalisis?.analisis_ia?.proximos_pasos_sugeridos ?? []) as string[]
                  return (
                    <div className="p-5 space-y-7">

                      {/* ── Puntos de mejora detectados por Discovery IA — accept/reject individual ── */}
                      {puntosMejora.length > 0 && (() => {
                        const pendientes = puntosMejora.filter(p => p.estado === 'propuesto')
                        const decididos = puntosMejora.filter(p => p.estado !== 'propuesto')
                        const CATEGORIA_LABEL: Record<string, string> = {
                          eficiencia: 'Eficiencia', riesgo: 'Riesgo', automatizacion: 'Automatización',
                          responsabilidad: 'Responsabilidad', cumplimiento: 'Cumplimiento',
                        }
                        return (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-lg bg-violet-950/70 border border-violet-800/50 flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Puntos de mejora — Discovery IA</p>
                                <p className="text-xs text-slate-400">
                                  Sugerencias sobre este documento · {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} de decidir
                                  {decididos.length > 0 ? ` · ${decididos.length} decidido${decididos.length !== 1 ? 's' : ''}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {puntosMejora.map(p => {
                                const guardando = guardandoPunto === p.id
                                const borde = p.estado === 'aceptado' ? 'border-emerald-700/40' : p.estado === 'rechazado' ? 'border-red-800/30 opacity-50' : 'border-violet-800/25'
                                return (
                                  <div key={p.id} className={`rounded-2xl border ${borde} bg-gradient-to-br from-violet-950/15 to-slate-900/20 p-4`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        {p.categoria && (
                                          <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-violet-300 bg-violet-900/40 border border-violet-700/40 rounded-full px-2 py-0.5 mb-1.5">
                                            {CATEGORIA_LABEL[p.categoria] ?? p.categoria}
                                          </span>
                                        )}
                                        <p className="text-white text-sm font-medium leading-snug">{p.texto}</p>
                                        {p.justificacion && (
                                          <p className="text-slate-400 text-xs leading-relaxed mt-1.5">{p.justificacion}</p>
                                        )}
                                      </div>
                                      <div className="shrink-0 flex items-center gap-2">
                                        {p.estado === 'propuesto' ? (
                                          <>
                                            <button
                                              onClick={() => cambiarEstadoPunto(p.id, 'aceptado')}
                                              disabled={guardando}
                                              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                                            >Aceptar</button>
                                            <button
                                              onClick={() => cambiarEstadoPunto(p.id, 'rechazado')}
                                              disabled={guardando}
                                              className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                            >Rechazar</button>
                                          </>
                                        ) : (
                                          <>
                                            <span className={`text-xs font-semibold ${p.estado === 'aceptado' ? 'text-emerald-400' : 'text-red-400'}`}>
                                              {p.estado === 'aceptado' ? '✓ Aceptado' : '✕ Rechazado'}
                                            </span>
                                            <button
                                              onClick={() => cambiarEstadoPunto(p.id, 'propuesto')}
                                              disabled={guardando}
                                              className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                                            >Deshacer</button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── Quick wins con checklist ── */}
                      {quickWins.length > 0 && (() => {
                        const qwCheckedIdx = new Set(qwChecked.map(o => o.indice))
                        const qwHistorial = qwChecked.slice().sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        return (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-lg bg-emerald-950/70 border border-emerald-800/50 flex items-center justify-center">
                                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Quick wins</p>
                                <p className="text-xs text-slate-400">Acciones ejecutables en menos de 30 días · {quickWins.length - qwCheckedIdx.size} activos{qwHistorial.length > 0 ? ` · ${qwHistorial.length} en historial` : ''}</p>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              {quickWins.map((q, i) => {
                                if (qwCheckedIdx.has(i)) return null
                                return (
                                  <div key={i} className="group flex items-start gap-3 rounded-2xl border border-emerald-800/25 bg-gradient-to-r from-emerald-950/20 to-transparent p-4 hover:border-emerald-700/40 transition-all duration-200">
                                    <button
                                      onClick={() => toggleQW(i, q, 'realizado')}
                                      title="Marcar como realizado"
                                      className="mt-0.5 w-5 h-5 rounded-md border-2 border-emerald-600/50 bg-emerald-950/40 hover:border-emerald-400 hover:bg-emerald-900/40 transition-all shrink-0"
                                    />
                                    <div className="flex-1">
                                      <p className="text-slate-100 text-sm leading-relaxed font-medium">{q}</p>
                                      <button onClick={() => toggleQW(i, q, 'descartado')} className="mt-1 text-xs text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">Descartar →</button>
                                    </div>
                                    <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 font-semibold whitespace-nowrap">≤ 30 días</span>
                                  </div>
                                )
                              })}
                            </div>
                            {qwHistorial.length > 0 && (
                              <div className="mt-3 rounded-xl border border-slate-700/30 bg-slate-900/40 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Historial — {qwHistorial.length} quick win{qwHistorial.length > 1 ? 's' : ''}</p>
                                </div>
                                <div className="divide-y divide-slate-700/20">
                                  {qwHistorial.map((h, hi) => (
                                    <div key={hi} className="px-4 py-3 flex items-start gap-3">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${h.accion === 'realizado' ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-400' : 'bg-slate-800/60 border-slate-700/30 text-slate-400'}`}>
                                        {h.accion === 'realizado' ? '✓ Realizado' : '✕ Descartado'}
                                      </span>
                                      <p className="flex-1 text-xs text-slate-400 line-through leading-relaxed">{h.texto}</p>
                                      <button onClick={() => toggleQW(h.indice, h.texto, h.accion)} className="text-xs text-slate-400 hover:text-emerald-400 transition-colors shrink-0">Restaurar</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ── Oportunidades de valor con checklist ── */}
                      {oportunidades.length > 0 && (() => {
                        const checkedIndices = new Set(opChecked.map(o => o.indice))
                        const activas = oportunidades.filter((_, i) => !checkedIndices.has(i))
                        const historial = opChecked.slice().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-indigo-950/70 border border-indigo-800/50 flex items-center justify-center">
                                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Oportunidades de valor</p>
                                  <p className="text-xs text-slate-400">Iniciativas de mayor alcance · {activas.length} activas{historial.length > 0 ? ` · ${historial.length} en historial` : ''}</p>
                                </div>
                              </div>
                            </div>

                            {/* Oportunidades activas */}
                            <div className="space-y-2">
                              {oportunidades.map((o, i) => {
                                const checked = checkedIndices.has(i)
                                if (checked) return null
                                const nivel = o.complejidad_implementacion === 'alta' ? 3 : o.complejidad_implementacion === 'media' ? 2 : 1
                                const color = o.complejidad_implementacion === 'alta' ? 'text-red-400' : o.complejidad_implementacion === 'media' ? 'text-amber-400' : 'text-emerald-400'
                                const dotColor = o.complejidad_implementacion === 'alta' ? 'bg-red-500' : o.complejidad_implementacion === 'media' ? 'bg-amber-400' : 'bg-emerald-500'
                                return (
                                  <div key={i} className="group rounded-2xl border border-indigo-800/20 bg-gradient-to-br from-indigo-950/15 to-slate-900/20 p-4 hover:border-indigo-700/30 transition-all">
                                    <div className="flex items-start gap-3">
                                      {/* Checkbox realizado */}
                                      <button
                                        onClick={() => toggleOportunidad(i, o.oportunidad, 'realizado')}
                                        title="Marcar como realizado"
                                        className="mt-0.5 w-5 h-5 rounded-md border-2 border-indigo-600/50 bg-indigo-950/40 hover:border-emerald-500 hover:bg-emerald-950/40 transition-all shrink-0 flex items-center justify-center"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-semibold leading-snug">{o.oportunidad}</p>
                                        {o.impacto_estimado && (
                                          <p className="text-slate-400 text-xs leading-relaxed mt-1.5">{o.impacto_estimado}</p>
                                        )}
                                        {/* Acción descartar */}
                                        <button
                                          onClick={() => toggleOportunidad(i, o.oportunidad, 'descartado')}
                                          className="mt-2 text-xs text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          Descartar →
                                        </button>
                                      </div>
                                      {/* Complexity meter */}
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        <div className="flex gap-1">
                                          {[1, 2, 3].map(n => (
                                            <div key={n} className={`w-2.5 h-2.5 rounded-full ${n <= nivel ? dotColor : 'bg-slate-700'}`} />
                                          ))}
                                        </div>
                                        <span className={`text-xs font-bold uppercase ${color}`}>
                                          {o.complejidad_implementacion === 'baja' ? 'Rápida' : o.complejidad_implementacion === 'media' ? 'Media' : 'Compleja'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Historial de oportunidades completadas/descartadas */}
                            {historial.length > 0 && (
                              <div className="mt-4 rounded-xl border border-slate-700/30 bg-slate-900/40 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Historial — {historial.length} oportunidad{historial.length > 1 ? 'es' : ''}</p>
                                </div>
                                <div className="divide-y divide-slate-700/20">
                                  {historial.map((h, hi) => {
                                    const original = oportunidades[h.indice]
                                    return (
                                      <div key={hi} className="px-4 py-3 flex items-start gap-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${
                                          h.accion === 'realizado'
                                            ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-400'
                                            : 'bg-slate-800/60 border-slate-700/30 text-slate-400'
                                        }`}>
                                          {h.accion === 'realizado' ? '✓ Realizado' : '✕ Descartado'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-xs leading-relaxed ${h.accion === 'realizado' ? 'text-slate-400 line-through' : 'text-slate-400 line-through'}`}>
                                            {h.texto}
                                          </p>
                                          {original?.impacto_estimado && (
                                            <p className="text-xs text-slate-400 mt-0.5">{original.impacto_estimado}</p>
                                          )}
                                          <p className="text-xs text-slate-400 mt-1">
                                            {new Date(h.fecha).toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' })}
                                          </p>
                                        </div>
                                        {/* Restaurar */}
                                        <button
                                          onClick={() => toggleOportunidad(h.indice, h.texto, h.accion)}
                                          className="text-xs text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                                          title="Restaurar a activas"
                                        >
                                          Restaurar
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ── Próximos pasos con checklist ── */}
                      {pasos.length > 0 && (() => {
                        const pasosIdx = new Set(pasosChecked.map(o => o.indice))
                        const pasosHistorial = pasosChecked.slice().sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        const pasosActivos = pasos.filter((_, i) => !pasosIdx.has(i))
                        return (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-6 h-6 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center">
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Próximos pasos</p>
                                <p className="text-xs text-slate-400">Secuencia recomendada · {pasosActivos.length} pendientes{pasosHistorial.length > 0 ? ` · ${pasosHistorial.length} en historial` : ''}</p>
                              </div>
                            </div>
                            <div className="relative">
                              {pasos.map((paso, i) => {
                                if (pasosIdx.has(i)) return null
                                const activoIdx = pasosActivos.indexOf(paso)
                                return (
                                  <div key={i} className="group flex gap-3 mb-3 last:mb-0">
                                    <div className="flex flex-col items-center shrink-0">
                                      <button
                                        onClick={() => togglePaso(i, paso, 'realizado')}
                                        title="Marcar como completado"
                                        className="w-8 h-8 rounded-full border-2 border-amber-600/50 bg-amber-950/40 hover:border-emerald-500 hover:bg-emerald-950/40 transition-all flex items-center justify-center"
                                      >
                                        <span className="text-amber-300 group-hover:text-emerald-300 text-xs font-black transition-colors">{activoIdx + 1}</span>
                                      </button>
                                      {activoIdx < pasosActivos.length - 1 && (
                                        <div className="w-px flex-1 min-h-[12px] bg-gradient-to-b from-amber-700/40 to-transparent mt-1" />
                                      )}
                                    </div>
                                    <div className={`flex-1 rounded-2xl border p-3.5 mb-1 ${activoIdx === 0 ? 'border-amber-700/40 bg-amber-950/15' : 'border-slate-700/30 bg-slate-800/15'}`}>
                                      {activoIdx === 0 && <p className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-wider">Siguiente</p>}
                                      <p className="text-sm text-slate-200 leading-relaxed">{paso}</p>
                                      <button onClick={() => togglePaso(i, paso, 'descartado')} className="mt-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">Descartar →</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {pasosHistorial.length > 0 && (
                              <div className="mt-3 rounded-xl border border-slate-700/30 bg-slate-900/40 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Historial — {pasosHistorial.length} paso{pasosHistorial.length > 1 ? 's' : ''}</p>
                                </div>
                                <div className="divide-y divide-slate-700/20">
                                  {pasosHistorial.map((h, hi) => (
                                    <div key={hi} className="px-4 py-3 flex items-start gap-3">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${h.accion === 'realizado' ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-400' : 'bg-slate-800/60 border-slate-700/30 text-slate-400'}`}>
                                        {h.accion === 'realizado' ? '✓ Completado' : '✕ Descartado'}
                                      </span>
                                      <p className="flex-1 text-xs text-slate-400 line-through leading-relaxed">{h.texto}</p>
                                      <button onClick={() => togglePaso(h.indice, h.texto, h.accion)} className="text-xs text-slate-400 hover:text-amber-400 transition-colors shrink-0">Restaurar</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {quickWins.length === 0 && oportunidades.length === 0 && pasos.length === 0 && (
                        <div className="py-12 text-center">
                          <TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                          <p className="text-slate-400 text-sm">El análisis del documento no detectó oportunidades de valor aún.</p>
                        </div>
                      )}

                    </div>
                  )
                })()}

                {/* ── TAB: Roles ── */}
                {tabDoc === 'roles' && (() => {
                  const mapeos: MapeoRol[] = glosarioData?.mapeos ?? []
                  // Filter mapeos relevant to this process's roles
                  const rolesDelProceso = new Set((proceso.roles_involucrados ?? []).map(r => r.toLowerCase()))
                  const mapeosRelevantes = mapeos.filter(m =>
                    rolesDelProceso.size === 0 || rolesDelProceso.has(m.rol_proceso.toLowerCase())
                  )
                  const directos   = mapeosRelevantes.filter(m => m.tipo === 'mapeo_directo')
                  const equivalencias = mapeosRelevantes.filter(m => m.tipo === 'equivalencia')
                  const sinCobertura  = mapeosRelevantes.filter(m => m.tipo === 'crear_cargo')

                  const score = glosarioData?.score_cobertura_organizacional ?? null

                  function ConfianzaMeter({ valor }: { valor: number }) {
                    const pct = Math.max(0, Math.min(100, valor))
                    const color = pct >= 75 ? 'bg-emerald-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums w-6 text-right">{pct}%</span>
                      </div>
                    )
                  }

                  return (
                    <div className="p-5 space-y-5">

                      {/* Loading state */}
                      {cargandoGlosario && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                          <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                          Cruzando roles del proceso con tu organigrama…
                        </div>
                      )}

                      {/* Error glosario */}
                      {errorGlosario && (
                        <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errorGlosario}
                          <button onClick={() => setErrorGlosario(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
                        </div>
                      )}

                      {/* No glosario yet — CTA para lanzar análisis */}
                      {!cargandoGlosario && glosarioCargado && !glosarioData && (
                        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 space-y-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-violet-900/30 border border-violet-700/30 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">Cruce de roles pendiente</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                AICOUNTS leerá los roles de tus documentos de proceso y los cruzará con tu organigrama usando IA.
                              </p>
                            </div>
                          </div>
                          {proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
                            <div className="pt-2 border-t border-slate-700/30 space-y-1.5">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Roles identificados en el proceso</p>
                              <div className="flex flex-wrap gap-1.5">
                                {proceso.roles_involucrados.map(r => (
                                  <span key={r} className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-600/40">{r}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={lanzarAnalisisRoles}
                            disabled={lanzandoGlosario}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-violet-900/30"
                          >
                            {lanzandoGlosario
                              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analizando roles con IA…</>
                              : <><Sparkles className="w-4 h-4" /> Analizar roles con IA</>
                            }
                          </button>
                          {lanzandoGlosario && (
                            <p className="text-xs text-slate-400 text-center">Esto puede tomar 20–40 segundos. No cierres esta pestaña.</p>
                          )}
                        </div>
                      )}

                      {/* Glosario generándose */}
                      {glosarioData?.estado === 'generando' && (
                        <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 px-4 py-3 flex items-center gap-3">
                          <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin shrink-0" />
                          <p className="text-xs text-violet-300">El motor IA está cruzando los roles del proceso con tu organigrama…</p>
                        </div>
                      )}

                      {/* Re-analizar */}
                      {glosarioData?.estado === 'completado' && (
                        <div className="flex justify-end">
                          <button
                            onClick={lanzarAnalisisRoles}
                            disabled={lanzandoGlosario}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-400 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw className={`w-3 h-3 ${lanzandoGlosario ? 'animate-spin' : ''}`} />
                            {lanzandoGlosario ? 'Analizando…' : 'Re-analizar roles'}
                          </button>
                        </div>
                      )}

                      {/* Glosario header + coverage score */}
                      {glosarioData && mapeosRelevantes.length > 0 && (
                        <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Brain className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Inteligencia Organizacional · AICOUNTS</span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{glosarioData.resumen_ejecutivo}</p>
                            </div>
                            {score !== null && (
                              <div className="shrink-0 flex flex-col items-center gap-1">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 font-bold text-lg
                                  ${score >= 70 ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-400' : score >= 40 ? 'border-amber-600/50 bg-amber-950/40 text-amber-400' : 'border-red-600/50 bg-red-950/40 text-red-400'}`}>
                                  {score}
                                </div>
                                <span className="text-[9px] text-slate-400 text-center leading-tight">cobertura<br/>org.</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 pt-1 border-t border-slate-700/30">
                            {directos.length > 0 && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{directos.length} match directo{directos.length > 1 ? 's' : ''}</span>}
                            {equivalencias.length > 0 && <span className="flex items-center gap-1 text-[10px] text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{equivalencias.length} equivalencia{equivalencias.length > 1 ? 's' : ''}</span>}
                            {sinCobertura.length > 0 && <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />{sinCobertura.length} sin cobertura</span>}
                          </div>
                        </div>
                      )}

                      {/* Match directo cards */}
                      {directos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Match directo en tu organigrama
                          </p>
                          {directos.map((m, i) => (
                            <div key={i} className="flex gap-0 rounded-2xl border border-emerald-800/30 overflow-hidden">
                              <div className="w-[3px] shrink-0 bg-emerald-500 rounded-l-2xl" />
                              <div className="flex-1 px-4 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-slate-400">Rol en el proceso</p>
                                    <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[10px] text-slate-400">Asignar a</p>
                                    <p className="text-sm font-semibold text-emerald-300">{m.persona_sugerida ?? m.cargo_sugerido ?? '—'}</p>
                                    {m.persona_sugerida && m.cargo_sugerido && (
                                      <p className="text-[10px] text-slate-400">{m.cargo_sugerido}</p>
                                    )}
                                  </div>
                                </div>
                                <ConfianzaMeter valor={m.confianza} />
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                <div className="flex items-start gap-1.5 bg-emerald-950/30 rounded-xl px-3 py-2">
                                  <Zap className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-emerald-300 leading-relaxed">{m.accion_recomendada}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Equivalencia cards */}
                      {equivalencias.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity className="w-3 h-3" /> Equivalencia posible — requiere ajuste
                          </p>
                          {equivalencias.map((m, i) => (
                            <div key={i} className="flex gap-0 rounded-2xl border border-amber-800/30 overflow-hidden">
                              <div className="w-[3px] shrink-0 bg-amber-500 rounded-l-2xl" />
                              <div className="flex-1 px-4 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-slate-400">Rol en el proceso</p>
                                    <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[10px] text-slate-400">Cargo equivalente</p>
                                    <p className="text-sm font-semibold text-amber-300">{m.cargo_sugerido ?? '—'}</p>
                                  </div>
                                </div>
                                <ConfianzaMeter valor={m.confianza} />
                                {m.gap_detectado && (
                                  <div className="flex items-start gap-1.5 bg-amber-950/20 rounded-xl px-3 py-2">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-300 leading-relaxed"><span className="font-semibold">Gap:</span> {m.gap_detectado}</p>
                                  </div>
                                )}
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                <div className="flex items-start gap-1.5 bg-slate-800/50 rounded-xl px-3 py-2">
                                  <Target className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-slate-300 leading-relaxed">{m.accion_recomendada}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sin cobertura cards */}
                      {sinCobertura.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3" /> Sin cobertura — considerar contratación externa
                          </p>
                          {sinCobertura.map((m, i) => (
                            <div key={i} className="flex gap-0 rounded-2xl border border-red-800/30 overflow-hidden">
                              <div className="w-[3px] shrink-0 bg-red-500 rounded-l-2xl" />
                              <div className="flex-1 px-4 py-3 space-y-2">
                                <div>
                                  <p className="text-xs text-slate-400">Rol en el proceso</p>
                                  <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                </div>
                                {m.skills_requeridos && m.skills_requeridos.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {m.skills_requeridos.map((s, si) => (
                                      <span key={si} className="text-[10px] bg-red-950/40 text-red-300 border border-red-800/30 px-2 py-0.5 rounded-lg">{s}</span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                <div className="flex items-start gap-1.5 bg-red-950/20 rounded-xl px-3 py-2">
                                  <Shield className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-red-300 leading-relaxed">{m.accion_recomendada}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Alertas críticas del análisis */}
                      {glosarioData?.alertas_criticas && glosarioData.alertas_criticas.length > 0 && (
                        <div className="rounded-xl border border-red-700/30 bg-red-950/10 p-4 space-y-2">
                          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3" /> Alertas críticas de cobertura
                          </p>
                          <div className="space-y-1.5">
                            {glosarioData.alertas_criticas.map((a, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-red-500 text-xs shrink-0 mt-0.5">▸</span>
                                <p className="text-xs text-red-300 leading-relaxed">{a}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Plan de acción 30 días */}
                      {glosarioData?.plan_accion_30_dias && glosarioData.plan_accion_30_dias.length > 0 && (
                        <div className="rounded-xl border border-violet-700/30 bg-violet-950/10 p-4 space-y-2">
                          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Zap className="w-3 h-3" /> Plan de acción — 30 días
                          </p>
                          <div className="space-y-1.5">
                            {glosarioData.plan_accion_30_dias.map((p, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-full bg-violet-800/60 border border-violet-700/40 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0">{i+1}</span>
                                <p className="text-xs text-slate-300 leading-relaxed">{p}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Glosario loaded but no mapeos for this process → show roles pills fallback */}
                      {!cargandoGlosario && glosarioCargado && glosarioData && mapeosRelevantes.length === 0 && proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Roles en este proceso</p>
                          <div className="flex flex-wrap gap-2">
                            {proceso.roles_involucrados.map(r => (
                              <span key={r} className="text-xs bg-slate-800/60 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded-xl">{r}</span>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400">El análisis de glosario existe pero no incluyó roles específicos de este proceso.</p>
                        </div>
                      )}

                      {/* Brechas de rol (documental) */}
                      {docAnalisis?.analisis_ia?.roles_y_responsabilidades?.brechas_de_rol && docAnalisis.analisis_ia.roles_y_responsabilidades.brechas_de_rol.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" /> Brechas documentales de rol
                          </p>
                          <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 space-y-3">
                            {docAnalisis.analisis_ia.roles_y_responsabilidades.brechas_de_rol.map((b, i) => {
                              const atendido = esAtendido('rol', i)
                              const key = claveCorr('rol', i)
                              const abierto = expandCorr[key]
                              return (
                                <div key={i}>
                                  <div className={`pb-3 ${i < (docAnalisis.analisis_ia?.roles_y_responsabilidades?.brechas_de_rol?.length ?? 0) - 1 ? 'border-b border-amber-800/20' : ''}`}>
                                    <div className="flex items-start gap-2.5">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${atendido ? 'bg-emerald-900/50 border border-emerald-700/40' : 'bg-amber-900/50 border border-amber-700/40'}`}>
                                        {atendido ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <span className="text-amber-400 text-xs font-bold">{i + 1}</span>}
                                      </div>
                                      <p className={`text-sm leading-relaxed flex-1 ${atendido ? 'line-through text-slate-400' : 'text-slate-300'}`}>{b}</p>
                                    </div>
                                    <div className="flex items-center gap-3 pl-7 mt-2">
                                      {!atendido ? (
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                          className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors">
                                          <Pencil className="w-3 h-3" /> {abierto ? 'Cerrar' : 'Comentar y resolver'}
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                            <CheckCircle2 className="w-3 h-3" /> Resuelto
                                          </span>
                                          <button onClick={() => desmarcarAtendido('rol', i)}
                                            className="text-xs text-slate-400 hover:text-slate-400 transition-colors">
                                            · Desmarcar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {abierto && !atendido && (
                                    <div className="mt-2 ml-3 p-3 rounded-xl border border-emerald-700/30 bg-emerald-950/10 space-y-2">
                                      <textarea
                                        value={textoCorr[key] ?? ''}
                                        onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Ej: el rol de Coordinador de Inventario cubre esta función..."
                                        rows={2}
                                        className="w-full text-xs text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                      />
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => marcarAtendido('rol', i)}
                                          className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                                          <CheckCircle2 className="w-3 h-3" /> Marcar como resuelto
                                        </button>
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                          className="text-xs text-slate-400 hover:text-slate-400 transition-colors">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── TAB: Versiones ── */}
                {tabDoc === 'versiones' && (
                  <div className="p-5 space-y-4">
                    {/* Estado actual sin versiones consolidadas */}
                    {versiones.length === 0 && atendidasActivas === 0 && (
                      <div className="text-center py-10 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mx-auto">
                          <Clock className="w-6 h-6 text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Sin versiones consolidadas</p>
                        <p className="text-slate-400 text-xs max-w-xs mx-auto">
                          Cuando marques hallazgos como resueltos y consolides, cada versión quedará disponible aquí para descarga.
                        </p>
                      </div>
                    )}

                    {/* CTA cuando hay hallazgos resueltos pero no se ha consolidado */}
                    {atendidasActivas > 0 && (
                      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-emerald-300">
                            {atendidasActivas} hallazgo{atendidasActivas > 1 ? 's' : ''} resuelto{atendidasActivas > 1 ? 's' : ''} sin consolidar
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            La v{versiones.length + 1} se generará con estos hallazgos excluidos.
                          </p>
                        </div>
                        <button
                          onClick={generarNuevaVersion}
                          disabled={generandoVersion}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shrink-0"
                        >
                          {generandoVersion
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                            : <><Zap className="w-4 h-4" /> Crear v{versiones.length + 1}</>
                          }
                        </button>
                      </div>
                    )}

                    {/* Error de correcciones */}
                    {errorCorr && (
                      <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errorCorr}
                        <button onClick={() => setErrorCorr(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
                      </div>
                    )}

                    {/* Lista de versiones consolidadas */}
                    {versiones.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Versiones consolidadas</p>
                        <div className="space-y-3">
                          {([...versiones] as Array<Record<string,unknown>>).reverse().map((v, i) => {
                            const esUltima = i === 0
                            const vNum = v.numero as number
                            const vDesc = v.descripcion as string
                            const vFecha = v.fecha as string
                            const vCount = v.correcciones_aplicadas as number
                            const detalle = (v.detalle_correcciones ?? []) as Array<{tipo:string;indice:number;texto_original:string;observacion:string;fecha:string}>
                            const docId = (v.documento_id as string | null | undefined) ?? proceso.documento_origen_id ?? null
                            const abierto = versionDetalle === vNum

                            // Resumen de tipos de cambio para la leyenda
                            const TIPO_LABEL: Record<string,string> = { riesgo: 'Riesgo', hallazgo: 'Hallazgo', brecha: 'Brecha', rol: 'Rol', oportunidad: 'Oportunidad' }
                            const TIPO_COLOR: Record<string,string> = {
                              riesgo: 'bg-red-950/40 border-red-700/30 text-red-300',
                              hallazgo: 'bg-amber-950/40 border-amber-700/30 text-amber-300',
                              brecha: 'bg-blue-950/40 border-blue-700/30 text-blue-300',
                              rol: 'bg-violet-950/40 border-violet-700/30 text-violet-300',
                              oportunidad: 'bg-emerald-950/40 border-emerald-700/30 text-emerald-300',
                            }
                            const conteoTipos = detalle.reduce<Record<string,number>>((acc, d) => {
                              acc[d.tipo] = (acc[d.tipo] ?? 0) + 1; return acc
                            }, {})

                            return (
                              <div key={vNum} className={`rounded-xl border overflow-hidden ${esUltima ? 'border-violet-700/40' : 'border-slate-700/40'}`}>
                                {/* Header de versión */}
                                <div className={`p-4 flex items-start justify-between gap-4 ${esUltima ? 'bg-violet-950/20' : 'bg-slate-800/20'}`}>
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${esUltima ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                      v{vNum}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-sm font-semibold ${esUltima ? 'text-violet-200' : 'text-slate-300'}`}>
                                          Versión {vNum}
                                        </p>
                                        {esUltima && <span className="text-xs font-normal text-violet-400 bg-violet-950/60 border border-violet-800/40 px-2 py-0.5 rounded-full">Última</span>}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5">{vDesc}</p>
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {new Date(vFecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        {vCount > 0 && ` · ${vCount} mejora${vCount > 1 ? 's' : ''}`}
                                      </p>
                                      {/* Chips de tipo de cambio */}
                                      {Object.keys(conteoTipos).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                          {Object.entries(conteoTipos).map(([tipo, cnt]) => (
                                            <span key={tipo} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIPO_COLOR[tipo] ?? 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                              {cnt} {TIPO_LABEL[tipo] ?? tipo}{cnt > 1 ? 's' : ''} corregido{cnt > 1 ? 's' : ''}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Acciones: Ver (primario) + Descargar (secundario) */}
                                  <div className="flex flex-col gap-2 shrink-0">
                                    {docId && (
                                      <button
                                        onClick={async () => {
                                          if (abierto) {
                                            setVersionDetalle(null)
                                            setDocVisorUrl(null)
                                          } else {
                                            setVersionDetalle(vNum)
                                            await abrirDocumento(docId)
                                          }
                                        }}
                                        disabled={cargandoVisor}
                                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all disabled:opacity-50 ${
                                          esUltima
                                            ? 'bg-violet-600 hover:bg-violet-500 text-white'
                                            : 'bg-indigo-700/40 hover:bg-indigo-700/60 text-indigo-300 border border-indigo-700/40'
                                        }`}
                                      >
                                        {cargandoVisor && !abierto
                                          ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                          : <FileText className="w-3.5 h-3.5" />}
                                        {abierto ? 'Cerrar' : 'Ver documento'}
                                      </button>
                                    )}
                                    <a
                                      href={`/api/procesos/${proceso.id}/exportar?v=${vNum}`}
                                      download={`${proceso.nombre.replace(/[^a-z0-9]/gi,'_')}_v${vNum}.html`}
                                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700/70 text-slate-400 border border-slate-600/40 transition-all"
                                    >
                                      <ArrowRight className="w-3.5 h-3.5 -rotate-45" />
                                      Descargar
                                    </a>
                                  </div>
                                </div>

                                {/* Panel expandible: layout lado a lado — PDF izquierda, cambios derecha */}
                                {abierto && (
                                  <div className="border-t border-slate-700/40 bg-slate-900/60">
                                    {cargandoVisor && (
                                      <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
                                        <span className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
                                        Cargando documento...
                                      </div>
                                    )}
                                    {!cargandoVisor && (
                                      <div className={`flex ${docVisorUrl ? 'flex-row' : 'flex-col p-4'} gap-0 min-h-0`}>

                                        {/* Panel derecho: cambios */}
                                        <div className={`${docVisorUrl ? 'w-72 shrink-0 border-r border-slate-700/40 overflow-y-auto' : 'w-full'} p-4 space-y-3`} style={docVisorUrl ? { maxHeight: '560px' } : {}}>
                                          {detalle.length > 0 ? (
                                            <>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cambios en esta versión</p>
                                              {detalle.map((d, di) => (
                                                <div key={di} className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-3 space-y-2">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${TIPO_COLOR[d.tipo] ?? 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                                      {TIPO_LABEL[d.tipo] ?? d.tipo}
                                                    </span>
                                                    {d.texto_original && docVisorUrl && (
                                                      <button
                                                        onClick={() => {
                                                          // Navegar al texto en el visor usando fragment search
                                                          const iframeEl = document.querySelector(`iframe[title="pdf-v${vNum}"]`) as HTMLIFrameElement | null
                                                          if (iframeEl) {
                                                            iframeEl.src = docVisorUrl + '#search=' + encodeURIComponent(d.texto_original.slice(0, 60))
                                                          }
                                                        }}
                                                        className="text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-700/30 hover:border-indigo-500/50 px-2 py-0.5 rounded-md transition-all"
                                                      >
                                                        Ubicar en PDF →
                                                      </button>
                                                    )}
                                                  </div>
                                                  {d.texto_original && (
                                                    <p className="text-[11px] text-yellow-200/80 leading-relaxed bg-yellow-950/20 border border-yellow-700/20 rounded px-2 py-1.5">
                                                      {d.texto_original}
                                                    </p>
                                                  )}
                                                  <div className="flex items-start gap-2">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                                    <p className="text-[11px] text-emerald-300 italic leading-relaxed">&quot;{d.observacion}&quot;</p>
                                                  </div>
                                                  <p className="text-[10px] text-slate-400">
                                                    {new Date(d.fecha).toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' })}
                                                  </p>
                                                </div>
                                              ))}
                                            </>
                                          ) : (
                                            <p className="text-xs text-slate-400 text-center py-2">Versión inicial sin detalle de cambios</p>
                                          )}
                                        </div>

                                        {/* PDF a la derecha — ocupa el espacio restante */}
                                        {docVisorUrl && (
                                          <div className="flex-1 min-w-0">
                                            <iframe
                                              src={docVisorUrl}
                                              className="w-full h-full"
                                              style={{ height: '560px' }}
                                              title={`pdf-v${vNum}`}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Decisión (siempre visible al fondo) ── */}
                <div className="px-5 pb-5 pt-2 border-t border-slate-700/40">
                  <div className={`rounded-xl border p-4 space-y-3 ${
                    estadoLocal === 'aceptado' ? 'bg-emerald-950/20 border-emerald-700/40' :
                    estadoLocal === 'rechazado' ? 'bg-red-950/20 border-red-800/40' :
                    'bg-slate-800/30 border-slate-700/40'
                  }`}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tu decisión sobre este proceso</p>
                    {estadoLocal === 'propuesto' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => cambiarEstado('aceptado')} disabled={aprobando}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40">
                          <CheckCircle2 className="w-4 h-4" /> Aceptar proceso
                        </button>
                        <button onClick={() => cambiarEstado('rechazado')} disabled={aprobando}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-red-900/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition-all disabled:opacity-50">
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    )}
                    {estadoLocal === 'aceptado' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-bold">Proceso aceptado — inventario oficial</span>
                        </div>
                        <button onClick={() => cambiarEstado('rechazado')} disabled={aprobando} className="text-xs text-slate-400 hover:text-red-400 transition-colors">Rechazar</button>
                      </div>
                    )}
                    {estadoLocal === 'rechazado' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400">
                          <XCircle className="w-5 h-5" />
                          <span className="text-sm font-bold">Proceso rechazado — la consultora revisará</span>
                        </div>
                        <button onClick={() => cambiarEstado('propuesto')} disabled={aprobando} className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">Deshacer</button>
                      </div>
                    )}
                  </div>

                  {/* Proyecciones e Impacto — hijo */}
                  <div className="mt-4 pt-4 border-t border-slate-700/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-violet-400 text-xs font-semibold uppercase tracking-widest">Proyecciones e Impacto</span>
                      </div>
                      {!proyeccion && (
                        <button
                          onClick={generarProyeccion}
                          disabled={proyectando}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 border border-violet-500/40 text-violet-300 text-xs font-medium rounded-lg hover:bg-violet-600/30 transition-all disabled:opacity-50"
                        >
                          {proyectando ? <><span className="w-3 h-3 border border-violet-400/40 border-t-violet-300 rounded-full animate-spin" />Analizando...</> : <><Zap className="w-3 h-3" />Generar proyección</>}
                        </button>
                      )}
                      {proyeccion && (
                        <button onClick={generarProyeccion} disabled={proyectando} className="text-xs text-slate-400 hover:text-violet-400 transition-colors flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Actualizar
                        </button>
                      )}
                    </div>

                    {!proyeccion && !proyectando && !errorProyeccion && (
                      <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center">
                        <p className="text-slate-400 text-xs">Proyecta qué pasaría en la operación si &quot;{proceso.nombre}&quot; se implementa — mejoras, escenarios y KPIs a 12 meses.</p>
                      </div>
                    )}

                    {errorProyeccion && (
                      <div className="rounded-xl bg-red-950/30 border border-red-800/40 p-3 flex items-start gap-2">
                        <span className="text-red-400 text-xs shrink-0 mt-0.5">⚠</span>
                        <p className="text-red-300 text-xs leading-relaxed">{errorProyeccion}</p>
                      </div>
                    )}

                    {proyectando && (
                      <div className="rounded-xl bg-violet-950/20 border border-violet-800/30 p-4 space-y-2">
                        {['Diagnosticando estado actual...', 'Modelando escenarios de mejora...', 'Construyendo roadmap 90 días...', 'Proyectando KPIs a 12 meses...'].map((msg, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                            <span className="text-xs text-slate-400">{msg}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {proyeccion && (
                      <div className="space-y-3">
                        {/* Header: estado actual */}
                        <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 space-y-1.5">
                          <p className="text-xs text-slate-400 leading-relaxed">{proyeccion.estado_actual?.diagnostico}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-slate-400">Madurez: <span className="text-white font-semibold">Nivel {proyeccion.estado_actual?.nivel_madurez}/5</span></span>
                            {proyeccion.estado_actual?.costo_ineficiencia_estimado && (
                              <span className="text-xs text-amber-400">⚡ {proyeccion.estado_actual.costo_ineficiencia_estimado}</span>
                            )}
                            <span className="text-xs bg-violet-600/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
                              Confianza {proyeccion.nivel_confianza}%
                            </span>
                          </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1">
                          {(['mejoras', 'escenarios', 'roadmap', 'kpis'] as const).map(t => (
                            <button key={t} onClick={() => setTabProyeccion(t)}
                              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${tabProyeccion === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                              {t === 'kpis' ? 'KPIs' : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>

                        {/* Tab: Mejoras */}
                        {tabProyeccion === 'mejoras' && (
                          <div className="space-y-2">
                            {(proyeccion.mejoras_propuestas ?? []).slice(0, 5).map((m, i) => (
                              <div key={i} className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-3 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm text-white font-medium">{m.titulo}</p>
                                  <div className="flex gap-1 shrink-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${m.impacto === 'alto' ? 'bg-emerald-900/60 text-emerald-300' : m.impacto === 'medio' ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                                      {m.impacto}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.tipo === 'quick_win' ? 'bg-violet-900/60 text-violet-300' : 'bg-slate-700/60 text-slate-400'}`}>
                                      {m.tipo === 'quick_win' ? '⚡ Quick win' : m.tipo === 'proyecto_corto' ? '📦 Proyecto' : '🔄 Transformación'}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">{m.descripcion}</p>
                                <div className="flex gap-3 text-xs text-slate-400">
                                  <span>⏱ {m.plazo_semanas} sem</span>
                                  {m.valor_estimado && <span className="text-emerald-400">💰 {m.valor_estimado}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tab: Escenarios */}
                        {tabProyeccion === 'escenarios' && (
                          <div className="space-y-2">
                            {(['conservador', 'base', 'optimista'] as const).map(esc => {
                              const e = proyeccion.escenarios?.[esc]
                              if (!e) return null
                              const color = esc === 'optimista' ? 'emerald' : esc === 'base' ? 'blue' : 'slate'
                              return (
                                <div key={esc} className={`rounded-xl bg-${color}-950/20 border border-${color}-800/30 p-3 space-y-1`}>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs font-semibold text-${color}-400 capitalize`}>{esc}</span>
                                    <span className="text-xs text-slate-400">{e.probabilidad}% prob.</span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed">{e.descripcion}</p>
                                  {e.ahorro_estimado && <p className="text-xs text-emerald-400 font-medium">💰 {e.ahorro_estimado}</p>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Tab: Roadmap */}
                        {tabProyeccion === 'roadmap' && (
                          <div className="space-y-2">
                            {(proyeccion.roadmap_90_dias ?? []).map((r, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-violet-900/40 border border-violet-700/40 flex items-center justify-center">
                                  <span className="text-xs text-violet-300 font-bold">{r.semana?.replace(/[^0-9]/g, '') || i + 1}</span>
                                </div>
                                <div className="flex-1 py-1">
                                  <p className="text-xs text-white font-medium">{r.accion}</p>
                                  <p className="text-xs text-slate-400">{r.responsable} · {r.entregable}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tab: KPIs */}
                        {tabProyeccion === 'kpis' && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-700/40">
                                  <th className="text-left py-2 pr-3 font-medium">KPI</th>
                                  <th className="text-right py-2 px-2 font-medium">Actual</th>
                                  <th className="text-right py-2 px-2 font-medium text-blue-400">6 meses</th>
                                  <th className="text-right py-2 pl-2 font-medium text-emerald-400">12 meses</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/20">
                                {(proyeccion.proyeccion_kpis ?? []).map((k, i) => (
                                  <tr key={i}>
                                    <td className="py-2 pr-3 text-slate-300">{k.kpi} <span className="text-slate-400">({k.unidad})</span></td>
                                    <td className="py-2 px-2 text-right text-slate-400">{k.valor_actual}</td>
                                    <td className="py-2 px-2 text-right text-blue-300 font-medium">{k.valor_6_meses}</td>
                                    <td className="py-2 pl-2 text-right text-emerald-300 font-bold">{k.valor_12_meses}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Recomendación ejecutiva */}
                        <div className="rounded-xl bg-gradient-to-r from-violet-950/40 to-slate-800/40 border border-violet-700/30 p-3">
                          <p className="text-xs text-violet-300 font-semibold mb-1">Recomendación ejecutiva</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{proyeccion.recomendacion_ejecutiva}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Full enterprise card (macroproceso container) ──
  return (
    <div className="group relative rounded-2xl border transition-all duration-300 overflow-hidden bg-slate-900/80 border-violet-800/40 hover:border-violet-700/60">

      {/* Left accent bar by criticidad */}
      {critCfg && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
      )}

      <div className={critCfg ? 'pl-4' : ''}>
        {/* Header — click to toggle expanded. No es un <button> real porque
            contiene botones anidados (fila de acciones más abajo) — HTML no
            permite button dentro de button. Se hace accesible por teclado
            con role/tabIndex/onKeyDown en su lugar. */}
        <div
          className="p-5 cursor-pointer select-none"
          onClick={() => !editando && setExpandido(v => !v)}
          role="button"
          tabIndex={0}
          aria-expanded={expandido}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && !editando) {
              e.preventDefault()
              setExpandido(v => !v)
            }
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-900/40 text-violet-300">
              <Layers className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-violet-400 font-semibold uppercase tracking-widest">Macroproceso</span>
                    {critCfg && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${critCfg.bg} ${critCfg.color}`}>
                        {critCfg.label}
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-base leading-snug">{editNombre || proceso.nombre}</h3>
                  {proceso.descripcion && (
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{editDesc || proceso.descripcion}</p>
                  )}
                </div>
              </div>

              {/* Roles as pills */}
              {proceso.roles_involucrados?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  <Users className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                  {proceso.roles_involucrados.map(r => (
                    <span key={r} className="text-xs text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{r}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Expand chevron */}
            <div className="shrink-0 mt-1 text-slate-400 group-hover:text-slate-300 transition-colors">
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {/* Actions row — stop propagation so clicks don't toggle card */}
          <div
            className="flex items-center gap-2 mt-4 flex-wrap"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={analizarConIA}
              disabled={analizando}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                resumen
                  ? 'bg-violet-700/30 text-violet-300 border border-violet-700/50 hover:bg-violet-700/40'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-900/40'
              } disabled:opacity-50`}
            >
              {analizando ? (
                <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Analizando...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" />{resumen ? 'Ver diagnóstico IA' : 'Analizar con IA'}</>
              )}
            </button>


            {/* Edit toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setEditando(v => !v); setExpandido(true) }}
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-violet-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/60"
            >
              <Pencil className="w-3.5 h-3.5" /> {editando ? 'Cerrar editor' : 'Editar'}
            </button>

            {tieneHijos && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpandido(v => !v) }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/60"
              >
                <Layers className="w-3.5 h-3.5" />
                {proceso.hijos.length} proceso{proceso.hijos.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* ── Expanded panel ── */}
        {expandido && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-800/60 pt-4">

            {/* Section A: Diagnóstico IA */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Diagnóstico IA</span>
                </div>
                {resumen && (
                  <button
                    onClick={reanalizarConIA}
                    disabled={analizando}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" /> Volver a analizar
                  </button>
                )}
              </div>

              {analizando && (
                <div className="rounded-xl bg-violet-950/30 border border-violet-800/40 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-600/40 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="absolute inset-0 rounded-full border border-violet-500/30 animate-ping" />
                    </div>
                    <div>
                      <p className="text-violet-300 text-sm font-medium">IA analizando proceso...</p>
                      <p className="text-slate-400 text-xs">Evaluando criticidad, riesgos y oportunidades</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {['Leyendo contexto del proceso', 'Evaluando riesgos operacionales', 'Identificando quick wins', 'Calculando potencial de automatización'].map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                        <span className="text-xs text-slate-400">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!analizando && !resumen && (
                <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center space-y-2">
                  {errorIA ? (
                    <>
                      <p className="text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Error al analizar
                      </p>
                      <p className="text-red-300/70 text-xs">{errorIA}</p>
                      <button onClick={analizarConIA} className="text-xs text-violet-400 hover:text-violet-300 underline transition-colors">
                        Reintentar
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-400 text-xs">Presiona &quot;Analizar con IA&quot; para obtener el diagnóstico completo de este {esHijo ? 'proceso' : 'macroproceso'}.</p>
                  )}
                </div>
              )}

              {resumen && saludCfg && (
                <div className={`rounded-xl border p-5 space-y-4 ${saludCfg.bg} ${saludCfg.border}`}>

                  {/* Header: badge + docs count + madurez */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">AICOUNTS Intelligence</span>
                      {(resumen.documentos_considerados ?? 0) > 0 && (
                        <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-700/40 px-2 py-0.5 rounded-full font-medium">
                          {resumen.documentos_considerados} doc{(resumen.documentos_considerados ?? 0) !== 1 ? 's' : ''} analizados
                        </span>
                      )}
                      {!resumen.ancla_documental && (
                        <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/30 px-2 py-0.5 rounded-full">Análisis preliminar</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {resumen.nivel_madurez && (
                        <span className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-700/40">{resumen.nivel_madurez}</span>
                      )}
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${saludCfg.color} bg-slate-900/60 border border-current/20`}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: 'currentColor' }} />
                        {saludCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Diagnóstico */}
                  <p className="text-slate-200 text-sm leading-relaxed">{resumen.diagnostico}</p>

                  {/* Impacto + Quick Win */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resumen.impacto_negocio && (
                      <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Impacto al negocio</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{resumen.impacto_negocio}</p>
                      </div>
                    )}
                    {resumen.quick_win && (
                      <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Quick Win · 30 días</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{resumen.quick_win}</p>
                      </div>
                    )}
                  </div>

                  {/* Brechas principales */}
                  {resumen.brechas_principales && resumen.brechas_principales.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> Brechas críticas detectadas
                      </p>
                      <ul className="space-y-1">
                        {resumen.brechas_principales.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-red-900/50 border border-red-700/40 flex items-center justify-center text-red-400 text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Oportunidades de valor */}
                  {resumen.oportunidades_valor && resumen.oportunidades_valor.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3" /> Oportunidades de valor
                      </p>
                      <ul className="space-y-1">
                        {resumen.oportunidades_valor.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400 shrink-0 mt-0.5">✦</span>
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Riesgos críticos */}
                  {resumen.riesgos_criticos && resumen.riesgos_criticos.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Shield className="w-3 h-3" /> Riesgos a gestionar
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {resumen.riesgos_criticos.map((r, i) => (
                          <span key={i} className="text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/30 px-2 py-0.5 rounded-lg">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Benchmark industria */}
                  {resumen.benchmark_industria && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-1 border border-violet-800/20">
                      <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                        <BarChart3 className="w-3 h-3" /> Benchmark de industria
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">{resumen.benchmark_industria}</p>
                    </div>
                  )}

                  {/* Automatización + Siguiente paso */}
                  <div className="flex items-start gap-3 flex-wrap pt-1 border-t border-slate-800/60">
                    {resumen.potencial_automatizacion && (
                      <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
                        <Cpu className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs text-slate-400">Automatización:</span>
                        <span className={`text-xs font-bold ${AUTOMATIZACION_CONFIG[resumen.potencial_automatizacion]?.color ?? 'text-slate-300'}`}>
                          {AUTOMATIZACION_CONFIG[resumen.potencial_automatizacion]?.icon} {AUTOMATIZACION_CONFIG[resumen.potencial_automatizacion]?.label}
                        </span>
                      </div>
                    )}
                    {resumen.siguiente_paso && (
                      <div className="flex-1 flex items-start gap-2 bg-slate-900/60 rounded-lg px-3 py-2 min-w-[200px]">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-300 leading-relaxed"><span className="text-indigo-400 font-medium">Siguiente:</span> {resumen.siguiente_paso}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Riesgos detectados */}
            {proceso.riesgos_detectados?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">Riesgos detectados</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {proceso.riesgos_detectados.map((r, i) => (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      i < 2 ? 'bg-red-950/40 text-red-300 border-red-900/50' : 'bg-amber-950/40 text-amber-300 border-amber-900/50'
                    }`}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Section C: Editar proceso */}
            {editando && (
              <div className="rounded-xl bg-slate-800/40 border border-violet-700/30 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Pencil className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Editar proceso</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nombre</label>
                    <input
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600 transition-colors resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={guardarEdicion}
                    disabled={guardando}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-50"
                  >
                    {guardando ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => { setEditando(false); setEditNombre(proceso.nombre); setEditDesc(proceso.descripcion ?? '') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Section D: Procesos dentro del macroproceso */}
            {tieneHijos && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Procesos ({proceso.hijos.length})</span>
                  <span className="text-slate-400 text-xs">— Acepta o rechaza cada uno</span>
                </div>
                <div className="space-y-2 pl-4 border-l border-slate-700/50">
                  {proceso.hijos.map((hijo) => (
                    <ProcesoCard key={hijo.id} proceso={hijo as ProcesoConHijos} esHijo proyectoId={proyectoId} />
                  ))}
                </div>
              </div>
            )}

            {/* Section E: Proyecciones IA */}
            <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-violet-400 text-xs font-semibold uppercase tracking-widest">Proyecciones e Impacto</span>
                  </div>
                  {!proyeccion && (
                    <button
                      onClick={generarProyeccion}
                      disabled={proyectando}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 border border-violet-500/40 text-violet-300 text-xs font-medium rounded-lg hover:bg-violet-600/30 transition-all disabled:opacity-50"
                    >
                      {proyectando ? <><span className="w-3 h-3 border border-violet-400/40 border-t-violet-300 rounded-full animate-spin" />Analizando...</> : <><Zap className="w-3 h-3" />Generar proyección</>}
                    </button>
                  )}
                  {proyeccion && (
                    <button onClick={generarProyeccion} disabled={proyectando} className="text-xs text-slate-400 hover:text-violet-400 transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Actualizar
                    </button>
                  )}
                </div>

                {!proyeccion && !proyectando && !errorProyeccion && (
                  <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center space-y-2">
                    <p className="text-slate-400 text-xs">
                      {esHijo
                        ? `Proyecta qué pasaría en la operación si "${proceso.nombre}" se implementa según el documento — mejoras, escenarios y KPIs a 12 meses.`
                        : 'Proyecta el impacto total para la empresa si se implementan todos los subprocesos — escenarios, roadmap y KPIs a 12 meses.'}
                    </p>
                  </div>
                )}

                {errorProyeccion && (
                  <div className="rounded-xl bg-red-950/30 border border-red-800/40 p-3 flex items-start gap-2">
                    <span className="text-red-400 text-xs shrink-0 mt-0.5">⚠</span>
                    <p className="text-red-300 text-xs leading-relaxed">{errorProyeccion}</p>
                  </div>
                )}

                {proyectando && (
                  <div className="rounded-xl bg-violet-950/20 border border-violet-800/30 p-4 space-y-2">
                    {['Diagnosticando estado actual...', 'Modelando escenarios de mejora...', 'Construyendo roadmap 90 días...', 'Proyectando KPIs a 12 meses...'].map((msg, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                        <span className="text-xs text-slate-400">{msg}</span>
                      </div>
                    ))}
                  </div>
                )}

                {proyeccion && (
                  <div className="space-y-3">
                    {/* Diagnóstico actual */}
                    <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 space-y-1.5">
                      <p className="text-xs text-slate-400 leading-relaxed">{proyeccion.estado_actual?.diagnostico}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-slate-400">Madurez: <span className="text-white font-semibold">Nivel {proyeccion.estado_actual?.nivel_madurez}/5</span></span>
                        {proyeccion.estado_actual?.costo_ineficiencia_estimado && (
                          <span className="text-xs text-amber-400">⚡ {proyeccion.estado_actual.costo_ineficiencia_estimado}</span>
                        )}
                        <span className="text-xs bg-violet-600/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
                          Confianza {proyeccion.nivel_confianza}%
                        </span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1">
                      {(['mejoras', 'escenarios', 'roadmap', 'kpis'] as const).map(t => (
                        <button key={t} onClick={() => setTabProyeccion(t)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${tabProyeccion === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                          {t === 'kpis' ? 'KPIs' : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Mejoras */}
                    {tabProyeccion === 'mejoras' && (
                      <div className="space-y-2">
                        {(proyeccion.mejoras_propuestas ?? []).slice(0, 5).map((m, i) => (
                          <div key={i} className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-3 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-white font-medium">{m.titulo}</p>
                              <div className="flex gap-1 shrink-0">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${m.impacto === 'alto' ? 'bg-emerald-900/60 text-emerald-300' : m.impacto === 'medio' ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                                  {m.impacto}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.tipo === 'quick_win' ? 'bg-violet-900/60 text-violet-300' : 'bg-slate-700/60 text-slate-400'}`}>
                                  {m.tipo === 'quick_win' ? '⚡ Quick win' : m.tipo === 'proyecto_corto' ? '📦 Proyecto' : '🔄 Transformación'}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{m.descripcion}</p>
                            <div className="flex gap-3 text-xs text-slate-400">
                              <span>⏱ {m.plazo_semanas} sem</span>
                              {m.valor_estimado && <span className="text-emerald-400">💰 {m.valor_estimado}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tab: Escenarios */}
                    {tabProyeccion === 'escenarios' && (
                      <div className="space-y-2">
                        {(['conservador', 'base', 'optimista'] as const).map(esc => {
                          const e = proyeccion.escenarios?.[esc]
                          if (!e) return null
                          const color = esc === 'optimista' ? 'emerald' : esc === 'base' ? 'blue' : 'slate'
                          return (
                            <div key={esc} className={`rounded-xl bg-${color}-950/20 border border-${color}-800/30 p-3 space-y-1`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold text-${color}-400 capitalize`}>{esc}</span>
                                <span className="text-xs text-slate-400">{e.probabilidad}% prob.</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{e.descripcion}</p>
                              {e.ahorro_estimado && <p className="text-xs text-emerald-400 font-medium">💰 {e.ahorro_estimado}</p>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Tab: Roadmap */}
                    {tabProyeccion === 'roadmap' && (
                      <div className="space-y-2">
                        {(proyeccion.roadmap_90_dias ?? []).map((r, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-violet-900/40 border border-violet-700/40 flex items-center justify-center">
                              <span className="text-xs text-violet-300 font-bold">{r.semana?.replace(/[^0-9]/g, '') || i + 1}</span>
                            </div>
                            <div className="flex-1 py-1">
                              <p className="text-xs text-white font-medium">{r.accion}</p>
                              <p className="text-xs text-slate-400">{r.responsable} · {r.entregable}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tab: KPIs */}
                    {tabProyeccion === 'kpis' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-700/40">
                              <th className="text-left py-2 pr-3 font-medium">KPI</th>
                              <th className="text-right py-2 px-2 font-medium">Actual</th>
                              <th className="text-right py-2 px-2 font-medium text-blue-400">6 meses</th>
                              <th className="text-right py-2 pl-2 font-medium text-emerald-400">12 meses</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/20">
                            {(proyeccion.proyeccion_kpis ?? []).map((k, i) => (
                              <tr key={i}>
                                <td className="py-2 pr-3 text-slate-300">{k.kpi} <span className="text-slate-400">({k.unidad})</span></td>
                                <td className="py-2 px-2 text-right text-slate-400">{k.valor_actual}</td>
                                <td className="py-2 px-2 text-right text-blue-300 font-medium">{k.valor_6_meses}</td>
                                <td className="py-2 pl-2 text-right text-emerald-300 font-bold">{k.valor_12_meses}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Recomendación ejecutiva */}
                    <div className="rounded-xl bg-gradient-to-r from-violet-950/40 to-slate-800/40 border border-violet-700/30 p-3">
                      <p className="text-xs text-violet-300 font-semibold mb-1">Recomendación ejecutiva</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{proyeccion.recomendacion_ejecutiva}</p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
