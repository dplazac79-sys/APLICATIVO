'use client'

import { memo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Artefacto } from '@/types/database'

// React Flow solo corre en el cliente
const DiagramaEditor = dynamic(() => import('./DiagramaEditor'), { ssr: false })
const BpmnEditor = dynamic(() => import('./BpmnEditor'), { ssr: false })

interface Props { artefacto: Artefacto }

function VistaArtefacto({ artefacto }: Props) {
  const c = artefacto.contenido
  const readonly = artefacto.estado_validacion === 'publicado'

  switch (artefacto.tipo) {
    case 'sipoc': return <VistaSIPOC c={c} />
    case 'as_is': return <VistaASIS c={c} />
    case 'bpmn': return (
      <BpmnEditor
        artefactoId={artefacto.id}
        initialNodes={(c.nodes as never[]) ?? []}
        initialEdges={(c.edges as never[]) ?? []}
        lanes={(c.lanes as string[]) ?? []}
        titulo={(c.titulo as string) ?? ''}
        readonly={readonly}
      />
    )
    case 'flujograma': return (
      <DiagramaEditor
        artefactoId={artefacto.id}
        initialNodes={(c.nodes as never[]) ?? []}
        initialEdges={(c.edges as never[]) ?? []}
        readonly={readonly}
      />
    )
    case 'historias_usuario': return <VistaHistorias c={c} />
    case 'raci': return <VistaRACI c={c} />
    case 'riesgo_control': return <VistaRiesgos c={c} />
    case 'kpi_sla': return <VistaKPIs c={c} />
    case 'diagnostico': return <VistaDiagnostico c={c} />
    case 'to_be': return <VistaTOBE c={c} />
    case 'dashboard_brechas': return <VistaBrechas c={c} />
    case 'cierre_ejecutivo': return <VistaCierre c={c} />
    case 'checklist': return <VistaChecklist c={c} />
    case 'backlog': return <VistaBacklog c={c} />
    case 'cinco_porques': return <VistaCincoPorques c={c} />
    case 'acta_inicio': return <VistaActaInicio c={c} />
    case 'plan_pruebas': return <VistaPlanPruebas c={c} />
    case 'roadmap': return <VistaRoadmap c={c} />
    default: return <pre className="text-xs text-slate-400 overflow-auto">{JSON.stringify(c, null, 2)}</pre>
  }
}

// Memoizado — se monta vía dynamic() dentro de ArtefactoCardEditor, que tiene
// su propio estado de edición (textarea de instrucción IA, toggles, etc.);
// sin esto, cada keystroke del editor reconciliaba de nuevo todo el árbol de
// la vista del artefacto (potencialmente decenas de nodos por cada Vista*).
export default memo(VistaArtefacto)

// ── Componentes de vista por tipo ────────────────────────────────────────────

