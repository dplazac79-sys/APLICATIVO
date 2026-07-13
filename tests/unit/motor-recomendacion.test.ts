import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generarRecomendaciones } from '../../src/lib/automation/motor-recomendacion'

const mockChatCompletion = vi.fn()
vi.mock('@/lib/ai/client', () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  MODELOS: { potente: 'modelo-potente', rapido: 'modelo-rapido' },
}))

const ctxBase = {
  proceso_nombre: 'Aprobación de crédito',
  artefacto_tobe_resumen: 'Flujo digital con validación automática',
  brechas_resumen: 'Falta trazabilidad en tiempo real',
  simulacion_tipo: 'operacional',
  mejora_tiempo_pct: 45,
  ftes_liberados: 1.5,
  roi_pct: 120,
  payback_meses: 8,
  industria: 'Banca',
}

function respuestaIA(recomendaciones: unknown[]) {
  return { choices: [{ message: { content: JSON.stringify({ recomendaciones }) } }] }
}

describe('generarRecomendaciones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parsea las recomendaciones del JSON devuelto por el modelo', async () => {
    mockChatCompletion.mockResolvedValue(
      respuestaIA([{ id: 'r1', tipo_automatizacion: 'RPA', herramientas: ['UiPath'] }])
    )
    const recs = await generarRecomendaciones(ctxBase)
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ id: 'r1', tipo_automatizacion: 'RPA' })
  })

  it('devuelve lista vacía si el modelo no incluye la clave recomendaciones', async () => {
    mockChatCompletion.mockResolvedValue({ choices: [{ message: { content: '{}' } }] })
    const recs = await generarRecomendaciones(ctxBase)
    expect(recs).toEqual([])
  })

  it('propaga el error cuando el contenido del modelo no es JSON parseable', async () => {
    mockChatCompletion.mockResolvedValue({ choices: [{ message: { content: 'no soy json' } }] })
    await expect(generarRecomendaciones(ctxBase)).rejects.toThrow()
  })

  it('interpola los valores del contexto en el prompt enviado al modelo', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA([]))
    await generarRecomendaciones(ctxBase)
    const promptEnviado = mockChatCompletion.mock.calls[0][0].messages[0].content
    expect(promptEnviado).toContain('Aprobación de crédito')
    expect(promptEnviado).toContain('Banca')
    expect(promptEnviado).toContain('120') // roi_pct
    expect(promptEnviado).not.toContain('{{proceso_nombre}}') // sin placeholders sin reemplazar
  })

  it('usa "No hay datos previos" cuando no se pasa kg_snapshot', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA([]))
    await generarRecomendaciones(ctxBase)
    const promptEnviado = mockChatCompletion.mock.calls[0][0].messages[0].content
    expect(promptEnviado).toContain('No hay datos previos para esta industria.')
  })

  it('incluye el kg_snapshot (limitado a 5 elementos) cuando se provee', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA([]))
    const procesos_frecuentes = Array.from({ length: 8 }, (_, i) => ({ nombre: `Proceso ${i}`, frecuencia: i }))
    await generarRecomendaciones({
      ...ctxBase,
      kg_snapshot: {
        id: 'snap-1',
        industria: 'Banca',
        procesos_frecuentes,
        riesgos_frecuentes: [],
        kpis_frecuentes: [],
        automatizaciones: [],
        proyectos_cerrados: 3,
        updated_at: new Date(0).toISOString(),
      },
    })
    const promptEnviado = mockChatCompletion.mock.calls[0][0].messages[0].content
    expect(promptEnviado).toContain('Proceso 0')
    expect(promptEnviado).not.toContain('Proceso 6') // recortado a los primeros 5
  })

  it('usa el modelo potente con temperatura baja para resultados consistentes', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA([]))
    await generarRecomendaciones(ctxBase)
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'modelo-potente', temperature: 0.2 })
    )
  })
})
