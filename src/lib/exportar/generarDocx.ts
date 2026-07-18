import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumberElement,
} from 'docx'
import type { EntregablePdf } from '@/lib/pdf/generarPdf'

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  carga_trabajo_tobe_ftes: 'FTEs TO-BE',
  ahorro_horas_dia: 'Ahorro horas/día',
  ftes_liberados: 'FTEs liberados',
  ahorro_mensual_clp: 'Ahorro mensual',
  ahorro_anual_clp: 'Ahorro anual',
  roi_pct: 'ROI',
  payback_meses: 'Payback (meses)',
  ftes_optimizados: 'FTEs optimizados',
  reduccion_dotacion_pct: 'Reducción dotación',
  headcount_tobe: 'Headcount TO-BE',
  mejora_aplicada_pct: 'Mejora aplicada',
  conservador: 'Conservador',
  base: 'Base',
  optimista: 'Optimista',
  custom: 'Custom',
}

const humaniz = (k: string) =>
  CAMPO_LABEL[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

// ── Estilos ───────────────────────────────────────────────────────────────────
const ACCENT   = '4F46E5'
const SLATE800 = '1E293B'
const SLATE500 = '64748B'
const WHITE    = 'FFFFFF'
const GRAY100  = 'F1F5F9'

function heading2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: ACCENT, size: 20 })],
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
  })
}

function para(text: string, opts?: { muted?: boolean; bold?: boolean }): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text,
      color: opts?.muted ? SLATE500 : SLATE800,
      bold: opts?.bold,
      size: 20,
    })],
    spacing: { after: 120 },
  })
}

function sectionTable(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([k, v]) => kviRow(k, v)),
  })
}

function kviRow(k: string, v: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: k, color: SLATE500, size: 18 })] })],
        shading: { type: ShadingType.SOLID, color: GRAY100 },
        width: { size: 40, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: v, color: SLATE800, size: 18 })] })],
        width: { size: 60, type: WidthType.PERCENTAGE },
      }),
    ],
  })
}

function escenarioTable(resultadosTodos: Record<string, Record<string, unknown>>, campos: string[]): Table {
  const ORDEN = ['conservador', 'base', 'optimista', 'custom'].filter(e => resultadosTodos[e])
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Indicador', bold: true, color: WHITE, size: 18 })] })],
        shading: { type: ShadingType.SOLID, color: ACCENT },
        width: { size: 34, type: WidthType.PERCENTAGE },
      }),
      ...ORDEN.map(e => new TableCell({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: humaniz(e), bold: true, color: WHITE, size: 18 })],
        })],
        shading: { type: ShadingType.SOLID, color: ACCENT },
        width: { size: Math.floor(66 / ORDEN.length), type: WidthType.PERCENTAGE },
      })),
    ],
  })

  const dataRows = campos.map((campo, i) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: humaniz(campo), color: SLATE500, size: 18, bold: true })] })],
          shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? WHITE : GRAY100 },
          width: { size: 34, type: WidthType.PERCENTAGE },
        }),
        ...ORDEN.map(e => new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: formatVal(campo, resultadosTodos[e]?.[campo]), color: SLATE800, size: 18 })],
          })],
          shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? WHITE : GRAY100 },
          width: { size: Math.floor(66 / ORDEN.length), type: WidthType.PERCENTAGE },
        })),
      ],
    })
  )

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] })
}

