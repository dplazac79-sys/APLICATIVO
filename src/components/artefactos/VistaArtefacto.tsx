'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Artefacto } from '@/types/database'

// React Flow solo corre en el cliente
const DiagramaEditor = dynamic(() => import('./DiagramaEditor'), { ssr: false })

interface Props { artefacto: Artefacto }

export default function VistaArtefacto({ artefacto }: Props) {
  const c = artefacto.contenido
  const readonly = artefacto.estado_validacion === 'publicado'

  switch (artefacto.tipo) {
    case 'sipoc': return <VistaSIPOC c={c} />
    case 'as_is': return <VistaASIS c={c} />
    case 'bpmn':
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
    default: return <pre className="text-xs text-slate-400 overflow-auto">{JSON.stringify(c, null, 2)}</pre>
  }
}

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
      <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">{title}</p>
      {children}
    </div>
  )
}

function Lista({ items }: { items: unknown[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-slate-300 text-sm flex gap-2">
          <span className="text-slate-600 shrink-0">·</span>
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
      <div className="grid grid-cols-5 gap-2">
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
      {c.notas ? <p className="text-slate-500 text-xs italic">{String(c.notas)}</p> : null}
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
                <span className="text-slate-600 text-xs font-bold w-5 shrink-0">{String(p.orden ?? i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{String(p.descripcion ?? '')}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
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
            <span className="text-slate-500 text-xs font-mono">{String(h.id ?? `HU-${i + 1}`)}</span>
            <Pill text={String(h.prioridad ?? 'media')} color={prioColors[String(h.prioridad)] ?? 'slate'} />
          </div>
          <p className="text-slate-200 text-sm">
            <span className="text-slate-400">Como </span>{String(h.rol ?? '')},
            <span className="text-slate-400"> quiero </span>{String(h.necesidad ?? '')},
            <span className="text-slate-400"> para </span>{String(h.beneficio ?? '')}
          </p>
          {(h.criterios_aceptacion as string[] ?? []).length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-1">Criterios de aceptación</p>
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
                      <span className={`inline-block w-6 h-6 rounded text-xs leading-6 ${cellColor[val] ?? 'text-slate-600'}`}>
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
      <div className="flex gap-4 mt-2 text-xs text-slate-500">
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
            <span className="text-slate-500 text-xs font-mono">{String(r.id ?? `R-${i+1}`)}</span>
            <Pill text={String(r.nivel_riesgo ?? 'medio')} color={nivelColor[String(r.nivel_riesgo)] ?? 'slate'} />
            <Pill text={String(r.categoria ?? '')} />
          </div>
          <p className="text-slate-200 text-sm">{String(r.descripcion ?? '')}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-500">Prob:</span> <span className="text-slate-300">{String(r.probabilidad ?? '')}</span></div>
            <div><span className="text-slate-500">Impacto:</span> <span className="text-slate-300">{String(r.impacto ?? '')}</span></div>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-800/30 rounded p-2">
            <p className="text-emerald-400 text-xs font-medium">Control</p>
            <p className="text-slate-300 text-xs mt-0.5">{String(r.control ?? '')}</p>
            <p className="text-slate-500 text-xs mt-0.5">Responsable: {String(r.responsable ?? '')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function VistaKPIs({ c }: { c: Record<string, unknown> }) {
  const indicadores = (c.indicadores as Array<Record<string, unknown>>) ?? []
  return (
    <div className="space-y-3">
      {indicadores.map((k, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-200 text-sm font-medium">{String(k.nombre ?? '')}</p>
              <p className="text-slate-500 text-xs">{String(k.descripcion ?? '')}</p>
            </div>
            <Pill text={String(k.frecuencia ?? '')} color="blue" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-900 rounded p-2">
              <p className="text-slate-500">Línea base</p>
              <p className="text-slate-200 font-medium">{String(k.linea_base ?? '')}</p>
            </div>
            <div className="bg-emerald-950/40 rounded p-2">
              <p className="text-emerald-600">Meta</p>
              <p className="text-emerald-300 font-medium">{String(k.meta ?? '')}</p>
            </div>
            <div className="bg-blue-950/40 rounded p-2">
              <p className="text-blue-600">SLA</p>
              <p className="text-blue-300 font-medium">{String(k.sla ?? '')}</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>Fórmula: <span className="text-slate-300 font-mono">{String(k.formula ?? '')}</span></span>
            <span>· Dueño: {String(k.dueno ?? '')}</span>
          </div>
        </div>
      ))}
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
  return (
    <div className="space-y-4">
      {c.descripcion_estado_futuro ? (
        <p className="text-slate-300 text-sm leading-relaxed">{String(c.descripcion_estado_futuro)}</p>
      ) : null}
      {pasos.length > 0 && (
        <Section title="Pasos del proceso futuro">
          <div className="space-y-2">
            {pasos.map((p, i) => (
              <div key={i} className="flex gap-3 bg-slate-800/50 rounded-lg p-2.5">
                <span className="text-slate-600 text-xs font-bold w-5 shrink-0">{String(p.orden ?? i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{String(p.descripcion ?? '')}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                    {p.responsable ? <span>{String(p.responsable)}</span> : null}
                    {p.automatizado ? <span className="text-purple-400">· Automatizado</span> : null}
                    {p.herramienta ? <span>· {String(p.herramienta)}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {(c.mejoras_respecto_asis as string[] ?? []).length > 0 && (
        <Section title="Mejoras vs AS-IS">
          <Lista items={c.mejoras_respecto_asis as string[]} />
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Procesos transformados', value: String(c.procesos_transformados ?? '') },
          { label: 'Reducción tiempo ciclo', value: String(c.reduccion_tiempo_ciclo_estimada ?? '') },
          { label: 'ROI estimado', value: String(c.roi_estimado ?? '') },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-slate-500 text-xs">{m.label}</p>
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
