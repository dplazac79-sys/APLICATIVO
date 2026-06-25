import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

export type EntregablePdf = {
  nombre: string
  tipo: string
  proyecto: string
  fecha: string
  contenido: Record<string, unknown>
}

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#FFFFFF',
  text: '#1E293B',
  muted: '#64748B',
  faint: '#94A3B8',
  accent: '#4F46E5',
  accentSoft: '#EEF2FF',
  border: '#E2E8F0',
  rowAlt: '#F8FAFC',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
}

const S = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 10,
    paddingTop: 52,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
    paddingBottom: 12,
    marginBottom: 24,
  },
  logo: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.accent },
  logoSub: { fontSize: 8, color: C.muted, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  proyectoHeader: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text },
  fechaHeader: { fontSize: 8, color: C.muted, marginTop: 2 },
  tipoTag: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentSoft,
    color: C.accent,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 20 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: C.accentSoft,
    paddingBottom: 4,
  },
  section: { marginBottom: 18 },
  // KPI cards
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kpiCard: {
    width: '22%',
    backgroundColor: C.rowAlt,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.accent },
  kpiLabel: { fontSize: 7, color: C.muted, marginTop: 2, textAlign: 'center' },
  // tabla escenarios
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.accent,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableHeaderCell: { fontFamily: 'Helvetica-Bold', color: '#FFFFFF', fontSize: 9 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRowAlt: { backgroundColor: C.rowAlt },
  tableCell: { color: C.text, fontSize: 9 },
  // recomendaciones
  recoCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderLeftColor: C.accent,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
    backgroundColor: C.rowAlt,
  },
  recoTipo: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 4 },
  recoLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.muted, marginTop: 6 },
  recoText: { fontSize: 9, color: C.text, marginTop: 2 },
  herramientasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  herramienta: {
    fontSize: 8,
    color: C.accent,
    backgroundColor: C.accentSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  scoreRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  scoreBox: {
    backgroundColor: C.greenSoft,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  scoreVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.green },
  scoreLabel: { fontSize: 7, color: C.muted },
  // lista simple
  listItem: { flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 14, color: C.accent, fontFamily: 'Helvetica-Bold' },
  listText: { flex: 1, color: C.text },
  // clave:valor genérico
  kvRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 5 },
  kvKey: { width: '40%', color: C.muted, fontFamily: 'Helvetica-Bold', paddingRight: 8 },
  kvVal: { width: '60%', color: C.text },
  // aviso
  aviso: {
    backgroundColor: C.amberSoft,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  avisoText: { fontSize: 9, color: C.amber },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: C.faint },
})

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtCLP  = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`
const fmtPct  = (n: number) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`
const fmtNum  = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 })
const humaniz = (k: string) => {
  const map: Record<string, string> = {
    tiempo_ciclo_tobe_horas: 'Tiempo ciclo TO-BE (h)',
    throughput_tobe_unidades_dia: 'Throughput TO-BE (u/día)',
    carga_trabajo_tobe_ftes: 'FTEs TO-BE',
    ahorro_horas_dia: 'Ahorro horas/día',
    ftes_liberados: 'FTEs liberados',
    ftes_optimizados: 'FTEs optimizados',
    mejora_aplicada_pct: 'Mejora aplicada',
    reduccion_dotacion_pct: 'Reducción dotación',
    ahorro_mensual_clp: 'Ahorro mensual',
    ahorro_anual_clp: 'Ahorro anual',
    roi_pct: 'ROI',
    payback_meses: 'Payback (meses)',
    costo_implementacion_clp: 'Inversión requerida',
    headcount_tobe: 'Headcount TO-BE',
    conservador: 'Conservador',
    base: 'Base',
    optimista: 'Optimista',
    custom: 'Custom',
  }
  return map[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const esCLP = (k: string) => k.includes('clp')
const esPct = (k: string) => k.includes('pct')

function formatVal(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') {
    if (esCLP(k)) return fmtCLP(v)
    if (esPct(k)) return fmtPct(v)
    return fmtNum(v)
  }
  return String(v)
}

// ── Renderizadores específicos por tipo ──────────────────────────────────────

type EscenarioResultado = Record<string, number | string>
type ParamsOp = { tiempo_ciclo_asis_horas?: number; throughput_asis_unidades_dia?: number; carga_trabajo_asis_ftes?: number; mejora_tiempo_ciclo_pct?: number; mejora_throughput_pct?: number }
type ParamsFin = { costo_operacional_mensual_clp?: number; costo_implementacion_clp?: number; valor_hora_clp?: number; mejora_tiempo_ciclo_pct?: number }
type ParamsOrg = { headcount_actual?: number; ftes_a_liberar_base?: number; roles_involucrados?: string[]; roles_nuevos_estimados?: string[] }

function buildResumenEjecutivo(tipo: string, params: Record<string, unknown>, resultadoBase: EscenarioResultado | null, escenario: string): string {
  if (!resultadoBase) return ''
  const esc = humaniz(escenario).toLowerCase()

  if (tipo === 'operacional') {
    const p = params as ParamsOp
    const tcAsIs = p.tiempo_ciclo_asis_horas ?? 0
    const tcToBe = Number(resultadoBase.tiempo_ciclo_tobe_horas ?? 0)
    const mejora = tcAsIs > 0 ? Math.round(((tcAsIs - tcToBe) / tcAsIs) * 100) : 0
    const ftes = fmtNum(Number(resultadoBase.ftes_liberados ?? 0))
    const ahorro = fmtNum(Number(resultadoBase.ahorro_horas_dia ?? 0))
    return `Bajo el escenario ${esc}, la optimización del proceso proyecta una reducción del ${mejora}% en el tiempo de ciclo (de ${fmtNum(tcAsIs)} a ${fmtNum(tcToBe)} horas), liberando ${ftes} FTEs y ${ahorro} horas de trabajo por día. Estos resultados representan el impacto directo de implementar las mejoras del proceso TO-BE identificadas en el análisis.`
  }

  if (tipo === 'financiera') {
    const p = params as ParamsFin
    const roi = fmtPct(Number(resultadoBase.roi_pct ?? 0))
    const ahorro = fmtCLP(Number(resultadoBase.ahorro_anual_clp ?? 0))
    const payback = fmtNum(Number(resultadoBase.payback_meses ?? 0))
    const inversion = fmtCLP(Number(p.costo_implementacion_clp ?? 0))
    return `Bajo el escenario ${esc}, la iniciativa proyecta un ahorro anual de ${ahorro} con una inversión de ${inversion}, alcanzando un ROI de ${roi} y un período de recuperación de ${payback} meses. El análisis financiero valida la viabilidad económica de la transformación propuesta.`
  }

  if (tipo === 'organizacional') {
    const p = params as ParamsOrg
    const hcActual = p.headcount_actual ?? 0
    const hcToBe = Number(resultadoBase.headcount_tobe ?? 0)
    const reduc = fmtPct(Number(resultadoBase.reduccion_dotacion_pct ?? 0))
    const ftes = fmtNum(Number(resultadoBase.ftes_optimizados ?? 0))
    return `Bajo el escenario ${esc}, la restructuración organizacional proyecta optimizar ${ftes} FTEs (reducción del ${reduc}%), pasando de ${hcActual} a ${hcToBe} personas en el proceso. Los roles liberados pueden ser reasignados a actividades de mayor valor estratégico.`
  }

  return ''
}

function RenderSimulacion({ contenido }: { contenido: Record<string, unknown> }) {
  const tipo = String(contenido.tipo_simulacion ?? contenido.tipo ?? 'operacional')
  const resultadosTodos = contenido.resultados_todos as Record<string, EscenarioResultado> | null
  const escenarioPrincipal = String(contenido.escenario ?? 'base')
  const params = (contenido.parametros ?? {}) as Record<string, unknown>

  const ESCENARIOS_ORDEN = ['conservador', 'base', 'optimista', 'custom']
  const escenarios = resultadosTodos
    ? ESCENARIOS_ORDEN.filter(e => resultadosTodos[e])
    : []

  const resultadoBase = resultadosTodos?.[escenarioPrincipal] ?? resultadosTodos?.['base'] ?? null

  const camposTabla: string[] = tipo === 'financiera'
    ? ['ahorro_mensual_clp', 'ahorro_anual_clp', 'roi_pct', 'payback_meses']
    : tipo === 'organizacional'
    ? ['ftes_optimizados', 'reduccion_dotacion_pct', 'headcount_tobe']
    : ['tiempo_ciclo_tobe_horas', 'throughput_tobe_unidades_dia', 'ftes_liberados', 'ahorro_horas_dia']

  // AS-IS vs TO-BE para simulación operacional
  type AsisToBeFila = { indicador: string; asis: string; tobe: string; delta: string; positivo: boolean }
  const asisToBeFilas: AsisToBeFila[] = []
  if (tipo === 'operacional' && resultadoBase) {
    const p = params as ParamsOp
    if (p.tiempo_ciclo_asis_horas && resultadoBase.tiempo_ciclo_tobe_horas !== undefined) {
      const asis = p.tiempo_ciclo_asis_horas
      const tobe = Number(resultadoBase.tiempo_ciclo_tobe_horas)
      const delta = asis > 0 ? Math.round(((asis - tobe) / asis) * 100) : 0
      asisToBeFilas.push({ indicador: 'Tiempo de ciclo (horas)', asis: fmtNum(asis), tobe: fmtNum(tobe), delta: `↓ ${delta}%`, positivo: true })
    }
    if (p.throughput_asis_unidades_dia && resultadoBase.throughput_tobe_unidades_dia !== undefined) {
      const asis = p.throughput_asis_unidades_dia
      const tobe = Number(resultadoBase.throughput_tobe_unidades_dia)
      const delta = asis > 0 ? Math.round(((tobe - asis) / asis) * 100) : 0
      asisToBeFilas.push({ indicador: 'Throughput (unidades/día)', asis: fmtNum(asis), tobe: fmtNum(tobe), delta: `↑ ${delta}%`, positivo: true })
    }
    if (p.carga_trabajo_asis_ftes && resultadoBase.carga_trabajo_tobe_ftes !== undefined) {
      const asis = p.carga_trabajo_asis_ftes
      const tobe = Number(resultadoBase.carga_trabajo_tobe_ftes)
      const delta = asis > 0 ? Math.round(((asis - tobe) / asis) * 100) : 0
      asisToBeFilas.push({ indicador: 'Carga de trabajo (FTEs)', asis: fmtNum(asis), tobe: fmtNum(tobe), delta: `↓ ${delta}%`, positivo: true })
    }
  }

  const resumen = buildResumenEjecutivo(tipo, params, resultadoBase, escenarioPrincipal)

  return (
    <>
      {/* Resumen ejecutivo */}
      {resumen ? (
        <View style={[S.section, { backgroundColor: C.accentSoft, borderRadius: 6, padding: 14, borderLeftWidth: 4, borderLeftColor: C.accent }]}>
          <Text style={[S.sectionTitle, { borderBottomWidth: 0, marginBottom: 6 }]}>Resumen ejecutivo</Text>
          <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>{resumen}</Text>
        </View>
      ) : null}

      {/* Tabla AS-IS vs TO-BE */}
      {asisToBeFilas.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Situación actual vs. proceso optimizado</Text>
          <View style={S.tableHeader}>
            <Text style={[S.tableHeaderCell, { flex: 2.5 }]}>Indicador</Text>
            <Text style={[S.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>AS-IS (actual)</Text>
            <Text style={[S.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>TO-BE (propuesto)</Text>
            <Text style={[S.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Mejora</Text>
          </View>
          {asisToBeFilas.map((f, i) => (
            <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 2.5, fontFamily: 'Helvetica-Bold', color: C.muted }]}>{f.indicador}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center' }]}>{f.asis}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: C.accent }]}>{f.tobe}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center', color: C.green, fontFamily: 'Helvetica-Bold' }]}>{f.delta}</Text>
            </View>
          ))}
        </View>
      )}

      {/* KPIs principales */}
      {resultadoBase && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Resultados — Escenario {humaniz(escenarioPrincipal)}</Text>
          <View style={S.kpiGrid}>
            {camposTabla.map(campo => {
              const val = resultadoBase[campo]
              if (val === undefined) return null
              return (
                <View key={campo} style={S.kpiCard}>
                  <Text style={S.kpiValue}>{formatVal(campo, val)}</Text>
                  <Text style={S.kpiLabel}>{humaniz(campo)}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Tabla comparativa de escenarios */}
      {escenarios.length > 1 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>Comparativa de escenarios</Text>
          <View style={S.tableHeader}>
            <Text style={[S.tableHeaderCell, { flex: 2 }]}>Indicador</Text>
            {escenarios.map(e => (
              <Text key={e} style={[S.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                {humaniz(e)}
              </Text>
            ))}
          </View>
          {camposTabla.map((campo, i) => (
            <View key={campo} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold', color: C.muted }]}>
                {humaniz(campo)}
              </Text>
              {escenarios.map(e => {
                const val = resultadosTodos?.[e]?.[campo]
                const esEscPrincipal = e === escenarioPrincipal
                return (
                  <Text key={e} style={[S.tableCell, { flex: 1, textAlign: 'center', fontFamily: esEscPrincipal ? 'Helvetica-Bold' : 'Helvetica', color: esEscPrincipal ? C.accent : C.text }]}>
                    {formatVal(campo, val)}
                  </Text>
                )
              })}
            </View>
          ))}
        </View>
      )}

      {/* Recomendaciones si existen */}
      {Array.isArray(contenido.recomendaciones) && contenido.recomendaciones.length > 0 && (
        <RenderRecomendaciones recs={contenido.recomendaciones} />
      )}
    </>
  )
}

type Reco = { tipo_automatizacion?: string; tipo?: string; justificacion?: string; herramientas?: string[]; score_impacto?: number; score_esfuerzo?: number; titulo?: string; beneficio_esperado?: string }

function RenderRecomendaciones({ recs }: { recs: unknown[] }) {
  const TIPO_LABEL: Record<string, string> = {
    RPA: 'Automatización Robótica (RPA)',
    integracion: 'Integración de Sistemas',
    ia_generativa: 'Inteligencia Artificial Generativa',
    workflow: 'Gestión de Flujos de Trabajo',
    hibrida: 'Solución Híbrida',
  }
  return (
    <View style={S.section}>
      <Text style={S.sectionTitle}>Recomendaciones de automatización</Text>
      {recs.map((raw, i) => {
        const r = (raw ?? {}) as Reco
        const tipo = r.tipo_automatizacion ?? r.tipo ?? ''
        const herramientas = Array.isArray(r.herramientas) ? r.herramientas : []
        return (
          <View key={i} style={S.recoCard} wrap={false}>
            <Text style={S.recoTipo}>{TIPO_LABEL[tipo] ?? tipo}</Text>
            {r.titulo ? <Text style={[S.recoText, { fontFamily: 'Helvetica-Bold', marginBottom: 4 }]}>{r.titulo}</Text> : null}
            {r.justificacion ? (
              <>
                <Text style={S.recoLabel}>Justificación</Text>
                <Text style={S.recoText}>{r.justificacion}</Text>
              </>
            ) : null}
            {r.beneficio_esperado ? (
              <>
                <Text style={S.recoLabel}>Beneficio esperado</Text>
                <Text style={S.recoText}>{r.beneficio_esperado}</Text>
              </>
            ) : null}
            {herramientas.length > 0 ? (
              <>
                <Text style={S.recoLabel}>Herramientas sugeridas</Text>
                <View style={S.herramientasRow}>
                  {herramientas.map((h, j) => <Text key={j} style={S.herramienta}>{h}</Text>)}
                </View>
              </>
            ) : null}
            {(r.score_impacto || r.score_esfuerzo) ? (
              <View style={S.scoreRow}>
                {r.score_impacto ? (
                  <View style={S.scoreBox}>
                    <Text style={S.scoreVal}>{r.score_impacto}/5</Text>
                    <Text style={S.scoreLabel}>Impacto</Text>
                  </View>
                ) : null}
                {r.score_esfuerzo ? (
                  <View style={[S.scoreBox, { backgroundColor: C.amberSoft }]}>
                    <Text style={[S.scoreVal, { color: C.amber }]}>{r.score_esfuerzo}/5</Text>
                    <Text style={S.scoreLabel}>Esfuerzo</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function RenderRoadmap({ contenido }: { contenido: Record<string, unknown> }) {
  const recs = Array.isArray(contenido.recomendaciones) ? contenido.recomendaciones : []
  return (
    <>
      <View style={S.section}>
        <Text style={S.sectionTitle}>Resumen del roadmap</Text>
        <View style={[S.kvRow]}>
          <Text style={S.kvKey}>Total de iniciativas</Text>
          <Text style={S.kvVal}>{recs.length}</Text>
        </View>
        <View style={[S.kvRow]}>
          <Text style={S.kvKey}>Exportado el</Text>
          <Text style={S.kvVal}>
            {contenido.exportado_en
              ? new Date(String(contenido.exportado_en)).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
              : '—'}
          </Text>
        </View>
      </View>
      {recs.length > 0 && <RenderRecomendaciones recs={recs} />}
    </>
  )
}

function RenderArtefacto({ contenido }: { contenido: Record<string, unknown> }) {
  const CAMPOS_OCULTOS = new Set(['id', 'proceso_id', 'proyecto_id', 'created_at', 'updated_at'])
  const CAMPOS_LISTA = ['pasos', 'mejoras', 'riesgos', 'actividades', 'roles', 'herramientas_sugeridas', 'indicadores', 'acciones']

  const entries = Object.entries(contenido).filter(([k]) => !CAMPOS_OCULTOS.has(k))

  return (
    <>
      {entries.map(([k, v]) => {
        const esLista = CAMPOS_LISTA.includes(k) || Array.isArray(v)
        if (esLista && Array.isArray(v)) {
          return (
            <View key={k} style={S.section}>
              <Text style={S.sectionTitle}>{humaniz(k)}</Text>
              {v.map((item, i) => (
                <View key={i} style={S.listItem}>
                  <Text style={S.bullet}>{i + 1}.</Text>
                  <Text style={S.listText}>
                    {typeof item === 'object' && item !== null
                      ? Object.entries(item as Record<string, unknown>)
                          .map(([ik, iv]) => `${humaniz(ik)}: ${formatVal(ik, iv)}`)
                          .join(' · ')
                      : String(item)}
                  </Text>
                </View>
              ))}
            </View>
          )
        }
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          return (
            <View key={k} style={S.section}>
              <Text style={S.sectionTitle}>{humaniz(k)}</Text>
              {Object.entries(v as Record<string, unknown>).map(([ik, iv]) => (
                <View key={ik} style={S.kvRow}>
                  <Text style={S.kvKey}>{humaniz(ik)}</Text>
                  <Text style={S.kvVal}>{formatVal(ik, iv)}</Text>
                </View>
              ))}
            </View>
          )
        }
        return (
          <View key={k} style={S.kvRow}>
            <Text style={S.kvKey}>{humaniz(k)}</Text>
            <Text style={S.kvVal}>{formatVal(k, v)}</Text>
          </View>
        )
      })}
    </>
  )
}

function ContenidoRender({ tipo, contenido }: { tipo: string; contenido: Record<string, unknown> }) {
  if (tipo === 'simulacion') return <RenderSimulacion contenido={contenido} />
  if (tipo === 'roadmap' || tipo === 'reporte') return <RenderRoadmap contenido={contenido} />
  return <RenderArtefacto contenido={contenido} />
}

const TIPO_LABEL_DOC: Record<string, string> = {
  simulacion: 'Simulación de Impacto',
  reporte: 'Reporte de Automatización',
  roadmap: 'Roadmap de Automatización',
  artefacto: 'Artefacto de Proceso',
}

function EntregableDoc({ e }: { e: EntregablePdf }) {
  const tipoLabel = TIPO_LABEL_DOC[e.tipo] ?? humaniz(e.tipo)
  return (
    <Document title={e.nombre} author="AICOUNTS Consultores" creator="ProcessOS — ProcessOS">
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header} fixed>
          <View>
            <Text style={S.logo}>ProcessOS — AICOUNTS Consultores</Text>
            <Text style={S.logoSub}>Plataforma de Optimización de Procesos</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.proyectoHeader}>{e.proyecto}</Text>
            <Text style={S.fechaHeader}>{e.fecha}</Text>
          </View>
        </View>

        <Text style={S.tipoTag}>{tipoLabel.toUpperCase()}</Text>
        <Text style={S.titulo}>{e.nombre.replace(/^simulaci[oó]n\s+\w+\s*[—\-–]\s*/i, '')}</Text>

        <ContenidoRender tipo={e.tipo} contenido={e.contenido ?? {}} />

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Confidencial — AICOUNTS Consultores</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function generarEntregablePdf(entregable: EntregablePdf): Promise<Buffer> {
  return renderToBuffer(<EntregableDoc e={entregable} />)
}