// ── Bloques de contenido por tipo ─────────────────────────────────────────────
function buildSimulacionChildren(contenido: Record<string, unknown>): (Paragraph | Table)[] {
  const tipo = String(contenido.tipo_simulacion ?? 'operacional')
  const resultadosTodos = (contenido.resultados_todos ?? {}) as Record<string, Record<string, unknown>>
  const escenario = String(contenido.escenario ?? 'base')
  const params = (contenido.parametros ?? {}) as Record<string, unknown>
  const resultadoBase = resultadosTodos[escenario] ?? resultadosTodos['base'] ?? {}

  const camposTabla = tipo === 'financiera'
    ? ['ahorro_mensual_clp', 'ahorro_anual_clp', 'roi_pct', 'payback_meses']
    : tipo === 'organizacional'
    ? ['ftes_optimizados', 'reduccion_dotacion_pct', 'headcount_tobe']
    : ['tiempo_ciclo_tobe_horas', 'throughput_tobe_unidades_dia', 'ftes_liberados', 'ahorro_horas_dia']

  const blocks: (Paragraph | Table)[] = []

  // Resumen ejecutivo
  let resumen = ''
  if (tipo === 'operacional') {
    const tcAsIs = Number(params.tiempo_ciclo_asis_horas ?? 0)
    const tcToBe = Number(resultadoBase.tiempo_ciclo_tobe_horas ?? 0)
    const mejora = tcAsIs > 0 ? Math.round(((tcAsIs - tcToBe) / tcAsIs) * 100) : 0
    resumen = `Bajo el escenario ${humaniz(escenario).toLowerCase()}, la optimización proyecta una reducción del ${mejora}% en el tiempo de ciclo (de ${fmtNum(tcAsIs)} a ${fmtNum(tcToBe)} horas), liberando ${fmtNum(Number(resultadoBase.ftes_liberados ?? 0))} FTEs y ${fmtNum(Number(resultadoBase.ahorro_horas_dia ?? 0))} horas de trabajo por día.`
  } else if (tipo === 'financiera') {
    resumen = `Bajo el escenario ${humaniz(escenario).toLowerCase()}, se proyecta un ahorro anual de ${fmtCLP(Number(resultadoBase.ahorro_anual_clp ?? 0))} con un ROI de ${fmtPct(Number(resultadoBase.roi_pct ?? 0))} y payback de ${fmtNum(Number(resultadoBase.payback_meses ?? 0))} meses.`
  } else {
    resumen = `Bajo el escenario ${humaniz(escenario).toLowerCase()}, se optimizan ${fmtNum(Number(resultadoBase.ftes_optimizados ?? 0))} FTEs con una reducción de dotación del ${fmtPct(Number(resultadoBase.reduccion_dotacion_pct ?? 0))}.`
  }

  blocks.push(heading2('Resumen ejecutivo'))
  blocks.push(para(resumen))
  blocks.push(new Paragraph({ spacing: { after: 200 } }))

  // Resultados escenario principal
  blocks.push(heading2(`Resultados — Escenario ${humaniz(escenario)}`))
  blocks.push(sectionTable(camposTabla.map(c => [humaniz(c), formatVal(c, resultadoBase[c])])))
  blocks.push(new Paragraph({ spacing: { after: 300 } }))

  // Tabla comparativa
  if (Object.keys(resultadosTodos).length > 1) {
    blocks.push(heading2('Comparativa de escenarios'))
    blocks.push(escenarioTable(resultadosTodos, camposTabla))
    blocks.push(new Paragraph({ spacing: { after: 300 } }))
  }

  return blocks
}

