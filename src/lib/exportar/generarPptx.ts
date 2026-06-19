import PptxGenJS from 'pptxgenjs'
import type { EntregablePdf } from '@/lib/pdf/generarPdf'

const fmtCLP  = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`
const fmtPct  = (n: number) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`
const fmtNum  = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 })

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

const CAMPO_LABEL: Record<string, string> = {
  tiempo_ciclo_tobe_horas: 'Tiempo ciclo TO-BE (h)',
  throughput_tobe_unidades_dia: 'Throughput TO-BE (u/día)',
  ftes_liberados: 'FTEs liberados',
  ahorro_horas_dia: 'Ahorro horas/día',
  ahorro_mensual_clp: 'Ahorro mensual',
  ahorro_anual_clp: 'Ahorro anual',
  roi_pct: 'ROI',
  payback_meses: 'Payback (meses)',
  ftes_optimizados: 'FTEs optimizados',
  reduccion_dotacion_pct: 'Reducción dotación',
  headcount_tobe: 'Headcount TO-BE',
}
const humaniz = (k: string) =>
  CAMPO_LABEL[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const C = {
  accent: '4F46E5',
  white: 'FFFFFF',
  slate800: '1E293B',
  slate400: '94A3B8',
  bg: 'F8FAFC',
}

// ── Slide helpers ─────────────────────────────────────────────────────────────
function addTitleSlide(pptx: PptxGenJS, e: EntregablePdf) {
  const slide = pptx.addSlide()
  slide.background = { color: C.accent }

  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.06, fill: { color: C.white }, line: { color: C.white } })

  slide.addText('APAC — AICOUNTS Consultores', {
    x: 0.5, y: 1.0, w: 9, h: 0.5,
    fontSize: 14, color: 'CCCCFF', bold: false,
  })

  slide.addText(e.nombre, {
    x: 0.5, y: 1.7, w: 9, h: 1.5,
    fontSize: 32, color: C.white, bold: true, wrap: true,
  })

  slide.addText(e.proyecto, {
    x: 0.5, y: 3.5, w: 9, h: 0.4,
    fontSize: 14, color: 'AAAADD',
  })

  slide.addText(e.fecha, {
    x: 0.5, y: 4.0, w: 9, h: 0.4,
    fontSize: 12, color: 'AAAADD',
  })

  slide.addText('Confidencial — AICOUNTS Consultores', {
    x: 0.5, y: 5.0, w: 9, h: 0.3,
    fontSize: 10, color: 'AAAAAA',
  })
}

function addSlideHeader(slide: PptxGenJS['addSlide'] extends () => infer S ? S : never, title: string, proyecto: string) {
  slide.addShape('rect' as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: '100%', h: 0.7, fill: { color: C.accent }, line: { color: C.accent } })
  slide.addText(title, { x: 0.3, y: 0.1, w: 7, h: 0.5, fontSize: 16, color: C.white, bold: true })
  slide.addText(proyecto, { x: 7.5, y: 0.15, w: 2.2, h: 0.4, fontSize: 9, color: 'CCCCFF', align: 'right' })
}

function addKpiSlide(pptx: PptxGenJS, e: EntregablePdf, titulo: string, kpis: Array<{ label: string; value: string }>) {
  const slide = pptx.addSlide()
  slide.background = { color: C.bg }
  addSlideHeader(slide as Parameters<typeof addSlideHeader>[0], titulo, e.proyecto)

  const cols = Math.min(kpis.length, 4)
  const cardW = 9 / cols
  kpis.slice(0, 4).forEach((kpi, i) => {
    const x = 0.3 + i * cardW
    slide.addShape('rect' as PptxGenJS.SHAPE_NAME, { x, y: 1.0, w: cardW - 0.2, h: 1.6, fill: { color: C.white }, line: { color: 'E2E8F0', pt: 0.5 }, rectRadius: 0.08 })
    slide.addText(kpi.value, { x, y: 1.2, w: cardW - 0.2, h: 0.7, fontSize: 28, bold: true, color: C.accent, align: 'center' })
    slide.addText(kpi.label, { x, y: 2.0, w: cardW - 0.2, h: 0.5, fontSize: 10, color: C.slate400, align: 'center', wrap: true })
  })
}

function addTableSlide(
  pptx: PptxGenJS,
  e: EntregablePdf,
  titulo: string,
  headers: string[],
  rows: string[][]
) {
  const slide = pptx.addSlide()
  slide.background = { color: C.bg }
  addSlideHeader(slide as Parameters<typeof addSlideHeader>[0], titulo, e.proyecto)

  const tableRows: PptxGenJS.TableRow[] = [
    headers.map(h => ({
      text: h,
      options: { bold: true, color: C.white, fill: { color: C.accent }, fontSize: 11 },
    })),
    ...rows.map((row, ri) =>
      row.map(cell => ({
        text: cell,
        options: { fontSize: 11, color: C.slate800, fill: { color: ri % 2 === 0 ? C.white : C.bg } },
      }))
    ),
  ]

  slide.addTable(tableRows, { x: 0.3, y: 0.9, w: 9.2, h: 4.2, border: { pt: 0.3, color: 'E2E8F0' } })
}

