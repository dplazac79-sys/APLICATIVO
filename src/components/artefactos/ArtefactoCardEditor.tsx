'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Pencil, X, Save, Sparkles, ChevronDown, ChevronUp,
  Loader2, CheckCircle, Globe, AlertCircle, Plus, Trash2, GripVertical,
  Download, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Artefacto, EstadoValidacion, TipoArtefacto } from '@/types/database'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

const VistaArtefacto = dynamic(() => import('./VistaArtefacto'), { ssr: false })

// ─── Helpers ────────────────────────────────────────────────────────────────

const BADGE: Record<EstadoValidacion, string> = {
  pendiente: 'bg-amber-950 text-amber-400 border-amber-800',
  validado: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  publicado: 'bg-blue-950 text-blue-400 border-blue-800',
}
const BADGE_LABEL: Record<EstadoValidacion, string> = {
  pendiente: 'Pendiente revisión',
  validado: 'Validado',
  publicado: 'Publicado',
}
// Transiciones según rol:
// - Cliente (sponsor/usuario): solo puede Validar (pendiente → validado)
// - Consultor/director/admin: puede además Entregar (validado → publicado) o revertir
const TRANSICION_CLIENTE: Record<EstadoValidacion, { siguiente: EstadoValidacion; label: string } | null> = {
  pendiente: { siguiente: 'validado', label: 'Validar' },
  validado: null,   // ya aprobado — no hay acción siguiente para el cliente
  publicado: null,
}
const TRANSICION_CONSULTOR: Record<EstadoValidacion, { siguiente: EstadoValidacion; label: string } | null> = {
  pendiente: { siguiente: 'validado', label: 'Validar' },
  validado:  { siguiente: 'publicado', label: 'Marcar entregado' },
  publicado: { siguiente: 'validado', label: 'Revertir entrega' },
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                      opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 delay-300">
        <div className="bg-slate-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {label}
        </div>
        <div className="w-1.5 h-1.5 bg-slate-700 rotate-45 mx-auto -mt-0.5" />
      </div>
    </div>
  )
}

// ─── Diccionarios de UI ──────────────────────────────────────────────────────

