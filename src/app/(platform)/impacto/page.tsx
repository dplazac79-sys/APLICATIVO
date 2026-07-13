'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, Plus, Download, ChevronRight, Trash2, RefreshCw, Link2, Zap } from 'lucide-react'
import { simularOperacional } from '@/lib/simulacion/operacional'
import { simularFinanciera } from '@/lib/simulacion/financiera'
import { simularOrganizacional } from '@/lib/simulacion/organizacional'
import type {
  TipoSimulacion,
  Escenario,
  ParametrosOperacional,
  ParametrosFinanciera,
  ParametrosOrganizacional,
  ResultadoOperacional,
  ResultadoFinanciera,
  ResultadoOrganizacional,
} from '@/lib/simulacion/tipos'

// ── tipos locales ──────────────────────────────────────────────────────────
interface Proyecto { id: string; nombre: string }
interface Proceso { id: string; nombre: string; nivel: number }
interface ArtefactoRef { id: string; tipo: string }
interface Simulacion {
  id: string
  nombre: string
  tipo: TipoSimulacion
  escenario: Escenario
  parametros: unknown
  resultados_todos: unknown
  proceso_id: string | null
  artefacto_asis_id: string | null
  artefacto_tobe_id: string | null
  entregable_id: string | null
  created_at: string
}

// conservador / base / custom son escenarios; optimista ES el TO-BE (100% de mejora)
const ESCENARIOS_INTERMEDIOS: Escenario[] = ['conservador', 'base', 'custom']

const ESCENARIO_COLOR: Record<string, string> = {
  conservador: '#5F5E5A',
  base:        '#378ADD',
  'TO-BE':     '#1D9E75',  // optimista = TO-BE
  custom:      '#BA7517',
  'AS-IS':     '#E24B4A',
}

const TIPO_LABEL: Record<TipoSimulacion, string> = {
  operacional:    'Operacional',
  financiera:     'Financiera',
  organizacional: 'Organizacional',
}

const defaultParams: Record<TipoSimulacion, unknown> = {
  operacional: {
    tiempo_ciclo_asis_horas: 8,
    throughput_asis_unidades_dia: 10,
    carga_trabajo_asis_ftes: 3,
    mejora_tiempo_ciclo_pct: 40,
    mejora_throughput_pct: 30,
    multiplicador_custom: 0.6,
  } satisfies ParametrosOperacional,
  financiera: {
    // Sin dato real por defecto: el formulario pedirá el valor real (placeholder "Ingrese valor real").
    // Si el proceso tiene artefacto KPI-SLA con financiero, /api/simulaciones/contexto los pre-puebla.
    costo_operacional_mensual_clp: 0,
    costo_implementacion_clp: 0,
    valor_hora_clp: 0,
    horas_ciclo_dia: 6,
    dias_laborales_mes: 22,
    mejora_tiempo_ciclo_pct: 40,
    multiplicador_custom: 0.6,
  } satisfies ParametrosFinanciera,
  organizacional: {
    headcount_actual: 5,
    roles_involucrados: ['Operador', 'Supervisor', 'Analista', 'Jefe de proceso'],
    ftes_a_liberar_base: 1.5,
    roles_nuevos_estimados: ['Automatizador RPA', 'Analista de datos'],
    multiplicador_custom: 0.6,
  } satisfies ParametrosOrganizacional,
}

const fmt  = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 })
const fmtCLP = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