function Pill({ text, color = 'slate' }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
    red: 'bg-red-950 text-red-400 border-red-800',
    amber: 'bg-amber-950 text-amber-400 border-amber-800',
    emerald: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    blue: 'bg-blue-950 text-blue-400 border-blue-800',
    purple: 'bg-purple-950 text-purple-400 border-purple-800',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[color] ?? colors.slate}`}>
      {text}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">{title}</p>
      {children}
    </div>
  )
}

function Lista({ items }: { items: unknown[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-slate-300 text-sm flex gap-2">
          <span className="text-slate-400 shrink-0">·</span>
          {String(item)}
        </li>
      ))}
    </ul>
  )
}

function VistaSIPOC({ c }: { c: Record<string, unknown> }) {
  const cols = [
    { key: 'proveedores', label: 'Proveedores', color: 'blue' },
    { key: 'entradas', label: 'Entradas', color: 'purple' },
    { key: 'proceso', label: 'Proceso', color: 'emerald' },
    { key: 'salidas', label: 'Salidas', color: 'amber' },
    { key: 'clientes', label: 'Clientes', color: 'slate' },
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cols.map(({ key, label, color }) => {
          const val = c[key]
          return (
            <div key={key} className="space-y-1.5">
              <p className={`text-xs font-semibold uppercase tracking-wider text-${color}-400`}>{label}</p>
              <div className="bg-slate-800/60 rounded-lg p-2 min-h-[80px] space-y-1">
                {Array.isArray(val)
                  ? val.map((v, i) => <p key={i} className="text-slate-300 text-xs leading-snug">{String(v)}</p>)
                  : <p className="text-slate-300 text-xs leading-snug font-medium">{String(val ?? '')}</p>
                }
              </div>
            </div>
          )
        })}
      </div>
      {c.notas ? <p className="text-slate-400 text-xs italic">{String(c.notas)}</p> : null}
    </div>
  )
}

function VistaASIS({ c }: { c: Record<string, unknown> }) {
  const pasos = (c.pasos as Array<Record<string, unknown>>) ?? []
  return (
    <div className="space-y-4">
      {c.descripcion_estado_actual ? (
        <p className="text-slate-300 text-sm leading-relaxed">{String(c.descripcion_estado_actual)}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Actores">
          <div className="flex flex-wrap gap-1">{(c.actores as string[] ?? []).map((a, i) => <Pill key={i} text={a} color="blue" />)}</div>
        </Section>
        <Section title="Sistemas involucrados">
          <div className="flex flex-wrap gap-1">{(c.sistemas_involucrados as string[] ?? []).map((s, i) => <Pill key={i} text={s} color="purple" />)}</div>
        </Section>
      </div>
      {pasos.length > 0 && (
        <Section title="Pasos del proceso">
          <div className="space-y-2">
            {pasos.map((p, i) => (
              <div key={i} className="flex gap-3 bg-slate-800/50 rounded-lg p-2.5">
                <span className="text-slate-400 text-xs font-bold w-5 shrink-0">{String(p.orden ?? i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{String(p.descripcion ?? '')}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                    {p.responsable ? <span>{String(p.responsable)}</span> : null}
                    {p.duracion_estimada ? <span>· {String(p.duracion_estimada)}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {(c.puntos_dolor as string[] ?? []).length > 0 && (
        <Section title="Puntos de dolor">
          <Lista items={c.puntos_dolor as string[]} />
        </Section>
      )}
    </div>
  )
}

function VistaHistorias({ c }: { c: Record<string, unknown> }) {
  const historias = (c.historias as Array<Record<string, unknown>>) ?? []
  const prioColors: Record<string, string> = { alta: 'red', media: 'amber', baja: 'slate' }
  return (
    <div className="space-y-3">
      {historias.map((h, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-mono">{String(h.id ?? `HU-${i + 1}`)}</span>
            <Pill text={String(h.prioridad ?? 'media')} color={prioColors[String(h.prioridad)] ?? 'slate'} />
          </div>
          <p className="text-slate-200 text-sm">
            <span className="text-slate-400">Como </span>{String(h.rol ?? '')},
            <span className="text-slate-400"> quiero </span>{String(h.necesidad ?? '')},
            <span className="text-slate-400"> para </span>{String(h.beneficio ?? '')}
          </p>
          {(h.criterios_aceptacion as string[] ?? []).length > 0 && (
            <div>
              <p className="text-slate-400 text-xs mb-1">Criterios de aceptación</p>
              <ul className="space-y-0.5">
                {(h.criterios_aceptacion as string[]).map((ca, j) => (
                  <li key={j} className="text-slate-400 text-xs flex gap-1.5">
                    <span className="text-emerald-600">✓</span>{ca}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function VistaRACI({ c }: { c: Record<string, unknown> }) {
  const actividades = (c.actividades as string[]) ?? []
  const roles = (c.roles as string[]) ?? []
  const matriz = (c.matriz as Record<string, Record<string, string>>) ?? {}
  const cellColor: Record<string, string> = {
    R: 'bg-blue-900 text-blue-300 font-bold',
    A: 'bg-purple-900 text-purple-300 font-bold',
    C: 'bg-emerald-900 text-emerald-300',
    I: 'bg-slate-800 text-slate-400',
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-slate-400 p-2 border-b border-slate-700 min-w-[180px]">Actividad</th>
            {roles.map(r => (
              <th key={r} className="text-slate-400 p-2 border-b border-slate-700 text-center min-w-[80px]">{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {actividades.map(act => (
            <tr key={act} className="border-b border-slate-800/50">
              <td className="text-slate-300 p-2">{act}</td>
              {roles.map(rol => {
                const val = matriz[act]?.[rol] ?? ''
                return (
                  <td key={rol} className="text-center p-1">
                    {val && (
                      <span className={`inline-block w-6 h-6 rounded text-xs leading-6 ${cellColor[val] ?? 'text-slate-400'}`}>
                        {val}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        {[['R','Responsable'],['A','rinde Cuentas'],['C','Consultado'],['I','Informado']].map(([k,v]) => (
          <span key={k}><span className={`font-bold ${k==='R'?'text-blue-400':k==='A'?'text-purple-400':k==='C'?'text-emerald-400':'text-slate-400'}`}>{k}</span> = {v}</span>
        ))}
      </div>
    </div>
  )
}

function VistaRiesgos({ c }: { c: Record<string, unknown> }) {
  const riesgos = (c.riesgos as Array<Record<string, unknown>>) ?? []
  const nivelColor: Record<string, string> = {
    critico: 'red', alto: 'amber', medio: 'blue', bajo: 'slate',
  }
  return (
    <div className="space-y-2">
      {riesgos.map((r, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-mono">{String(r.id ?? `R-${i+1}`)}</span>
            <Pill text={String(r.nivel_riesgo ?? 'medio')} color={nivelColor[String(r.nivel_riesgo)] ?? 'slate'} />
            <Pill text={String(r.categoria ?? '')} />
          </div>
          <p className="text-slate-200 text-sm">{String(r.descripcion ?? '')}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-400">Prob:</span> <span className="text-slate-300">{String(r.probabilidad ?? '')}</span></div>
            <div><span className="text-slate-400">Impacto:</span> <span className="text-slate-300">{String(r.impacto ?? '')}</span></div>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-800/30 rounded p-2">
            <p className="text-emerald-400 text-xs font-medium">Control</p>
            <p className="text-slate-300 text-xs mt-0.5">{String(r.control ?? '')}</p>
            <p className="text-slate-400 text-xs mt-0.5">Responsable: {String(r.responsable ?? '')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function VistaKPIs({ c }: { c: Record<string, unknown> }) {
  const indicadores = (c.indicadores as Array<Record<string, unknown>>) ?? []
  const fin = c.financiero as Record<string, unknown> | undefined
  const fmt = (n: unknown) => n ? Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '—'
  return (
    <div className="space-y-3">
      {indicadores.map((k, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-200 text-sm font-medium">{String(k.nombre ?? '')}</p>
              <p className="text-slate-400 text-xs">{String(k.descripcion ?? '')}</p>
            </div>
            <Pill text={String(k.frecuencia ?? '')} color="blue" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-900 rounded p-2">
              <p className="text-slate-400">Línea base</p>
              <p className="text-slate-200 font-medium">{String(k.linea_base ?? '')}</p>
            </div>
            <div className="bg-emerald-950/40 rounded p-2">
              <p className="text-emerald-600">Meta 12m</p>
              <p className="text-emerald-300 font-medium">{String(k.meta ?? '')}</p>
            </div>
            <div className="bg-purple-950/40 rounded p-2">
              <p className="text-purple-500">Valor real</p>
              <p className="text-purple-300 font-medium italic">{String(k.valor_real ?? '—')}</p>
            </div>
            <div className="bg-blue-950/40 rounded p-2">
              <p className="text-blue-600">SLA</p>
              <p className="text-blue-300 font-medium">{String(k.sla ?? '')}</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <span>Fórmula: <span className="text-slate-300 font-mono">{String(k.formula ?? '')}</span></span>
            <span>· Dueño: {String(k.dueno ?? '')}</span>
            <span>· Fuente: {String(k.fuente_dato ?? '')}</span>
          </div>
        </div>
      ))}
      {fin && (Number(fin.costo_mensual_proceso_clp) > 0 || Number(fin.inversion_estimada_clp) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {[
            { label: 'Costo/hora FTE', value: fmt(fin.costo_hora_fte_clp), color: 'slate' },
            { label: 'Costo mensual proceso', value: fmt(fin.costo_mensual_proceso_clp), color: 'amber' },
            { label: 'Inversión estimada', value: fmt(fin.inversion_estimada_clp), color: 'emerald' },
          ].map(m => (
            <div key={m.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-slate-400 text-xs">{m.label}</p>
              <p className={`text-${m.color}-300 text-sm font-bold mt-1`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VistaDiagnostico({ c }: { c: Record<string, unknown> }) {
  const nivel = Number(c.nivel_madurez ?? 0)
  const cuadrantes = [
    { key: 'fortalezas', label: 'Fortalezas', color: 'emerald' },
    { key: 'debilidades', label: 'Debilidades', color: 'red' },
    { key: 'oportunidades', label: 'Oportunidades', color: 'blue' },
    { key: 'amenazas', label: 'Amenazas', color: 'amber' },
  ]
  return (
    <div className="space-y-4">
      {/* Nivel de madurez */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <div key={n} className={`w-8 h-2 rounded-full ${n <= nivel ? 'bg-purple-500' : 'bg-slate-700'}`} />
          ))}
        </div>
        <span className="text-purple-400 text-sm font-medium">Nivel {nivel}/5</span>
        <span className="text-slate-400 text-sm">{String(c.nivel_madurez_descripcion ?? '')}</span>
      </div>
      {/* FODA */}
      <div className="grid grid-cols-2 gap-3">
        {cuadrantes.map(({ key, label, color }) => (
          <div key={key} className={`bg-${color}-950/20 border border-${color}-800/30 rounded-lg p-3 space-y-1.5`}>
            <p className={`text-${color}-400 text-xs font-semibold uppercase tracking-wider`}>{label}</p>
            <Lista items={(c[key] as string[]) ?? []} />
          </div>
        ))}
      </div>
      {(c.brechas_criticas as string[] ?? []).length > 0 && (
        <Section title="Brechas críticas">
          <Lista items={c.brechas_criticas as string[]} />
        </Section>
      )}
      {(c.recomendaciones_prioritarias as string[] ?? []).length > 0 && (
        <Section title="Recomendaciones prioritarias">
          <Lista items={c.recomendaciones_prioritarias as string[]} />
        </Section>
      )}
    </div>
  )
}

function VistaTOBE({ c }: { c: Record<string, unknown> }) {
  const pasos = (c.pasos as Array<Record<string, unknown>>) ?? []
  const metricas = (c.metricas_objetivo as Array<Record<string, unknown>>) ?? []
  return (
    <div className="space-y-4">
      {c.descripcion_estado_futuro ? (
        <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-4">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Estado Futuro TO-BE</p>
          <p className="text-slate-200 text-sm leading-relaxed">{String(c.descripcion_estado_futuro)}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Actores">
          <div className="flex flex-wrap gap-1">{(c.actores as string[] ?? []).map((a, i) => <Pill key={i} text={a} color="emerald" />)}</div>
        </Section>
        <Section title="Sistemas requeridos">
          <div className="flex flex-wrap gap-1">{(c.sistemas_requeridos as string[] ?? []).map((s, i) => <Pill key={i} text={s} color="purple" />)}</div>
        </Section>
      </div>
      {pasos.length > 0 && (
        <Section title="Pasos del proceso futuro">
          <div className="space-y-2">
            {pasos.map((p, i) => (
              <div key={i} className={`flex gap-3 rounded-lg p-2.5 ${p.automatizado ? 'bg-emerald-950/30 border border-emerald-800/30' : 'bg-slate-800/50'}`}>
                <span className="text-emerald-600 text-xs font-bold w-5 shrink-0">{String(p.orden ?? i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{String(p.descripcion ?? '')}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                    {p.responsable ? <span>{String(p.responsable)}</span> : null}
                    {p.automatizado ? <span className="text-emerald-400 font-medium">⚡ Automatizado</span> : null}
                    {p.herramienta ? <span>· {String(p.herramienta)}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {metricas.length > 0 && (
        <Section title="Métricas objetivo">
          <div className="grid grid-cols-2 gap-2">
            {metricas.map((m, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-2.5 text-xs">
                <p className="text-slate-400 font-medium mb-1">{String(m.nombre ?? '')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-red-400 line-through">{String(m.valor_actual ?? '')}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-emerald-400 font-bold">{String(m.valor_objetivo ?? '')}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {(c.mejoras_respecto_asis as string[] ?? []).length > 0 && (
        <Section title="Mejoras vs AS-IS">
          <ul className="space-y-1">
            {(c.mejoras_respecto_asis as string[]).map((item, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-emerald-500 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function VistaBrechas({ c }: { c: Record<string, unknown> }) {
  const comp = (c.comparativo as Array<Record<string, unknown>>) ?? []
  const impactoColor: Record<string, string> = { alto: 'red', medio: 'amber', bajo: 'slate' }
  return (
    <div className="space-y-4">
      {c.resumen_ejecutivo ? (
        <p className="text-slate-300 text-sm leading-relaxed">{String(c.resumen_ejecutivo)}</p>
      ) : null}
      {comp.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                {['Dimensión','AS-IS','TO-BE','Brecha','Impacto','Iniciativa'].map(h => (
                  <th key={h} className="text-left text-slate-400 p-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comp.map((row, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="text-slate-300 p-2 font-medium">{String(row.dimension ?? '')}</td>
                  <td className="text-slate-400 p-2">{String(row.valor_asis ?? '')}</td>
                  <td className="text-emerald-400 p-2">{String(row.valor_tobe ?? '')}</td>
                  <td className="text-slate-400 p-2">{String(row.brecha ?? '')}</td>
                  <td className="p-2"><Pill text={String(row.impacto ?? '')} color={impactoColor[String(row.impacto)] ?? 'slate'} /></td>
                  <td className="text-slate-300 p-2">{String(row.iniciativa ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(c.quick_wins as string[] ?? []).length > 0 && (
        <Section title="Quick Wins">
          <Lista items={c.quick_wins as string[]} />
        </Section>
      )}
    </div>
  )
}

function VistaCierre({ c }: { c: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {c.resumen_proyecto ? (
        <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/40 rounded-xl p-4">
          <p className="text-slate-300 text-sm leading-relaxed">{String(c.resumen_proyecto)}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Procesos transformados', value: String(c.procesos_transformados ?? '') },
          { label: 'Reducción tiempo ciclo', value: String(c.reduccion_tiempo_ciclo_estimada ?? '') },
          { label: 'ROI estimado', value: String(c.roi_estimado ?? '') },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-slate-400 text-xs">{m.label}</p>
            <p className="text-white text-lg font-bold mt-1">{m.value}</p>
          </div>
        ))}
      </div>
      {(c.logros_principales as string[] ?? []).length > 0 && (
        <Section title="Logros principales"><Lista items={c.logros_principales as string[]} /></Section>
      )}
      {(c.proximos_pasos as string[] ?? []).length > 0 && (
        <Section title="Próximos pasos"><Lista items={c.proximos_pasos as string[]} /></Section>
      )}
      {c.recomendacion_ceo ? (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-2">Recomendación para el CEO</p>
          <p className="text-white text-sm font-medium leading-relaxed">{String(c.recomendacion_ceo)}</p>
        </div>
      ) : null}
    </div>
  )
}

function VistaChecklist({ c }: { c: Record<string, unknown> }) {
  const checklists = (c.checklists as Array<Record<string, unknown>>) ?? []
  const faseColors: Record<string, string> = {
    preparacion: 'blue', ejecucion: 'emerald', cierre: 'amber',
  }
  const faseLabel: Record<string, string> = {
    preparacion: 'Preparación', ejecucion: 'Ejecución', cierre: 'Cierre',
  }
  return (
    <div className="space-y-6">
      {c.frecuencia_uso ? (
        <p className="text-slate-400 text-xs">Frecuencia de uso: <Pill text={String(c.frecuencia_uso)} color="blue" /></p>
      ) : null}
      {checklists.map((cl, i) => {
        const items = (cl.items as Array<Record<string, unknown>>) ?? []
        const fases = ['preparacion', 'ejecucion', 'cierre'] as const
        return (
          <div key={i} className="space-y-3">
            <div>
              <p className="text-white text-sm font-semibold">{String(cl.rol ?? '')}</p>
              <p className="text-slate-400 text-xs">{String(cl.descripcion_rol ?? '')}</p>
            </div>
            {fases.map(fase => {
              const faseItems = items.filter(it => String(it.fase) === fase)
              if (!faseItems.length) return null
              return (
                <div key={fase}>
                  <p className={`text-${faseColors[fase]}-400 text-xs font-semibold uppercase tracking-wider mb-1.5`}>
                    {faseLabel[fase]}
                  </p>
                  <div className="space-y-1">
                    {faseItems.map((it, j) => (
                      <div key={j} className={`flex gap-2.5 rounded-lg p-2 ${it.critico ? 'bg-red-950/20 border border-red-800/20' : 'bg-slate-800/40'}`}>
                        <span className="w-4 h-4 border border-slate-600 rounded shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm">{String(it.descripcion ?? '')}</p>
                          {it.nota ? <p className="text-slate-400 text-xs mt-0.5">{String(it.nota)}</p> : null}
                        </div>
                        {it.critico ? <span className="text-red-400 text-xs shrink-0">crítico</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {i < checklists.length - 1 && <hr className="border-slate-800" />}
          </div>
        )
      })}
    </div>
  )
}

function VistaBacklog({ c }: { c: Record<string, unknown> }) {
  const iniciativas = (c.iniciativas as Array<Record<string, unknown>>) ?? []
  const resumen = c.resumen as Record<string, unknown> | undefined
  const catColor: Record<string, string> = {
    quick_win: 'emerald', proyecto_medio: 'blue', proyecto_mayor: 'amber',
  }
  const catLabel: Record<string, string> = {
    quick_win: 'Quick Win', proyecto_medio: 'Proyecto Medio', proyecto_mayor: 'Proyecto Mayor',
  }
  return (
    <div className="space-y-3">
      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
          {[
            { label: 'Quick Wins', value: resumen.total_quick_wins, color: 'emerald' },
            { label: 'Proyectos medianos', value: resumen.total_proyectos_medios, color: 'blue' },
            { label: 'Proyectos mayores', value: resumen.total_proyectos_mayores, color: 'amber' },
          ].map(m => (
            <div key={m.label} className={`bg-${m.color}-950/30 border border-${m.color}-800/30 rounded-lg p-3 text-center`}>
              <p className={`text-${m.color}-400 text-lg font-bold`}>{String(m.value ?? 0)}</p>
              <p className="text-slate-400 text-xs">{m.label}</p>
            </div>
          ))}
        </div>
      )}
      {iniciativas.map((ini, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-slate-400 text-xs font-mono">{String(ini.id ?? '')}</span>
                <Pill text={catLabel[String(ini.categoria)] ?? String(ini.categoria)} color={catColor[String(ini.categoria)] ?? 'slate'} />
                <Pill text={String(ini.tiempo_estimado ?? '')} />
              </div>
              <p className="text-slate-200 text-sm font-medium">{String(ini.titulo ?? '')}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="flex gap-1 justify-end">
                {Array.from({ length: 5 }).map((_, n) => (
                  <div key={n} className={`w-2 h-4 rounded-sm ${n < Number(ini.impacto ?? 0) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                ))}
              </div>
              <p className="text-slate-400 text-xs mt-0.5">impacto</p>
            </div>
          </div>
          <p className="text-slate-400 text-xs">{String(ini.descripcion ?? '')}</p>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Esfuerzo: {'●'.repeat(Number(ini.esfuerzo ?? 0))}{'○'.repeat(5 - Number(ini.esfuerzo ?? 0))}</span>
            <span>Líder: {String(ini.responsable_sugerido ?? '')}</span>
          </div>
          <p className="text-emerald-400 text-xs">{String(ini.beneficio_esperado ?? '')}</p>
        </div>
      ))}
    </div>
  )
}