const CAMPOS_OCULTOS = new Set([
  'edges', 'id', 'animated', 'style', 'position', 'type',
  'matriz', 'leyenda', 'resumen', 'financiero',
])

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
  indicadores: 'Indicadores (KPIs)',
  nivel_madurez_descripcion: 'Nivel de madurez',
  nivel_madurez: 'Nivel de madurez (1-5)',
  fortalezas: 'Fortalezas',
  debilidades: 'Debilidades',
  oportunidades: 'Oportunidades',
  amenazas: 'Amenazas',
  brechas_criticas: 'Brechas críticas',
  recomendaciones_prioritarias: 'Recomendaciones prioritarias',
  conclusion: 'Conclusión',
  conclusion_sistemica: 'Conclusión sistémica',
  resumen_ejecutivo: 'Resumen ejecutivo',
  comparativo: 'Comparativo AS-IS vs TO-BE',
  quick_wins: 'Victorias tempranas (Quick Wins)',
  logros_principales: 'Logros principales',
  proximos_pasos: 'Próximos pasos',
  recomendacion_ceo: 'Recomendación a la dirección',
  titulo_proyecto: 'Título del proyecto',
  proposito: 'Propósito',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin_estimada: 'Fecha de término estimada',
  presupuesto_estimado: 'Presupuesto estimado',
  patrocinador: 'Patrocinador',
  director_proyecto: 'Director del proyecto',
  checklists: 'Checklists operacionales',
  iniciativas: 'Iniciativas de mejora',
  analisis: 'Análisis de causas raíz',
  alcance: 'Alcance del proyecto',
  objetivos: 'Objetivos',
  supuestos: 'Supuestos',
  restricciones: 'Restricciones',
  criterios_exito: 'Criterios de éxito',
  firmas_requeridas: 'Firmas requeridas',
  casos: 'Casos de prueba',
  criterios_aprobacion: 'Criterios de aprobación',
  plan_contingencia: 'Plan de contingencia',
  ambiente_pruebas: 'Ambiente de pruebas',
  responsable_pruebas: 'Responsable de pruebas',
  fases: 'Fases de implementación',
  factores_exito: 'Factores de éxito',
  riesgos_implementacion: 'Riesgos de implementación',
  metodologia: 'Metodología',
  duracion_total_semanas: 'Duración total (semanas)',
  frecuencia_uso: 'Frecuencia de uso',
  // Campos de objetos anidados
  descripcion: 'Descripción',
  nombre: 'Nombre',
  responsable: 'Responsable',
  duracion_estimada: 'Duración estimada',
  sistema: 'Sistema utilizado',
  automatizado: '¿Automatizado?',
  herramienta: 'Herramienta',
  mejora_vs_asis: 'Mejora vs estado actual',
  rol: 'Rol',
  descripcion_rol: 'Función en el proceso',
  items: 'Ítems del checklist',
  fase: 'Fase',
  critico: '¿Crítico?',
  nota: 'Nota',
  categoria: 'Categoría',
  probabilidad: 'Probabilidad',
  impacto: 'Impacto',
  nivel_riesgo: 'Nivel de riesgo',
  control: 'Control mitigante',
  tipo_control: 'Tipo de control',
  estado: 'Estado',
  formula: 'Fórmula de cálculo',
  unidad: 'Unidad',
  linea_base: 'Línea base (valor actual)',
  meta: 'Meta',
  frecuencia: 'Frecuencia de medición',
  dueno: 'Dueño del indicador',
  fuente_dato: 'Fuente del dato',
  sla: 'Acuerdo de nivel de servicio',
  tipo: 'Tipo',
  dimension: 'Dimensión evaluada',
  valor_asis: 'Situación actual (AS-IS)',
  valor_tobe: 'Situación futura (TO-BE)',
  brecha: 'Brecha identificada',
  iniciativa: 'Iniciativa para cerrar',
  esfuerzo: 'Nivel de esfuerzo',
  problema: 'Problema identificado',
  cadena: 'Cadena de porqués',
  porque: 'Porqué',
  causa_raiz: 'Causa raíz',
  tipo_causa: 'Tipo de causa',
  accion_correctiva: 'Acción correctiva',
  plazo: 'Plazo estimado',
  incluye: 'Qué incluye',
  excluye: 'Qué excluye',
  metrica: 'Métrica de medición',
  nombre_caso: 'Nombre del caso',
  precondicion: 'Condición previa',
  resultado_esperado: 'Resultado esperado',
  criterio_falla: 'Criterio de falla',
  prioridad: 'Prioridad',
  beneficio: 'Beneficio esperado',
  necesidad: 'Necesidad',
  criterios_aceptacion: 'Criterios de aceptación',
  puntos_historia: 'Puntos de historia',
  titulo_historia: 'Título',
  id: '',
  orden: 'N°',
  semana_inicio: 'Semana de inicio',
  semana_fin: 'Semana de fin',
  duracion_semanas: 'Duración (semanas)',
  entregables: 'Entregables',
  hitos: 'Hitos clave',
  objetivo: 'Objetivo de la fase',
  tiempo_estimado: 'Tiempo estimado',
  responsable_sugerido: 'Responsable sugerido',
  beneficio_esperado: 'Beneficio esperado',
  dependencias: 'Depende de',
}

// Extrae un título legible del primer campo descriptivo de un objeto
function tituloObjeto(obj: Record<string, unknown>, idx: number): string {
  for (const k of ['descripcion', 'nombre', 'titulo', 'problema', 'nombre_caso', 'dimension', 'rol']) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k] as string
  }
  return `Ítem ${idx + 1}`
}