function buildGenericoChildren(contenido: Record<string, unknown>): (Paragraph | Table)[] {
  const OCULTOS = new Set(['id', 'proceso_id', 'proyecto_id', 'created_at', 'updated_at', 'simulacion_id', 'artefacto_asis_id', 'proceso_referencia_id'])
  const blocks: (Paragraph | Table)[] = []

  for (const [k, v] of Object.entries(contenido)) {
    if (OCULTOS.has(k)) continue
    if (Array.isArray(v)) {
      blocks.push(heading2(humaniz(k)))
      v.forEach((item, i) => {
        const text = typeof item === 'object' && item !== null
          ? Object.entries(item as Record<string, unknown>).map(([ik, iv]) => `${humaniz(ik)}: ${formatVal(ik, iv)}`).join(' · ')
          : String(item)
        blocks.push(new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${text}`, color: SLATE800, size: 20 })],
          spacing: { after: 80 },
        }))
      })
    } else if (v !== null && typeof v === 'object') {
      blocks.push(heading2(humaniz(k)))
      blocks.push(sectionTable(
        Object.entries(v as Record<string, unknown>).map(([ik, iv]) => [humaniz(ik), formatVal(ik, iv)])
      ))
      blocks.push(new Paragraph({ spacing: { after: 200 } }))
    } else {
      blocks.push(new Paragraph({
        children: [
          new TextRun({ text: `${humaniz(k)}: `, bold: true, color: SLATE500, size: 20 }),
          new TextRun({ text: formatVal(k, v), color: SLATE800, size: 20 }),
        ],
        spacing: { after: 80 },
      }))
    }
  }
  return blocks
}

// ── Nueva versión de documento de proceso (regenerada por IA) ─────────────────
export interface VersionDocumentoDocx {
  codigo: string
  nombre: string
  numero: number
  proyecto: string
  fecha: string
  textoCompleto: string
  cambiosAplicados: Array<{ seccion: string; tipo: string; descripcion: string }>
  resumenCambios: string
}

const TIPO_CAMBIO_LABEL: Record<string, string> = {
  riesgo: 'Riesgo', hallazgo: 'Hallazgo', brecha: 'Brecha de documentación', rol: 'Rol',
}

export async function generarVersionDocumentoDocx(v: VersionDocumentoDocx): Promise<Buffer> {
  const registroCambios: Paragraph[] = v.cambiosAplicados.length > 0
    ? v.cambiosAplicados.map((c, i) => new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, color: ACCENT, size: 20 }),
          new TextRun({ text: `[${TIPO_CAMBIO_LABEL[c.tipo] ?? c.tipo}] `, bold: true, color: SLATE500, size: 20 }),
          new TextRun({ text: c.seccion ? `${c.seccion} — ` : '', italics: true, color: SLATE500, size: 20 }),
          new TextRun({ text: c.descripcion, color: SLATE800, size: 20 }),
        ],
        spacing: { after: 140 },
      }))
    : [para('Sin cambios registrados respecto a la versión anterior.', { muted: true })]

  const cuerpoDocumento = v.textoCompleto
    .split(/\n{2,}/)
    .map(bloque => bloque.trim())
    .filter(Boolean)
    .map(bloque => new Paragraph({
      children: [new TextRun({ text: bloque, color: SLATE800, size: 20 })],
      spacing: { after: 200 },
    }))

  const doc = new Document({
    numbering: { config: [] },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: SLATE800 } },
      },
    },
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'ProcessOS — AICOUNTS Consultores', bold: true, color: ACCENT, size: 18 }),
              new TextRun({ text: `   |   ${v.proyecto}`, color: SLATE500, size: 18 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Confidencial — AICOUNTS Consultores   |   ${v.fecha}   |   Pág. `, color: SLATE500, size: 16 }),
              new PageNumberElement(),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: `${v.codigo} — VERSIÓN ${v.numero}`, color: ACCENT, bold: true, size: 18 })],
          spacing: { before: 0, after: 200 },
        }),
        new Paragraph({
          text: v.nombre,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 300 },
        }),
        para(`Proyecto: ${v.proyecto}`, { muted: true }),
        para(`Fecha: ${v.fecha}`, { muted: true }),
        new Paragraph({ spacing: { after: 400 } }),

        heading2(`Registro de cambios — Versión ${v.numero}`),
        para(v.resumenCambios),
        new Paragraph({ spacing: { after: 100 } }),
        ...registroCambios,
        new Paragraph({ spacing: { after: 400 } }),

        heading2('Documento actualizado'),
        ...cuerpoDocumento,
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

// ── Función principal ─────────────────────────────────────────────────────────
export async function generarEntregableDocx(e: EntregablePdf): Promise<Buffer> {
  const TIPO_LABEL: Record<string, string> = {
    simulacion: 'Simulación de Impacto',
    reporte: 'Reporte de Automatización',
    roadmap: 'Roadmap de Automatización',
  }

  const contenidoChildren =
    e.tipo === 'simulacion'
      ? buildSimulacionChildren(e.contenido)
      : buildGenericoChildren(e.contenido)

  const doc = new Document({
    numbering: { config: [] },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: SLATE800 } },
      },
    },
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'ProcessOS — AICOUNTS Consultores', bold: true, color: ACCENT, size: 18 }),
              new TextRun({ text: `   |   ${e.proyecto}`, color: SLATE500, size: 18 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Confidencial — AICOUNTS Consultores   |   ${e.fecha}   |   Pág. `, color: SLATE500, size: 16 }),
              new PageNumberElement(),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: (TIPO_LABEL[e.tipo] ?? e.tipo).toUpperCase(), color: ACCENT, bold: true, size: 18 })],
          spacing: { before: 0, after: 200 },
        }),
        new Paragraph({
          text: e.nombre,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 400 },
        }),
        para(`Proyecto: ${e.proyecto}`, { muted: true }),
        para(`Fecha: ${e.fecha}`, { muted: true }),
        new Paragraph({ spacing: { after: 400 } }),
        ...contenidoChildren,
      ],
    }],
  })

  return Packer.toBuffer(doc)
}