// ── Builder por tipo ──────────────────────────────────────────────────────────
function buildSimulacion(pptx: PptxGenJS, e: EntregablePdf) {
  const contenido = e.contenido
  const tipo = String(contenido.tipo_simulacion ?? 'operacional')
  const resultadosTodos = (contenido.resultados_todos ?? {}) as Record<string, Record<string, unknown>>
  const escenario = String(contenido.escenario ?? 'base')
  const resultadoBase = resultadosTodos[escenario] ?? resultadosTodos['base'] ?? {}
  const params = (contenido.parametros ?? {}) as Record<string, unknown>

  const camposKpi = tipo === 'financiera'
    ? ['ahorro_mensual_clp', 'ahorro_anual_clp', 'roi_pct', 'payback_meses']
    : tipo === 'organizacional'
    ? ['ftes_optimizados', 'reduccion_dotacion_pct', 'headcount_tobe']
    : ['tiempo_ciclo_tobe_horas', 'throughput_tobe_unidades_dia', 'ftes_liberados', 'ahorro_horas_dia']

  // Slide resumen ejecutivo
  const resumeSlide = pptx.addSlide()
  resumeSlide.background = { color: C.bg }
  addSlideHeader(resumeSlide as Parameters<typeof addSlideHeader>[0], 'Resumen ejecutivo', e.proyecto)

  let resumen = ''
  if (tipo === 'operacional') {
    const tcAsIs = Number(params.tiempo_ciclo_asis_horas ?? 0)
    const tcToBe = Number(resultadoBase.tiempo_ciclo_tobe_horas ?? 0)
    const mejora = tcAsIs > 0 ? Math.round(((tcAsIs - tcToBe) / tcAsIs) * 100) : 0
    resumen = `Bajo el escenario ${humaniz(escenario).toLowerCase()}, la optimización proyecta una reducción del ${mejora}% en el tiempo de ciclo (de ${fmtNum(tcAsIs)} a ${fmtNum(tcToBe)} horas), liberando ${fmtNum(Number(resultadoBase.ftes_liberados ?? 0))} FTEs y ${fmtNum(Number(resultadoBase.ahorro_horas_dia ?? 0))} horas de trabajo por día.`
  } else if (tipo === 'financiera') {
    resumen = `Bajo el escenario ${humaniz(escenario).toLowerCase()}, se proyecta un ahorro anual de ${fmtCLP(Number(resultadoBase.ahorro_anual_clp ?? 0))} con un ROI de ${fmtPct(Number(resultadoBase.roi_pct ?? 0))} y payback de ${fmtNum(Number(resultadoBase.payback_meses ?? 0))} meses.`
  } else {
    resumen = `Bajo el escenario ${humaniz(escenario).toLowerCase()}, se optimizan ${fmtNum(Number(resultadoBase.ftes_optimizados ?? 0))} FTEs con reducción de dotación del ${fmtPct(Number(resultadoBase.reduccion_dotacion_pct ?? 0))}.`
  }
  resumeSlide.addText(resumen, { x: 0.5, y: 1.0, w: 9, h: 2, fontSize: 14, color: C.slate800, wrap: true, valign: 'top' })

  // Slide KPIs
  addKpiSlide(pptx, e, `Resultados — Escenario ${humaniz(escenario)}`,
    camposKpi.map(c => ({ label: humaniz(c), value: formatVal(c, resultadoBase[c]) }))
  )

  // Slide tabla comparativa
  const ORDEN = ['conservador', 'base', 'optimista', 'custom'].filter(s => resultadosTodos[s])
  if (ORDEN.length > 1) {
    addTableSlide(
      pptx, e,
      'Comparativa de escenarios',
      ['Indicador', ...ORDEN.map(humaniz)],
      camposKpi.map(campo => [humaniz(campo), ...ORDEN.map(s => formatVal(campo, resultadosTodos[s]?.[campo]))])
    )
  }
}

function buildGenerico(pptx: PptxGenJS, e: EntregablePdf) {
  const OCULTOS = new Set(['id', 'proceso_id', 'proyecto_id', 'created_at', 'updated_at', 'simulacion_id', 'artefacto_asis_id', 'proceso_referencia_id'])
  const entries = Object.entries(e.contenido).filter(([k]) => !OCULTOS.has(k))

  const rows: string[][] = []
  for (const [k, v] of entries) {
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        const text = typeof item === 'object' && item !== null
          ? Object.entries(item as Record<string, unknown>).map(([ik, iv]) => `${humaniz(ik)}: ${formatVal(ik, iv)}`).join(' · ')
          : String(item)
        rows.push([`${humaniz(k)} ${i + 1}`, text])
      })
    } else if (typeof v !== 'object' || v === null) {
      rows.push([humaniz(k), formatVal(k, v)])
    }
  }

  if (rows.length > 0) {
    addTableSlide(pptx, e, 'Contenido del entregable', ['Campo', 'Valor'], rows)
  }
}

// ── Función principal ─────────────────────────────────────────────────────────
export async function generarEntregablePptx(e: EntregablePdf): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = e.nombre
  pptx.author = 'AICOUNTS Consultores'
  pptx.company = 'AICOUNTS Consultores'

  addTitleSlide(pptx, e)

  if (e.tipo === 'simulacion') {
    buildSimulacion(pptx, e)
  } else {
    buildGenerico(pptx, e)
  }

  const buf = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return buf
}
