import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generarArtefacto, type ContextoProceso, type DocumentoResumen } from '../../src/lib/ai/artefactos'

const mockChatCompletion = vi.fn()
vi.mock('@/lib/ai/client', () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  MODELOS: { potente: 'modelo-potente', rapido: 'modelo-rapido' },
}))

const procesoBase: ContextoProceso = {
  nombre: 'Aprobación de crédito',
  descripcion: 'Proceso de evaluación y aprobación',
  nivel: 1,
  origen: 'detectado',
  roles_involucrados: ['Analista', 'Supervisor'],
  riesgos_detectados: ['Fraude'],
  metadata_ia: null,
  proyecto_nombre: 'Transformación Banca',
  cliente_razon_social: 'Banco Andes S.A.',
  cliente_industria: 'Banca',
}

const documentosBase: DocumentoResumen[] = [
  { nombre_archivo: 'manual.pdf', resumen_ejecutivo: 'Manual de procesos', clasificacion: null },
]

function respuestaIA(resultado: Record<string, unknown>) {
  return { choices: [{ message: { content: JSON.stringify({ resultado }) } }] }
}

describe('generarArtefacto', () => {
  beforeEach(() => vi.clearAllMocks())

  it('genera un artefacto AS-IS y devuelve el JSON parseado', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA({ descripcion_estado_actual: 'x' }))
    const res = await generarArtefacto('as_is', procesoBase, documentosBase)
    expect(res).toEqual({ descripcion_estado_actual: 'x' })
  })

  it('acepta la respuesta directamente sin envolver en {resultado} si el modelo no la envuelve', async () => {
    mockChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ campo: 1 }) } }] })
    const res = await generarArtefacto('as_is', procesoBase, documentosBase)
    expect(res).toEqual({ campo: 1 })
  })

  it('hace fallback al modelo rápido si el modelo potente falla', async () => {
    mockChatCompletion
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(respuestaIA({ ok: true }))
    const res = await generarArtefacto('as_is', procesoBase, documentosBase)
    expect(res).toEqual({ ok: true })
    expect(mockChatCompletion).toHaveBeenCalledTimes(2)
    expect(mockChatCompletion.mock.calls[0][0].model).toBe('modelo-potente')
    expect(mockChatCompletion.mock.calls[1][0].model).toBe('modelo-rapido')
  })

  it('lanza un error descriptivo si ambos modelos fallan', async () => {
    mockChatCompletion.mockRejectedValue(new Error('modelo caído'))
    await expect(generarArtefacto('as_is', procesoBase, documentosBase)).rejects.toThrow(/Error generando artefacto IA/)
  })

  it('marca el prompt con advertencia de anclaje documental cuando hay documentos', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA({}))
    await generarArtefacto('as_is', procesoBase, documentosBase)
    const userPrompt = mockChatCompletion.mock.calls[0][0].messages[1].content
    expect(userPrompt).toContain('INSTRUCCIÓN DE ANCLAJE')
  })

  it('marca el prompt como especulativo cuando no hay documentos', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA({}))
    await generarArtefacto('as_is', procesoBase, [])
    const userPrompt = mockChatCompletion.mock.calls[0][0].messages[1].content
    expect(userPrompt).toContain('SIN DOCUMENTOS')
    expect(userPrompt).toContain('ADVERTENCIA: Sin documentos de origen')
  })

  it('para to_be, incluye AS-IS y diagnóstico existentes en el prompt', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA({}))
    await generarArtefacto('to_be', procesoBase, documentosBase, {
      as_is: { paso: 1 },
      diagnostico: { nivel_madurez: 2 },
    })
    const userPrompt = mockChatCompletion.mock.calls[0][0].messages[1].content
    expect(userPrompt).toContain('## AS-IS')
    expect(userPrompt).toContain('"paso": 1')
    expect(userPrompt).toContain('## Diagnóstico')
    expect(userPrompt).toContain('"nivel_madurez": 2')
  })

  it('cierre_ejecutivo no tiene prompt de IA en disco — solo se genera vía TEMPLATES_GARANTIZADOS', async () => {
    // Documenta una restricción real: ORDEN_GENERACION/generarArtefacto solo
    // cubre los 8 tipos con .md en src/lib/prompts/artefactos/. Los demás
    // tipos de TipoArtefacto (cierre_ejecutivo, dashboard_brechas, etc.)
    // dependen enteramente del fallback en artefactos-templates.ts.
    await expect(
      generarArtefacto('cierre_ejecutivo', procesoBase, documentosBase, {
        diagnostico: { nivel_madurez: 3 },
        dashboard_brechas: { indice_brecha_global: 40 },
      })
    ).rejects.toThrow(/no encontrado/)
    expect(mockChatCompletion).not.toHaveBeenCalled()
  })

  it('para un tipo que no requiere artefactos existentes (raci), no agrega esas secciones', async () => {
    mockChatCompletion.mockResolvedValue(respuestaIA({}))
    await generarArtefacto('raci', procesoBase, documentosBase)
    const userPrompt = mockChatCompletion.mock.calls[0][0].messages[1].content
    expect(userPrompt).not.toContain('## AS-IS')
    expect(userPrompt).not.toContain('## Diagnóstico')
  })

  it('lanza si el tipo de artefacto no tiene prompt en disco', async () => {
    await expect(
      // @ts-expect-error tipo inválido a propósito para probar el error
      generarArtefacto('tipo_inexistente', procesoBase, documentosBase)
    ).rejects.toThrow(/no encontrado/)
  })
})
