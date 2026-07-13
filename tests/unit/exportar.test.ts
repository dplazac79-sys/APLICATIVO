import { describe, it, expect } from 'vitest'
import { generarEntregableDocx } from '../../src/lib/exportar/generarDocx'
import { generarEntregablePptx } from '../../src/lib/exportar/generarPptx'
import type { EntregablePdf } from '../../src/lib/pdf/generarPdf'

// Smoke tests: generarEntregableDocx/Pptx recorren contenido dinámico y
// arbitrario (claves desconocidas de antemano, valores CLP/%/numéricos,
// nested objects/arrays) — el riesgo real es que un dato inesperado
// (undefined, número negativo, string vacío, array vacío) rompa el render
// a mitad de camino. Estos tests no validan el contenido visual del
// documento, sino que la generación no lanza y produce un archivo ZIP
// válido (ambos formatos son contenedores ZIP) para las formas de datos
// que realmente llegan desde la BD.

const ZIP_MAGIC = [0x50, 0x4b] // "PK" — firma de archivo ZIP (docx y pptx lo son)

function esZipValido(buffer: Buffer) {
  return buffer.length > 0 && buffer[0] === ZIP_MAGIC[0] && buffer[1] === ZIP_MAGIC[1]
}

const entregableGenerico: EntregablePdf = {
  nombre: 'SIPOC — Proceso de Facturación',
  tipo: 'sipoc',
  proyecto: 'Cadena de Suministro',
  fecha: '2026-07-13',
  contenido: {
    proveedores: ['Proveedor A', 'Proveedor B'],
    entradas: ['Solicitud formal'],
    proceso: 'Descripción del proceso principal',
    salidas: ['Resultado procesado'],
    clientes: ['Cliente interno'],
    ahorro_mensual_clp: 1500000,
    roi_pct: 42.5,
  },
}

const entregableSimulacion: EntregablePdf = {
  nombre: 'Simulación Operacional',
  tipo: 'simulacion',
  proyecto: 'Cadena de Suministro',
  fecha: '2026-07-13',
  contenido: {
    conservador: { tiempo_ciclo_tobe_horas: 6.2, ftes_liberados: 1.1 },
    base: { tiempo_ciclo_tobe_horas: 5.4, ftes_liberados: 1.8 },
    optimista: { tiempo_ciclo_tobe_horas: 4.1, ftes_liberados: 2.3 },
  },
}

const entregableConValoresLimite: EntregablePdf = {
  nombre: 'Entregable con datos límite',
  tipo: 'diagnostico',
  proyecto: 'Salud',
  fecha: '',
  contenido: {
    lista_vacia: [],
    valor_null: null,
    valor_undefined: undefined,
    string_vacio: '',
    numero_negativo: -1250.5,
    numero_cero: 0,
    objeto_anidado: { a: 1, b: 'texto' },
  },
}

describe('generarEntregableDocx', () => {
  it('genera un .docx válido para un artefacto genérico', async () => {
    const buffer = await generarEntregableDocx(entregableGenerico)
    expect(esZipValido(buffer)).toBe(true)
  })

  it('genera un .docx válido para contenido tipo simulación (escenarios anidados)', async () => {
    const buffer = await generarEntregableDocx(entregableSimulacion)
    expect(esZipValido(buffer)).toBe(true)
  })

  it('no lanza con valores límite (null, undefined, vacíos, negativos)', async () => {
    const buffer = await generarEntregableDocx(entregableConValoresLimite)
    expect(esZipValido(buffer)).toBe(true)
  })
})

describe('generarEntregablePptx', () => {
  it('genera un .pptx válido para un artefacto genérico', async () => {
    const buffer = await generarEntregablePptx(entregableGenerico)
    expect(esZipValido(buffer)).toBe(true)
  })

  it('genera un .pptx válido para contenido tipo simulación (escenarios anidados)', async () => {
    const buffer = await generarEntregablePptx(entregableSimulacion)
    expect(esZipValido(buffer)).toBe(true)
  })

  it('no lanza con valores límite (null, undefined, vacíos, negativos)', async () => {
    const buffer = await generarEntregablePptx(entregableConValoresLimite)
    expect(esZipValido(buffer)).toBe(true)
  })
})