function VistaCincoPorques({ c }: { c: Record<string, unknown> }) {
  const analisis = (c.analisis as Array<Record<string, unknown>>) ?? []
  const tipoColor: Record<string, string> = {
    proceso: 'blue', tecnologia: 'purple', personas: 'amber', datos: 'emerald', gestion: 'red',
  }
  return (
    <div className="space-y-6">
      {analisis.map((a, i) => {
        const cadena = (a.cadena as Array<Record<string, unknown>>) ?? []
        return (
          <div key={i} className="space-y-3">
            <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-3">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">Problema {i + 1}</p>
              <p className="text-white text-sm font-medium">{String(a.problema ?? '')}</p>
              <p className="text-slate-400 text-xs mt-1">{String(a.impacto ?? '')}</p>
            </div>
            <div className="relative pl-4">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-700 rounded" />
              {cadena.map((paso, j) => (
                <div key={j} className="relative mb-2 pl-4">
                  <div className="absolute left-[-1px] top-2 w-3 h-0.5 bg-slate-700" />
                  <div className="bg-slate-800/50 rounded-lg p-2.5">
                    <span className="text-slate-400 text-xs font-bold">{j < 4 ? `¿Por qué? ${j + 1}` : '↳ Causa raíz'}</span>
                    <p className={`text-sm mt-0.5 ${j === 4 ? 'text-amber-300 font-medium' : 'text-slate-300'}`}>{String(paso.porque ?? '')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Pill text={String(a.tipo_causa ?? '')} color={tipoColor[String(a.tipo_causa)] ?? 'slate'} />
                <p className="text-amber-300 text-xs font-medium">{String(a.causa_raiz ?? '')}</p>
              </div>
              <div className="border-t border-amber-800/30 pt-2">
                <p className="text-slate-400 text-xs mb-0.5">Acción correctiva</p>
                <p className="text-slate-200 text-sm">{String(a.accion_correctiva ?? '')}</p>
              </div>
            </div>
            {i < analisis.length - 1 && <hr className="border-slate-800" />}
          </div>
        )
      })}
      {c.conclusion_sistemica ? (
        <div className="bg-purple-950/30 border border-purple-700/40 rounded-xl p-4">
          <p className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-2">Conclusión Sistémica</p>
          <p className="text-slate-200 text-sm leading-relaxed">{String(c.conclusion_sistemica)}</p>
        </div>
      ) : null}
    </div>
  )
}

function VistaActaInicio({ c }: { c: Record<string, unknown> }) {
  const objetivos = (c.objetivos as Array<Record<string, unknown>>) ?? []
  const alcance = c.alcance as Record<string, string[]> | undefined
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
        <p className="text-white text-base font-medium">{String(c.titulo_proyecto ?? '')}</p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span>Inicio: <span className="text-slate-200">{String(c.fecha_inicio ?? '—')}</span></span>
          <span>Fin est.: <span className="text-slate-200">{String(c.fecha_fin_estimada ?? '—')}</span></span>
          <span>Presupuesto: <span className="text-slate-200">{String(c.presupuesto_estimado ?? '—')}</span></span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {c.patrocinador ? <span>Sponsor: <Pill text={String(c.patrocinador)} color="purple" /></span> : null}
          {c.director_proyecto ? <span>Director: <Pill text={String(c.director_proyecto)} color="blue" /></span> : null}
        </div>
      </div>
      {c.proposito ? (
        <Section title="Propósito">
          <p className="text-slate-300 text-sm leading-relaxed">{String(c.proposito)}</p>
        </Section>
      ) : null}
      {alcance ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">Incluye</p>
            <Lista items={alcance.incluye ?? []} />
          </div>
          <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-3">
            <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">Excluye</p>
            <Lista items={alcance.excluye ?? []} />
          </div>
        </div>
      ) : null}
      {objetivos.length > 0 && (
        <Section title="Objetivos">
          <div className="space-y-2">
            {objetivos.map((o, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-2.5 flex gap-3">
                <span className="text-slate-400 text-xs font-bold w-5 shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-slate-200 text-sm">{String(o.descripcion ?? '')}</p>
                  <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                    <span>Métrica: {String(o.metrica ?? '')}</span>
                    <span>· Meta: <span className="text-emerald-400">{String(o.meta ?? '')}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      <div className="grid grid-cols-2 gap-3">
        {(c.supuestos as string[] ?? []).length > 0 && (
          <Section title="Supuestos"><Lista items={c.supuestos as string[]} /></Section>
        )}
        {(c.restricciones as string[] ?? []).length > 0 && (
          <Section title="Restricciones"><Lista items={c.restricciones as string[]} /></Section>
        )}
      </div>
      {(c.criterios_exito as string[] ?? []).length > 0 && (
        <Section title="Criterios de éxito">
          <ul className="space-y-1">
            {(c.criterios_exito as string[]).map((item, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-emerald-500 shrink-0">✓</span>{item}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {(c.firmas_requeridas as string[] ?? []).length > 0 && (
        <div className="border border-dashed border-slate-600 rounded-lg p-3">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Firmas requeridas</p>
          <div className="flex flex-wrap gap-3">
            {(c.firmas_requeridas as string[]).map((f, i) => (
              <div key={i} className="border border-slate-600 rounded px-4 py-5 text-center min-w-[120px]">
                <div className="h-6 border-b border-slate-600 mb-1" />
                <p className="text-slate-400 text-xs">{f}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VistaPlanPruebas({ c }: { c: Record<string, unknown> }) {
  const casos = (c.casos as Array<Record<string, unknown>>) ?? []
  const tipoColor: Record<string, string> = { funcional: 'blue', excepcion: 'amber', integracion: 'purple' }
  const prioColor: Record<string, string> = { alta: 'red', media: 'amber', baja: 'slate' }
  return (
    <div className="space-y-4">
      {c.resumen ? <p className="text-slate-300 text-sm leading-relaxed">{String(c.resumen)}</p> : null}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-800/50 rounded-lg p-2.5">
          <p className="text-slate-400">Ambiente</p>
          <p className="text-slate-200 mt-0.5">{String(c.ambiente_pruebas ?? '—')}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2.5">
          <p className="text-slate-400">Responsable</p>
          <p className="text-slate-200 mt-0.5">{String(c.responsable_pruebas ?? '—')}</p>
        </div>
      </div>
      <Section title={`Casos de prueba (${casos.length})`}>
        <div className="space-y-2">
          {casos.map((cp, i) => {
            const pasos = (cp.pasos as string[]) ?? []
            return (
              <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-xs font-mono">{String(cp.id ?? `CP-${i+1}`)}</span>
                  <Pill text={String(cp.tipo ?? '')} color={tipoColor[String(cp.tipo)] ?? 'slate'} />
                  <Pill text={String(cp.prioridad ?? '')} color={prioColor[String(cp.prioridad)] ?? 'slate'} />
                  <span className="text-slate-200 text-sm font-medium">{String(cp.nombre ?? '')}</span>
                </div>
                {cp.precondicion ? <p className="text-slate-400 text-xs">Precondición: {String(cp.precondicion)}</p> : null}
                {pasos.length > 0 && (
                  <ol className="space-y-0.5 pl-4">
                    {pasos.map((p, j) => <li key={j} className="text-slate-400 text-xs list-decimal">{p}</li>)}
                  </ol>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-950/30 rounded p-2">
                    <p className="text-emerald-600 font-medium">Resultado esperado</p>
                    <p className="text-slate-300 mt-0.5">{String(cp.resultado_esperado ?? '')}</p>
                  </div>
                  <div className="bg-red-950/30 rounded p-2">
                    <p className="text-red-600 font-medium">Criterio de falla</p>
                    <p className="text-slate-300 mt-0.5">{String(cp.criterio_falla ?? '')}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>
      {(c.criterios_aprobacion as string[] ?? []).length > 0 && (
        <Section title="Criterios de aprobación">
          <ul className="space-y-1">
            {(c.criterios_aprobacion as string[]).map((item, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-emerald-500 shrink-0">✓</span>{item}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {c.plan_contingencia ? (
        <div className="bg-amber-950/20 border border-amber-700/40 rounded-lg p-3">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">Plan de contingencia</p>
          <p className="text-slate-300 text-sm">{String(c.plan_contingencia)}</p>
        </div>
      ) : null}
    </div>
  )
}

function VistaRoadmap({ c }: { c: Record<string, unknown> }) {
  const fases = (c.fases as Array<Record<string, unknown>>) ?? []
  const duracionTotal = Number(c.duracion_total_semanas ?? 0)
  const barColors = ['#378ADD', '#7F77DD', '#1D9E75', '#BA7517', '#D85A30']
  const textColors = ['text-blue-400', 'text-purple-400', 'text-emerald-400', 'text-amber-400', 'text-red-400']
  const bgBorders = [
    'bg-blue-950/10 border-blue-800/40',
    'bg-purple-950/10 border-purple-800/40',
    'bg-emerald-950/10 border-emerald-800/40',
    'bg-amber-950/10 border-amber-800/40',
    'bg-red-950/10 border-red-800/40',
  ]
  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs text-slate-400">
        <span>Duración total: <span className="text-white font-medium">{duracionTotal} semanas</span></span>
        <span>Metodología: <span className="text-white font-medium">{String(c.metodologia ?? '—')}</span></span>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
        {fases.map((f, i) => {
          const semInicio = Number(f.semana_inicio ?? 1)
          const semFin = Number(f.semana_fin ?? semInicio)
          const pct = duracionTotal > 0 ? ((semFin - semInicio + 1) / duracionTotal) * 100 : 0
          return (
            <div key={i} style={{ width: `${pct}%`, backgroundColor: barColors[i % barColors.length] }} className="h-full" title={String(f.nombre ?? '')} />
          )
        })}
      </div>
      {fases.map((f, i) => {
        const actividades = (f.actividades as string[]) ?? []
        const entregables = (f.entregables as string[]) ?? []
        const hitos = (f.hitos as string[]) ?? []
        return (
          <div key={i} className={`border rounded-xl p-4 space-y-3 ${bgBorders[i % bgBorders.length]}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${textColors[i % textColors.length]}`}>Fase {i+1}</span>
                <p className="text-white text-sm font-medium">{String(f.nombre ?? '')}</p>
              </div>
              <span className={`text-xs ${textColors[i % textColors.length]}`}>Sem {String(f.semana_inicio ?? '')}–{String(f.semana_fin ?? '')} · {String(f.duracion_semanas ?? '')} semanas</span>
            </div>
            <p className="text-slate-400 text-sm">{String(f.objetivo ?? '')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {actividades.length > 0 && (
                <div>
                  <p className="text-slate-400 uppercase tracking-wider mb-1">Actividades</p>
                  <Lista items={actividades} />
                </div>
              )}
              {entregables.length > 0 && (
                <div>
                  <p className="text-slate-400 uppercase tracking-wider mb-1">Entregables</p>
                  <Lista items={entregables} />
                </div>
              )}
              {hitos.length > 0 && (
                <div>
                  <p className="text-slate-400 uppercase tracking-wider mb-1">Hitos</p>
                  <ul className="space-y-1">
                    {hitos.map((h, j) => (
                      <li key={j} className={`text-xs flex gap-1.5 ${textColors[i % textColors.length]}`}>◆ <span className="text-slate-300">{h}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {(c.factores_exito as string[] ?? []).length > 0 && (
        <Section title="Factores de éxito"><Lista items={c.factores_exito as string[]} /></Section>
      )}
    </div>
  )
}