// ── componente principal ───────────────────────────────────────────────────
export default function ImpactoPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [proyectoId, setProyectoId] = useState('')
  const [simulaciones, setSimulaciones] = useState<Simulacion[]>([])
  const [selected, setSelected] = useState<Simulacion | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form
  const [formNombre, setFormNombre] = useState('')
  const [formTipo, setFormTipo] = useState<TipoSimulacion>('operacional')
  const [formEscenario, setFormEscenario] = useState<Escenario>('base')
  const [formParams, setFormParams] = useState<unknown>(defaultParams.operacional)
  const [formProcesoId, setFormProcesoId] = useState('')
  const [formAsisId, setFormAsisId] = useState('')
  const [formTobeId, setFormTobeId] = useState('')
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [contextoArtefactos, setContextoArtefactos] = useState<{ asis: ArtefactoRef | null; tobe: ArtefactoRef | null } | null>(null)
  const [loadingContexto, setLoadingContexto] = useState(false)

  // Panel live
  const [liveParams, setLiveParams] = useState<unknown>(null)
  const [liveResultados, setLiveResultados] = useState<unknown>(null)

  useEffect(() => {
    fetch('/api/proyectos').then(r => r.json()).then(d => {
      const ps = d.proyectos ?? []
      setProyectos(ps)
      if (ps.length > 0) setProyectoId(ps[0].id)
    })
  }, [])

  useEffect(() => {
    if (!proyectoId) return
    let cancelado = false
    setLoading(true)
    fetch(`/api/simulaciones?proyecto_id=${proyectoId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelado) return
        const sims = d.simulaciones ?? []
        setSimulaciones(sims)
        if (sims.length > 0) setSelected(prev => prev ?? sims[0])
        setLoading(false)
      })
    // Cargar procesos del proyecto para el formulario
    fetch(`/api/simulaciones/contexto?proyecto_id=${proyectoId}`)
      .then(r => r.json())
      .then(d => { if (!cancelado) setProcesos(d.procesos ?? []) })
    return () => { cancelado = true }
  }, [proyectoId])

  useEffect(() => {
    setFormParams(defaultParams[formTipo])
  }, [formTipo])

  // Al seleccionar proceso: cargar KPIs y artefactos para pre-poblar
  useEffect(() => {
    if (!formProcesoId) { setContextoArtefactos(null); return }
    let cancelado = false
    setLoadingContexto(true)
    fetch(`/api/simulaciones/contexto?proceso_id=${formProcesoId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelado) return
        setContextoArtefactos(d.artefactos ?? null)
        if (d.artefactos?.asis) setFormAsisId(d.artefactos.asis.id)
        if (d.artefactos?.tobe) setFormTobeId(d.artefactos.tobe.id)
        if (d.parametros_sugeridos?.[formTipo]) {
          setFormParams(d.parametros_sugeridos[formTipo])
        }
        setLoadingContexto(false)
      })
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formProcesoId])

  const recalcular = useCallback((params: unknown, tipo: TipoSimulacion) => {
    let r: unknown
    if (tipo === 'operacional') r = simularOperacional(params as ParametrosOperacional)
    else if (tipo === 'financiera') r = simularFinanciera(params as ParametrosFinanciera)
    else r = simularOrganizacional(params as ParametrosOrganizacional)
    setLiveResultados(r)
    setLiveParams(params)
  }, [])

  useEffect(() => {
    if (!selected) return
    recalcular(liveParams ?? selected.parametros, selected.tipo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  async function crearSimulacion() {
    if (!formNombre || !proyectoId) return
    const res = await fetch('/api/simulaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        nombre: formNombre,
        tipo: formTipo,
        escenario: formEscenario,
        parametros: formParams,
        proceso_id: formProcesoId || null,
        artefacto_asis_id: formAsisId || null,
        artefacto_tobe_id: formTobeId || null,
      }),
    })
    const d = await res.json()
    if (d.ok) {
      setSimulaciones(prev => [d.simulacion, ...prev])
      setShowForm(false)
      setFormNombre('')
      setFormProcesoId('')
      setFormAsisId('')
      setFormTobeId('')
      setContextoArtefactos(null)
      setSelected(d.simulacion)
      setLiveParams(null)
      setLiveResultados(null)
    }
  }

  async function exportar(sim: Simulacion) {
    const res = await fetch(`/api/simulaciones/${sim.id}/exportar`, { method: 'POST' })
    const d = await res.json()
    if (d.ok) {
      setSimulaciones(prev => prev.map(s => s.id === sim.id ? { ...s, entregable_id: d.entregable.id } : s))
      if (selected?.id === sim.id) setSelected(prev => prev ? { ...prev, entregable_id: d.entregable.id } : prev)
    }
  }

  async function eliminar(id: string) {
    await fetch(`/api/simulaciones/${id}`, { method: 'DELETE' })
    setSimulaciones(prev => prev.filter(s => s.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="flex h-full relative">
      {/* Lista lateral */}
      <aside className="hidden md:flex w-72 border-r border-slate-800 flex-col bg-slate-900 shrink-0">
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h1 className="text-sm font-semibold text-white">Simulador de Escenarios</h1>
          </div>
          <p className="text-[11px] text-slate-500 -mt-2 mb-3 leading-relaxed">
            Modela tus propios parámetros — distinto del Horizonte de Impacto con IA que ve el cliente.
          </p>
          <select
            value={proyectoId}
            onChange={e => setProyectoId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5"
          >
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && <p className="text-slate-500 text-xs px-2 py-3">Cargando...</p>}
          {!loading && simulaciones.length === 0 && (
            <p className="text-slate-600 text-xs px-2 py-3">Sin simulaciones. Crea la primera.</p>
          )}
          {simulaciones.map(sim => (
            <button
              key={sim.id}
              onClick={() => { setSelected(sim); setLiveParams(null); setLiveResultados(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${selected?.id === sim.id ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-slate-800'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200 truncate">{sim.nombre}</span>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
              </div>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{TIPO_LABEL[sim.tipo]}</span>
                {sim.proceso_id && <span className="text-[10px] text-indigo-400 bg-indigo-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Link2 className="w-2 h-2" />proceso</span>}
                {sim.entregable_id && <span className="text-[10px] text-emerald-600 bg-emerald-900/30 px-1.5 py-0.5 rounded">Exportado</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" /> Nueva simulación
          </button>
        </div>
      </aside>

      {/* Panel principal */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
        {showForm && (
          <FormularioSimulacion
            procesos={procesos}
            formNombre={formNombre} setFormNombre={setFormNombre}
            formTipo={formTipo} setFormTipo={setFormTipo}
            formEscenario={formEscenario} setFormEscenario={setFormEscenario}
            formParams={formParams} setFormParams={setFormParams}
            formProcesoId={formProcesoId} setFormProcesoId={setFormProcesoId}
            formAsisId={formAsisId} setFormAsisId={setFormAsisId}
            formTobeId={formTobeId} setFormTobeId={setFormTobeId}
            contextoArtefactos={contextoArtefactos}
            loadingContexto={loadingContexto}
            onCancel={() => { setShowForm(false); setFormProcesoId(''); setContextoArtefactos(null) }}
            onSubmit={crearSimulacion}
          />
        )}

        {!showForm && !selected && <EmptyState onNew={() => setShowForm(true)} />}

        {!showForm && selected && (
          <PanelComparativo
            sim={selected}
            liveResultados={liveResultados}
            liveParams={liveParams}
            onParamChange={(params) => { setLiveParams(params); recalcular(params, selected.tipo) }}
            onExportar={() => exportar(selected)}
            onEliminar={() => eliminar(selected.id)}
          />
        )}
      </main>
    </div>
  )
}

// ── FormularioSimulacion ───────────────────────────────────────────────────
function FormularioSimulacion({
  procesos, formNombre, setFormNombre, formTipo, setFormTipo,
  formEscenario, setFormEscenario, formParams, setFormParams,
  formProcesoId, setFormProcesoId, formAsisId: _formAsisId, setFormAsisId: _setFormAsisId,
  formTobeId: _formTobeId, setFormTobeId: _setFormTobeId, contextoArtefactos, loadingContexto,
  onCancel, onSubmit,
}: {
  procesos: Proceso[]
  formNombre: string; setFormNombre: (v: string) => void
  formTipo: TipoSimulacion; setFormTipo: (v: TipoSimulacion) => void
  formEscenario: Escenario; setFormEscenario: (v: Escenario) => void
  formParams: unknown; setFormParams: (v: unknown) => void
  formProcesoId: string; setFormProcesoId: (v: string) => void
  formAsisId: string; setFormAsisId: (v: string) => void
  formTobeId: string; setFormTobeId: (v: string) => void
  contextoArtefactos: { asis: ArtefactoRef | null; tobe: ArtefactoRef | null } | null
  loadingContexto: boolean
  onCancel: () => void; onSubmit: () => void
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-white font-semibold mb-4">Nueva simulación</h2>
      <div className="space-y-4 bg-slate-900 rounded-xl border border-slate-800 p-5">

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Nombre</label>
          <input
            value={formNombre}
            onChange={e => setFormNombre(e.target.value)}
            placeholder="Ej. Optimización Proceso de Compras"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-3 py-2"
          />
        </div>

        {/* Trazabilidad: proceso de referencia */}
        <div>
          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 block">
            <Link2 className="w-3 h-3" /> Proceso de referencia (AS-IS/TO-BE)
          </label>
          <select
            value={formProcesoId}
            onChange={e => setFormProcesoId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-2"
          >
            <option value="">— Sin proceso vinculado —</option>
            {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {loadingContexto && <p className="text-xs text-slate-500 mt-1">Cargando contexto del proceso...</p>}
          {contextoArtefactos && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {contextoArtefactos.asis
                ? <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded flex items-center gap-1"><Zap className="w-2.5 h-2.5" />AS-IS detectado</span>
                : <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-1 rounded">Sin artefacto AS-IS</span>
              }
              {contextoArtefactos.tobe
                ? <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded flex items-center gap-1"><Zap className="w-2.5 h-2.5" />TO-BE detectado</span>
                : <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-1 rounded">Sin artefacto TO-BE</span>
              }
              {(contextoArtefactos.asis || contextoArtefactos.tobe) && (
                <span className="text-[10px] text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded">Parámetros pre-poblados desde proceso</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tipo de motor</label>
            <select
              value={formTipo}
              onChange={e => setFormTipo(e.target.value as TipoSimulacion)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-2"
            >
              <option value="operacional">Operacional</option>
              <option value="financiera">Financiera</option>
              <option value="organizacional">Organizacional</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Escenario principal</label>
            <select
              value={formEscenario}
              onChange={e => setFormEscenario(e.target.value as Escenario)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-2"
            >
              <option value="conservador">Conservador</option>
              <option value="base">Base</option>
              <option value="optimista">TO-BE / Optimista</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-2 font-medium">Parámetros del motor
            {formProcesoId && <span className="ml-2 text-indigo-400">(pre-poblados desde proceso)</span>}
          </p>
          <ParamEditor tipo={formTipo} params={formParams} onChange={setFormParams} />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg">Crear simulación</button>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── ParamEditor ────────────────────────────────────────────────────────────
function ParamEditor({ tipo, params, onChange }: { tipo: TipoSimulacion; params: unknown; onChange: (v: unknown) => void }) {
  const p = params as Record<string, unknown>
  const set = (key: string, val: unknown) => onChange({ ...p, [key]: val })
  const num = (key: string) => Number(p[key] ?? 0)

  if (tipo === 'operacional') return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Tiempo ciclo AS-IS (horas)" value={num('tiempo_ciclo_asis_horas')} onChange={v => set('tiempo_ciclo_asis_horas', v)} />
      <Field label="Throughput AS-IS (unidades/día)" value={num('throughput_asis_unidades_dia')} onChange={v => set('throughput_asis_unidades_dia', v)} />
      <Field label="FTEs actuales" value={num('carga_trabajo_asis_ftes')} onChange={v => set('carga_trabajo_asis_ftes', v)} />
      <Field label="Mejora tiempo ciclo TO-BE (%)" value={num('mejora_tiempo_ciclo_pct')} onChange={v => set('mejora_tiempo_ciclo_pct', v)} />
      <Field label="Mejora throughput TO-BE (%)" value={num('mejora_throughput_pct')} onChange={v => set('mejora_throughput_pct', v)} />
      <Field label="Mult. escenario custom (0-1)" value={num('multiplicador_custom')} onChange={v => set('multiplicador_custom', v)} step={0.05} />
    </div>
  )

  if (tipo === 'financiera') return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Costo operacional mensual (CLP)" value={num('costo_operacional_mensual_clp')} onChange={v => set('costo_operacional_mensual_clp', v)} step={100000} realPlaceholder />
      <Field label="Costo implementación (CLP)" value={num('costo_implementacion_clp')} onChange={v => set('costo_implementacion_clp', v)} step={500000} realPlaceholder />
      <Field label="Valor hora FTE (CLP)" value={num('valor_hora_clp')} onChange={v => set('valor_hora_clp', v)} step={1000} realPlaceholder />
      <Field label="Horas de ciclo por día" value={num('horas_ciclo_dia')} onChange={v => set('horas_ciclo_dia', v)} />
      <Field label="Días laborales mes" value={num('dias_laborales_mes')} onChange={v => set('dias_laborales_mes', v)} />
      <Field label="Mejora tiempo ciclo TO-BE (%)" value={num('mejora_tiempo_ciclo_pct')} onChange={v => set('mejora_tiempo_ciclo_pct', v)} />
    </div>
  )

  const po = p as Record<string, unknown>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Headcount actual" value={num('headcount_actual')} onChange={v => set('headcount_actual', v)} />
      <Field label="FTEs a liberar (escenario base)" value={num('ftes_a_liberar_base')} onChange={v => set('ftes_a_liberar_base', v)} step={0.5} />
      <div className="col-span-2">
        <label className="text-xs text-slate-400 mb-1 block">Roles involucrados (separados por coma)</label>
        <input
          value={(po.roles_involucrados as string[] ?? []).join(', ')}
          onChange={e => set('roles_involucrados', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-3 py-2"
        />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-slate-400 mb-1 block">Roles nuevos estimados (separados por coma)</label>
        <input
          value={(po.roles_nuevos_estimados as string[] ?? []).join(', ')}
          onChange={e => set('roles_nuevos_estimados', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-3 py-2"
        />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, step = 1, realPlaceholder = false }: { label: string; value: number; onChange: (v: number) => void; step?: number; realPlaceholder?: boolean }) {
  // Cuando realPlaceholder está activo y el valor es 0/null (sin dato real del artefacto KPI-SLA),
  // mostramos el input vacío con placeholder pidiendo el valor real en lugar de un número inventado.
  const showEmpty = realPlaceholder && (!value || value === 0)
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        type="number"
        value={showEmpty ? '' : value}
        step={step}
        placeholder={realPlaceholder ? 'Ingrese valor real' : undefined}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-3 py-1.5"
      />
    </div>
  )
}

// ── PanelComparativo ───────────────────────────────────────────────────────
function PanelComparativo({
  sim, liveResultados, liveParams, onParamChange, onExportar, onEliminar,
}: {
  sim: Simulacion
  liveResultados: unknown
  liveParams: unknown
  onParamChange: (p: unknown) => void
  onExportar: () => void
  onEliminar: () => void
}) {
  const rawResultados = liveResultados ?? sim.resultados_todos
  const resultados = rawResultados as Record<Escenario, unknown> | null

  // Si la simulación fue guardada sin resultados_todos (edge case), recalcular en cliente
  const sinResultados = !rawResultados

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">{sim.nombre}</h2>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{TIPO_LABEL[sim.tipo]}</span>
            {sim.proceso_id && (
              <span className="text-xs text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                <Link2 className="w-3 h-3" /> proceso vinculado
              </span>
            )}
            {sim.artefacto_asis_id && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">AS-IS ✓</span>}
            {sim.artefacto_tobe_id && <span className="text-xs text-emerald-600 bg-emerald-900/30 px-2 py-0.5 rounded">TO-BE ✓</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportar}
            disabled={!!sim.entregable_id}
            className="flex items-center gap-1.5 text-xs text-slate-300 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" />
            {sim.entregable_id ? 'Exportado como entregable' : 'Exportar como entregable'}
          </button>
          {sim.entregable_id && <DescargarPdfBtn entregableId={sim.entregable_id} nombre={sim.nombre} />}
          <button onClick={onEliminar} className="text-slate-600 hover:text-red-400 p-1.5 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Parámetros editables con recálculo en vivo */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-slate-400 font-medium">Parámetros editables — recálculo instantáneo</span>
        </div>
        <ParamEditor tipo={sim.tipo} params={liveParams ?? sim.parametros} onChange={onParamChange} />
      </div>

      {/* Leyenda de escenarios */}
      <div className="flex gap-4 flex-wrap">
        <LeyendaItem color={ESCENARIO_COLOR['AS-IS']} label="AS-IS (estado actual)" />
        {ESCENARIOS_INTERMEDIOS.map(e => <LeyendaItem key={e} color={ESCENARIO_COLOR[e]} label={e.charAt(0).toUpperCase() + e.slice(1)} />)}
        <LeyendaItem color={ESCENARIO_COLOR['TO-BE']} label="TO-BE / Optimista (mejora completa)" />
      </div>

      {/* Null-safety: sin resultados_todos en BD */}
      {sinResultados && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3 text-sm text-amber-400">
          Esta simulación no tiene resultados calculados. Ajusta cualquier parámetro arriba para calcularlos.
        </div>
      )}

      {/* Panel comparativo */}
      {resultados && (
        <div className="space-y-4">
          {sim.tipo === 'operacional' && (
            <ComparativoOperacional
              resultados={resultados as Record<Escenario, ResultadoOperacional>}
              asis={sim.parametros as ParametrosOperacional}
            />
          )}
          {sim.tipo === 'financiera' && (
            <ComparativoFinanciera resultados={resultados as Record<Escenario, ResultadoFinanciera>} />
          )}
          {sim.tipo === 'organizacional' && (
            <ComparativoOrganizacional
              resultados={resultados as Record<Escenario, ResultadoOrganizacional>}
              asis={sim.parametros as ParametrosOrganizacional}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DescargarPdfBtn({ entregableId, nombre }: { entregableId: string; nombre: string }) {
  const [cargando, setCargando] = useState<string | null>(null)

  async function descargar(formato: 'pdf' | 'docx' | 'pptx') {
    setCargando(formato)
    try {
      const endpoint = formato === 'pdf' ? 'exportar-pdf' : formato === 'docx' ? 'exportar-docx' : 'exportar-pptx'
      const res = await fetch(`/api/entregables/${entregableId}/${endpoint}`, { method: 'POST' })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nombre}.${formato}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setCargando(null)
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(['pdf', 'docx', 'pptx'] as const).map(fmt => (
        <button
          key={fmt}
          onClick={() => descargar(fmt)}
          disabled={cargando !== null}
          className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          <Download className="w-3 h-3" />
          {cargando === fmt ? 'Generando...' : fmt.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function LeyendaItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

// ── Comparativos ───────────────────────────────────────────────────────────
function ComparativoOperacional({ resultados, asis }: { resultados: Record<Escenario, ResultadoOperacional>; asis: ParametrosOperacional }) {
  return (
    <div className="space-y-4">
      <MetricTable
        label="Tiempo de ciclo (horas) — menor es mejor"
        asisLabel="AS-IS" asisValue={asis.tiempo_ciclo_asis_horas}
        rows={[
          ...ESCENARIOS_INTERMEDIOS.map(e => ({ label: e, value: resultados[e]?.tiempo_ciclo_tobe_horas ?? 0, color: ESCENARIO_COLOR[e] })),
          { label: 'TO-BE / Optimista', value: resultados.optimista?.tiempo_ciclo_tobe_horas ?? 0, color: ESCENARIO_COLOR['TO-BE'] },
        ]}
        inverted format={fmt}
      />
      <MetricTable
        label="Throughput (unidades/día) — mayor es mejor"
        asisLabel="AS-IS" asisValue={asis.throughput_asis_unidades_dia}
        rows={[
          ...ESCENARIOS_INTERMEDIOS.map(e => ({ label: e, value: resultados[e]?.throughput_tobe_unidades_dia ?? 0, color: ESCENARIO_COLOR[e] })),
          { label: 'TO-BE / Optimista', value: resultados.optimista?.throughput_tobe_unidades_dia ?? 0, color: ESCENARIO_COLOR['TO-BE'] },
        ]}
        format={fmt}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ESCENARIOS_INTERMEDIOS.map(e => (
          <KpiCard key={e} color={ESCENARIO_COLOR[e]} label={e} value={`${fmt(resultados[e]?.ftes_liberados ?? 0)} FTEs liberados`} />
        ))}
        <KpiCard color={ESCENARIO_COLOR['TO-BE']} label="TO-BE / Optimista" value={`${fmt(resultados.optimista?.ftes_liberados ?? 0)} FTEs liberados`} />
      </div>
    </div>
  )
}

function ComparativoFinanciera({ resultados }: { resultados: Record<Escenario, ResultadoFinanciera> }) {
  return (
    <div className="space-y-4">
      <MetricTable
        label="Ahorro anual proyectado (CLP)"
        asisLabel="AS-IS" asisValue={0}
        rows={[
          ...ESCENARIOS_INTERMEDIOS.map(e => ({ label: e, value: resultados[e]?.ahorro_anual_clp ?? 0, color: ESCENARIO_COLOR[e] })),
          { label: 'TO-BE / Optimista', value: resultados.optimista?.ahorro_anual_clp ?? 0, color: ESCENARIO_COLOR['TO-BE'] },
        ]}
        format={fmtCLP}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ESCENARIOS_INTERMEDIOS.map(e => (
          <KpiCard key={e} color={ESCENARIO_COLOR[e]} label={e}
            value={`ROI ${fmt(resultados[e]?.roi_pct ?? 0)}%`}
            sub={`Payback: ${fmt(resultados[e]?.payback_meses ?? 0)} meses`}
          />
        ))}
        <KpiCard color={ESCENARIO_COLOR['TO-BE']} label="TO-BE / Optimista"
          value={`ROI ${fmt(resultados.optimista?.roi_pct ?? 0)}%`}
          sub={`Payback: ${fmt(resultados.optimista?.payback_meses ?? 0)} meses`}
        />
      </div>
    </div>
  )
}

function ComparativoOrganizacional({ resultados, asis }: { resultados: Record<Escenario, ResultadoOrganizacional>; asis: ParametrosOrganizacional }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ESCENARIOS_INTERMEDIOS.map(e => (
          <KpiCard key={e} color={ESCENARIO_COLOR[e]} label={e}
            value={`${fmt(resultados[e]?.ftes_optimizados ?? 0)} FTEs`}
            sub={`${fmt(resultados[e]?.reduccion_dotacion_pct ?? 0)}% reducción`}
          />
        ))}
        <KpiCard color={ESCENARIO_COLOR['TO-BE']} label="TO-BE / Optimista"
          value={`${fmt(resultados.optimista?.ftes_optimizados ?? 0)} FTEs`}
          sub={`${fmt(resultados.optimista?.reduccion_dotacion_pct ?? 0)}% reducción`}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {([...ESCENARIOS_INTERMEDIOS, 'optimista'] as Escenario[]).map(e => {
          const label = e === 'optimista' ? 'TO-BE / Optimista' : e
          const color = e === 'optimista' ? ESCENARIO_COLOR['TO-BE'] : ESCENARIO_COLOR[e]
          return (
            <div key={e} className="bg-slate-900 rounded-lg border border-slate-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium text-slate-300 capitalize">{label}</span>
                <span className="text-xs text-slate-500 ml-auto">{asis.headcount_actual} → {fmt(resultados[e]?.headcount_tobe ?? 0)} personas</span>
              </div>
              {resultados[e]?.roles_a_reasignar?.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-slate-500 mb-1">Reasignar</p>
                  <div className="flex flex-wrap gap-1">
                    {resultados[e].roles_a_reasignar.map(r => (
                      <span key={r} className="text-[10px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {resultados[e]?.roles_a_crear?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Crear</p>
                  <div className="flex flex-wrap gap-1">
                    {resultados[e].roles_a_crear.map(r => (
                      <span key={r} className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Primitivos de visualización ────────────────────────────────────────────
function MetricTable({
  label, asisLabel, asisValue, rows, inverted = false, format,
}: {
  label: string
  asisLabel: string
  asisValue: number
  rows: { label: string; value: number; color: string }[]
  inverted?: boolean
  format: (n: number) => string
}) {
  const allValues = [asisValue, ...rows.map(r => r.value)]
  const safeMax = Math.max(...allValues, 1)

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <p className="text-xs text-slate-400 mb-3 font-medium">{label}</p>
      {/* AS-IS */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs w-16 sm:w-28 shrink-0 font-medium" style={{ color: ESCENARIO_COLOR['AS-IS'] }}>{asisLabel}</span>
        <div className="flex-1 h-4 bg-slate-800 rounded-sm overflow-hidden">
          <div className="h-full rounded-sm" style={{ width: `${(asisValue / safeMax) * 100}%`, background: ESCENARIO_COLOR['AS-IS'] }} />
        </div>
        <span className="text-xs text-slate-400 w-16 sm:w-28 text-right shrink-0 font-medium">{format(asisValue)}</span>
      </div>
      {rows.map(row => {
        const pct = (row.value / safeMax) * 100
        const isBetter = inverted ? row.value < asisValue : row.value > asisValue
        return (
          <div key={row.label} className="flex items-center gap-3 mb-2">
            <span className="text-xs w-16 sm:w-28 shrink-0 capitalize text-slate-500">{row.label}</span>
            <div className="flex-1 h-4 bg-slate-800 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${pct}%`, background: row.color }} />
            </div>
            <span className={`text-xs w-28 text-right shrink-0 font-medium ${isBetter ? 'text-emerald-400' : 'text-slate-400'}`}>
              {format(row.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function KpiCard({ color, label, value, sub }: { color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[10px] text-slate-500 capitalize">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <BarChart3 className="w-12 h-12 text-slate-700" />
      <div>
        <p className="text-slate-300 font-medium">Sin simulaciones para este proyecto</p>
        <p className="text-slate-600 text-sm mt-1 max-w-sm">
          Ingresa tus propios parámetros operacionales, financieros u organizacionales y compara escenarios (conservador, base, TO-BE). Útil para modelar supuestos que el Horizonte de Impacto automático no cubre.
        </p>
      </div>
      <button onClick={onNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
        <Plus className="w-4 h-4" /> Nueva simulación
      </button>
    </div>
  )
}