// ─── Editor universal de campos JSON ────────────────────────────────────────

function CampoEditor({
  campoKey = '', value, onChange, nivel = 0
}: {
  campoKey?: string
  value: unknown
  onChange: (v: unknown) => void
  nivel?: number
}) {
  const [expandido, setExpandido] = useState(true)
  const label = NOMBRE_CAMPO[campoKey] ?? campoKey.replace(/_/g, ' ')

  if (value === null || value === undefined) return null
  // Ocultar campo vacío con nombre vacío (id oculto, etc.)
  if (label === '') return null

  // String
  if (typeof value === 'string') {
    const esLargo = value.length > 80
    return (
      <div className="space-y-1">
        <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">{label}</label>
        {esLargo ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={Math.min(8, Math.max(3, Math.ceil(value.length / 80)))}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm resize-y focus:outline-none focus:border-purple-500 transition-colors"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-colors"
          />
        )}
      </div>
    )
  }

  // Number
  if (typeof value === 'number') {
    return (
      <div className="space-y-1">
        <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">{label}</label>
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-32 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>
    )
  }

  // Boolean
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-purple-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <label className="text-slate-300 text-sm">{label}</label>
      </div>
    )
  }

  // Array of strings
  if (Array.isArray(value) && (value.length === 0 || typeof value[0] === 'string')) {
    const arr = value as string[]
    return (
      <div className="space-y-2">
        <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">{label}</label>
        <div className="space-y-1.5">
          {arr.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <GripVertical className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <input
                type="text"
                value={item}
                onChange={e => {
                  const next = [...arr]; next[i] = e.target.value; onChange(next)
                }}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
                className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([...arr, ''])}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors mt-1 border border-dashed border-slate-700 hover:border-purple-600 rounded-lg px-3 py-1.5 w-full justify-center"
          >
            <Plus className="w-3 h-3" /> Agregar {label.toLowerCase().replace(/s$/, '')}
          </button>
        </div>
      </div>
    )
  }

  // Array of objects
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
    const arr = value as Record<string, unknown>[]
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">{label}</label>
          <button onClick={() => setExpandido(e => !e)} className="text-slate-600 hover:text-slate-400 transition-colors">
            {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {expandido && (
          <div className="space-y-3">
            {arr.map((obj, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700/50">
                  <span className="text-slate-300 text-xs font-medium truncate">{tituloObjeto(obj, i)}</span>
                  <button
                    onClick={() => onChange(arr.filter((_, j) => j !== i))}
                    className="text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-2"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  {Object.entries(obj)
                    .filter(([k]) => !CAMPOS_OCULTOS.has(k))
                    .map(([k, v]) => (
                      <div key={k} className={
                        typeof v === 'string' && v.length > 60 ? 'col-span-2' :
                        Array.isArray(v) ? 'col-span-2' :
                        typeof v === 'object' && v !== null ? 'col-span-2' : ''
                      }>
                        <CampoEditor
                          campoKey={k}
                          value={v}
                          nivel={nivel + 1}
                          onChange={nv => {
                            const next = [...arr]; next[i] = { ...obj, [k]: nv }; onChange(next)
                          }}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                const tmpl = arr[0]
                  ? Object.fromEntries(Object.keys(arr[0]).map(k => [k,
                      typeof arr[0][k] === 'number' ? 0 :
                      typeof arr[0][k] === 'boolean' ? false :
                      Array.isArray(arr[0][k]) ? [] : '']))
                  : {}
                onChange([...arr, tmpl])
              }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors border border-dashed border-slate-700 hover:border-purple-600 rounded-lg px-3 py-2 w-full justify-center"
            >
              <Plus className="w-3 h-3" /> Agregar {label.toLowerCase().replace(/s$/, '')}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Nested object
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">{label}</label>
          <button onClick={() => setExpandido(e => !e)} className="text-slate-600 hover:text-slate-400 transition-colors">
            {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {expandido && (
          <div className="border-l-2 border-slate-700 pl-3 space-y-3">
            {Object.entries(obj)
              .filter(([k]) => !CAMPOS_OCULTOS.has(k))
              .map(([k, v]) => (
                <CampoEditor
                  key={k}
                  campoKey={k}
                  value={v}
                  nivel={nivel + 1}
                  onChange={nv => onChange({ ...obj, [k]: nv })}
                />
              ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

// ─── Editor RACI especializado ───────────────────────────────────────────────

function EditorRACI({ c, onChange }: { c: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const actividades = (c.actividades as string[]) ?? []
  const roles = (c.roles as string[]) ?? []
  const matriz = (c.matriz as Record<string, Record<string, string>>) ?? {}
  const valores = ['R', 'A', 'C', 'I', '']
  const cellColor: Record<string, string> = {
    R: 'bg-blue-700 text-white', A: 'bg-purple-700 text-white',
    C: 'bg-emerald-700 text-white', I: 'bg-slate-600 text-white', '': 'bg-slate-800 text-slate-600'
  }

  function ciclar(act: string, rol: string) {
    const cur = matriz[act]?.[rol] ?? ''
    const idx = valores.indexOf(cur)
    const next = valores[(idx + 1) % valores.length]
    const nuevaMatriz = { ...matriz, [act]: { ...(matriz[act] ?? {}), [rol]: next } }
    onChange({ ...c, matriz: nuevaMatriz })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <CampoEditor campoKey="actividades" value={actividades} onChange={v => onChange({ ...c, actividades: v })} />
        <CampoEditor campoKey="roles" value={roles} onChange={v => onChange({ ...c, roles: v })} />
      </div>
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">Matriz (click para ciclar R→A→C→I→vacío)</p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-400 p-2 min-w-[180px]">Actividad</th>
                {roles.map(r => <th key={r} className="text-slate-400 p-2 text-center min-w-[60px]">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {actividades.map(act => (
                <tr key={act} className="border-b border-slate-800/50">
                  <td className="text-slate-300 p-2 text-xs">{act}</td>
                  {roles.map(rol => {
                    const val = matriz[act]?.[rol] ?? ''
                    return (
                      <td key={rol} className="p-1 text-center">
                        <button
                          onClick={() => ciclar(act, rol)}
                          className={`w-7 h-7 rounded font-bold text-xs transition-colors ${cellColor[val] ?? cellColor['']}`}
                        >
                          {val || '·'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          {[['R','Responsable'],['A','rinde Cuentas'],['C','Consultado'],['I','Informado']].map(([k,v]) => (
            <span key={k}><span className="font-bold text-slate-300">{k}</span> = {v}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Panel de mejora IA ───────────────────────────────────────────────────────

type DiffCampo = {
  campo: string
  esArray: boolean
  esTexto: boolean
  antes: string | string[]
  despues: string | string[]
}

function etiquetaLegible(item: unknown): string {
  if (typeof item === 'string') return item
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>
    // Para nodos BPMN/flujograma: mostrar el label del paso
    if (obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>
      const label = data.label as string
      const actor = data.actor as string | undefined
      return actor ? `${label} (${actor})` : label
    }
    // Para edges: mostrar como "Origen → Destino" con condición si existe
    if ('source' in obj && 'target' in obj) {
      const label = obj.label ? ` [${obj.label}]` : ''
      return `Paso ${obj.source} → Paso ${obj.target}${label}`
    }
    // Priorizar campos descriptivos comunes
    for (const key of ['descripcion', 'nombre', 'titulo', 'label', 'rol', 'problema', 'nombre_kpi', 'dimension', 'actividad']) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string
    }
    // Fallback: tomar primer string
    const vals = Object.values(obj).filter(x => typeof x === 'string' && x.length > 1)
    return (vals[0] as string) ?? JSON.stringify(obj).slice(0, 80)
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

function calcularDiff(original: Record<string, unknown>, mejorado: Record<string, unknown>): DiffCampo[] {
  const cambios: DiffCampo[] = []
  const todosCampos = Array.from(new Set([...Object.keys(original), ...Object.keys(mejorado)]))
  for (const campo of todosCampos) {
    if (CAMPOS_OCULTOS.has(campo)) continue
    const vAntes = original[campo] ?? null
    const vDespues = mejorado[campo] ?? null
    if (JSON.stringify(vAntes) === JSON.stringify(vDespues)) continue
    const esArray = Array.isArray(vAntes) || Array.isArray(vDespues)
    if (esArray) {
      cambios.push({ campo, esArray: true, esTexto: false, antes: valorALista(vAntes), despues: valorALista(vDespues) })
    } else {
      cambios.push({ campo, esArray: false, esTexto: true, antes: resumirTexto(vAntes), despues: resumirTexto(vDespues) })
    }
  }
  return cambios
}

function MejoraIAPanel({
  artefactoId, contenidoActual, onAplicar, onClose
}: {
  artefactoId: string
  contenidoActual: Record<string, unknown>
  onAplicar: (contenido: Record<string, unknown>, camposModificados: string[]) => void
  onClose: () => void
}) {
  const [instruccion, setInstruccion] = useState('')
  const [mejorando, setMejorando] = useState(false)
  const [sugerencia, setSugerencia] = useState<Record<string, unknown> | null>(null)
  const [diff, setDiff] = useState<DiffCampo[]>([])
  const [error, setError] = useState<string | null>(null)

  useEscapeToClose(true, onClose)

  async function mejorar() {
    setMejorando(true)
    setError(null)
    setSugerencia(null)
    setDiff([])
    try {
      const res = await fetch(`/api/artefactos/${artefactoId}/mejorar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruccion: instruccion || undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      const nuevo = d.contenido as Record<string, unknown>
      setSugerencia(nuevo)
      setDiff(calcularDiff(contenidoActual as Record<string, unknown>, nuevo))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error IA')
    } finally {
      setMejorando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="mejora-ia-titulo" className="w-[440px] bg-slate-900 border-l border-slate-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 id="mejora-ia-titulo" className="text-white font-medium text-sm">Mejorar con IA</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">
              Instrucción para la IA (opcional)
            </label>
            <textarea
              value={instruccion}
              onChange={e => setInstruccion(e.target.value)}
              placeholder="Ej: Hace más énfasis en los riesgos de compliance, agrega criterios de aceptación más específicos..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
            />
          </div>
          <Button
            onClick={mejorar}
            disabled={mejorando}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {mejorando ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analizando y mejorando...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generar versión mejorada</>
            )}
          </Button>

          {error && (
            <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {sugerencia && (
            <div className="space-y-3">
              {/* Resumen de cambios */}
              <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-lg p-3">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  ✓ {diff.length} sección{diff.length !== 1 ? 'es' : ''} con mejoras
                </p>
                <p className="text-slate-500 text-xs">
                  La versión actual se guardará automáticamente en historial.
                </p>
              </div>

              {/* Diff campo a campo */}
              {diff.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">Cambios detectados</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-red-400"><span className="font-bold">−</span> Se elimina</span>
                      <span className="flex items-center gap-1 text-emerald-400"><span className="font-bold">+</span> Se agrega</span>
                    </div>
                  </div>
                  {diff.map((d) => {
                    const nombreVisible = NOMBRE_CAMPO[d.campo] ?? d.campo
                    if (d.esArray) {
                      const antesArr = d.antes as string[]
                      const despuesArr = d.despues as string[]
                      const eliminados = antesArr.filter(x => !despuesArr.includes(x))
                      const agregados = despuesArr.filter(x => !antesArr.includes(x))
                      const iguales = despuesArr.filter(x => antesArr.includes(x))
                      return (
                        <div key={d.campo} className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-800 border-b border-slate-700/50 flex items-center justify-between">
                            <span className="text-slate-300 text-xs font-semibold">{nombreVisible}</span>
                            <span className="text-xs text-slate-500">{antesArr.length} → {despuesArr.length} elementos</span>
                          </div>
                          <div className="p-3 space-y-1">
                            {eliminados.map((item, i) => (
                              <div key={`del-${i}`} className="flex items-start gap-2 bg-red-950/20 border border-red-900/30 rounded px-2 py-1">
                                <span className="text-red-500 text-xs mt-0.5 shrink-0">−</span>
                                <span className="text-red-300 text-xs leading-relaxed">{item}</span>
                              </div>
                            ))}
                            {agregados.map((item, i) => (
                              <div key={`add-${i}`} className="flex items-start gap-2 bg-emerald-950/20 border border-emerald-900/30 rounded px-2 py-1">
                                <span className="text-emerald-500 text-xs mt-0.5 shrink-0">+</span>
                                <span className="text-emerald-300 text-xs leading-relaxed">{item}</span>
                              </div>
                            ))}
                            {iguales.slice(0, 2).map((item, i) => (
                              <div key={`eq-${i}`} className="flex items-start gap-2 px-2 py-1 opacity-40">
                                <span className="text-slate-600 text-xs mt-0.5 shrink-0">·</span>
                                <span className="text-slate-500 text-xs leading-relaxed">{item}</span>
                              </div>
                            ))}
                            {iguales.length > 2 && (
                              <p className="text-slate-600 text-xs px-2 opacity-50">…y {iguales.length - 2} sin cambios</p>
                            )}
                          </div>
                        </div>
                      )
                    }
                    // Campo de texto
                    return (
                      <div key={d.campo} className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-800 border-b border-slate-700/50">
                          <span className="text-slate-300 text-xs font-semibold">{nombreVisible}</span>
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="space-y-1">
                            <span className="text-xs text-red-400 font-medium">Antes</span>
                            <p className="text-xs text-red-300/70 bg-red-950/20 border border-red-900/30 rounded px-2 py-1.5 leading-relaxed">
                              {d.antes as string}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-emerald-400 font-medium">Después</span>
                            <p className="text-xs text-slate-200 bg-emerald-950/20 border border-emerald-900/30 rounded px-2 py-1.5 leading-relaxed">
                              {d.despues as string}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {diff.length === 0 && (
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-sm">La IA no detectó mejoras significativas para este artefacto.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg py-2 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onAplicar(sugerencia, diff.map(d => d.campo))}
                  disabled={diff.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg py-2 text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Aplicar mejoras
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  artefacto: Artefacto
  procesoId: string
  numero?: number
  rol?: string
}

export default function ArtefactoCardEditor({ artefacto: artefactoInicial, procesoId, numero, rol }: Props) {
  const router = useRouter()
  const [artefacto, setArtefacto] = useState(artefactoInicial)
  const [modo, setModo] = useState<'vista' | 'editar'>('vista')
  const [panelAbierto, setPanelAbierto] = useState<'ia' | null>(null)
  const [contenidoEditado, setContenidoEditado] = useState(artefacto.contenido)
  const [motivoCambio, setMotivoCambio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [estadoCambioOk, setEstadoCambioOk] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(true)
  const [camposResaltados, setCamposResaltados] = useState<string[]>([])

  const tipo = artefacto.tipo as TipoArtefacto
  const tipoLabel = LABEL_ARTEFACTO[tipo] ?? tipo
  const estado = artefacto.estado_validacion as EstadoValidacion
  const esConsultor = ['super_admin', 'director_proyecto', 'consultor'].includes(rol ?? '')
  const transicion = (esConsultor ? TRANSICION_CONSULTOR : TRANSICION_CLIENTE)[estado]

  function iniciarEdicion() {
    setContenidoEditado(artefacto.contenido)
    setMotivoCambio('')
    setErrorGuardar(null)
    setModo('editar')
  }

  function cancelarEdicion() {
    setContenidoEditado(artefacto.contenido)
    setModo('vista')
    setErrorGuardar(null)
  }

  const guardar = useCallback(async (contenido: Record<string, unknown>, motivo?: string) => {
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const res = await fetch(`/api/artefactos/${artefacto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido, motivo_cambio: motivo || motivoCambio || 'Edición manual' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setArtefacto(d.artefacto)
      setModo('vista')
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2500)
      router.refresh()
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }, [artefacto.id, motivoCambio, router])

  async function cambiarEstado() {
    if (!transicion) return
    setCambiandoEstado(true)
    try {
      const res = await fetch(`/api/artefactos/${artefacto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_validacion: transicion.siguiente }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setArtefacto(d.artefacto)
      const msg =
        transicion.siguiente === 'validado' ? '✓ Artefacto validado correctamente' :
        transicion.siguiente === 'publicado' ? '✓ Artefacto publicado y visible para el cliente' :
        '✓ Estado actualizado'
      setEstadoCambioOk(msg)
      setTimeout(() => setEstadoCambioOk(null), 4000)
      router.refresh()
    } finally {
      setCambiandoEstado(false)
    }
  }

  function aplicarMejoraIA(contenido: Record<string, unknown>, campos: string[]) {
    setPanelAbierto(null)
    setCamposResaltados(campos)
    guardar(contenido, 'Mejora generada por IA')
    // Quitar resaltado tras 4 segundos
    setTimeout(() => setCamposResaltados([]), 4000)
  }

  const esRaci = tipo === 'raci'

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl transition-all">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setExpandido(e => !e)}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <div className="min-w-0 flex items-center gap-2">
              {numero !== undefined && (
                <span className="shrink-0 text-xs font-mono font-bold text-slate-600 w-6 text-right">{numero}.</span>
              )}
              <h3 className="text-white font-semibold text-sm truncate">{tipoLabel}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-slate-600 text-xs">v{artefacto.version}</span>
                {artefacto.generado_por_ia && (
                  <span className="text-slate-600 text-xs flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> IA
                  </span>
                )}
              </div>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border shrink-0 ${BADGE[estado]}`}>
              {BADGE_LABEL[estado]}
            </span>
            {guardadoOk && (
              <span className="text-emerald-400 text-xs flex items-center gap-1 shrink-0">
                <CheckCircle className="w-3.5 h-3.5" /> Guardado
              </span>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 shrink-0">
            {modo === 'vista' ? (
              <>
                {/* Validar / Publicar */}
                {transicion && (
                  <Button
                    size="sm"
                    onClick={cambiarEstado}
                    disabled={cambiandoEstado}
                    className={`h-7 px-2.5 text-xs ${
                      transicion.siguiente === 'publicado'
                        ? 'bg-blue-700 hover:bg-blue-600'
                        : transicion.siguiente === 'validado' && estado === 'pendiente'
                        ? 'bg-emerald-700 hover:bg-emerald-600'
                        : 'bg-slate-700 hover:bg-slate-600'
                    } text-white`}
                  >
                    {cambiandoEstado ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                      transicion.siguiente === 'publicado' ? <Globe className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />
                    )}
                    <span className="ml-1">{transicion.label}</span>
                  </Button>
                )}
                {/* Mejorar IA */}
                <Tip label="Mejorar con IA">
                  <button
                    onClick={() => setPanelAbierto('ia')}
                    className="h-7 px-2.5 flex items-center gap-1 text-xs text-slate-400 hover:text-purple-400 border border-slate-700 hover:border-purple-600 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> IA
                  </button>
                </Tip>
                {/* Editar */}
                {estado !== 'publicado' && (
                  <Tip label="Editar contenido">
                    <button
                      onClick={iniciarEdicion}
                      className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-white border border-slate-700 hover:border-slate-400 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </Tip>
                )}
                {/* Descargar */}
                <Tip label="Exportar PDF">
                  <a
                    href={`/artefactos/${procesoId}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-white border border-slate-700 hover:border-slate-400 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </Tip>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModo('vista')}
                  className="h-7 px-2.5 flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
                >
                  <Eye className="w-3 h-3" /> Vista
                </button>
                <button
                  onClick={cancelarEdicion}
                  className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => guardar(contenidoEditado)}
                  disabled={guardando}
                  className="h-7 px-2.5 flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Guardar v{artefacto.version + 1}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Banner confirmación de cambio de estado ── */}
        {estadoCambioOk && (
          <div className="mx-4 mt-3 flex items-center gap-3 bg-emerald-950/60 border border-emerald-700/60 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="w-7 h-7 rounded-full bg-emerald-900/80 border border-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-300 text-sm font-medium">{estadoCambioOk}</p>
              <p className="text-emerald-600 text-xs mt-0.5">El estado del artefacto ha sido actualizado</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${BADGE[estado]}`}>
              {BADGE_LABEL[estado]}
            </span>
          </div>
        )}

        {/* ── Cuerpo ── */}
        {expandido && (
          <div className="p-4">
            {/* Banner de campos mejorados por IA */}
            {camposResaltados.length > 0 && modo === 'vista' && (
              <div className="mb-4 flex items-start gap-3 bg-purple-950/40 border border-purple-700/50 rounded-xl px-4 py-3">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-300 text-sm font-medium">
                    IA mejoró {camposResaltados.length} campo{camposResaltados.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-purple-500 text-xs mt-0.5">
                    {camposResaltados.map(c => <span key={c} className="inline-block bg-purple-900/60 border border-purple-700/50 rounded px-1.5 py-0.5 mr-1 font-mono text-purple-300">{c}</span>)}
                  </p>
                </div>
              </div>
            )}
            {modo === 'vista' ? (
              <VistaArtefacto artefacto={artefacto} />
            ) : (
              <div className="space-y-4">
                {/* Motivo del cambio */}
                <div className="flex gap-3 items-center bg-amber-950/20 border border-amber-800/30 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Motivo del cambio (ej: Corrección de roles, Actualización de métricas...)"
                    value={motivoCambio}
                    onChange={e => setMotivoCambio(e.target.value)}
                    className="flex-1 bg-transparent text-slate-300 text-sm placeholder:text-slate-600 focus:outline-none"
                  />
                </div>

                {/* Editor especializado para RACI, genérico para el resto */}
                {esRaci ? (
                  <EditorRACI
                    c={contenidoEditado}
                    onChange={setContenidoEditado}
                  />
                ) : (
                  <div className="space-y-4">
                    {Object.entries(contenidoEditado)
                      .filter(([k]) => !CAMPOS_OCULTOS.has(k))
                      .map(([k, v]) => (
                        <CampoEditor
                          key={k}
                          campoKey={k}
                          value={v}
                          onChange={nv => setContenidoEditado(prev => ({ ...prev, [k]: nv }))}
                        />
                      ))}
                  </div>
                )}

                {errorGuardar && (
                  <div className="bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{errorGuardar}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button onClick={cancelarEdicion} className="text-slate-400 hover:text-white text-sm px-4 py-2 border border-slate-700 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={() => guardar(contenidoEditado)}
                    disabled={guardando}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar versión {artefacto.version + 1}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Paneles laterales ── */}
      {panelAbierto === 'ia' && (
        <MejoraIAPanel
          artefactoId={artefacto.id}
          contenidoActual={artefacto.contenido as Record<string, unknown>}
          onAplicar={aplicarMejoraIA}
          onClose={() => setPanelAbierto(null)}
        />
      )}
    </>
  )
}
