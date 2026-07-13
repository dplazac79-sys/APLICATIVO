import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { buildProcesoContext, buildProyectoContext } from '../../src/lib/ai/context'

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockCreateAdminClient() }))

const resumenDocCompleto = {
  resumen_ejecutivo: 'La empresa opera con procesos manuales.',
  diagnostico_operacional: 'Alta variabilidad en tiempos de ciclo.',
  hallazgos_criticos: ['Sin trazabilidad', 'Duplicidad de tareas'],
  riesgos_criticos: [{ riesgo: 'Fraude interno', impacto: 'alto', evidencia: 'ev1' }],
  oportunidades_valor: [{ oportunidad: 'Automatizar validación', impacto_estimado: 'alto', complejidad_implementacion: 'media' }],
  quick_wins: ['Digitalizar formulario'],
  nivel_madurez_amo: 2,
  nivel_madurez_nombre: 'Definido',
  nivel_madurez_evidencia: 'ev2',
  recomendacion_ejecutiva: 'Priorizar digitalización',
}

describe('buildProcesoContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lanza si el proceso no existe', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: null })))
    await expect(buildProcesoContext('p-inexistente')).rejects.toThrow(/no encontrado/)
  })

  it('construye el contexto completo con cliente, proyecto y análisis IA', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proceso') {
          return fakeQuery({
            data: {
              id: 'p1',
              proyecto_id: 'proy-1',
              nombre: 'Aprobación de crédito',
              descripcion: 'desc',
              nivel: 1,
              origen: 'detectado',
              roles_involucrados: ['Analista'],
              riesgos_detectados: ['Fraude'],
              metadata_ia: { criticidad: 'alta' },
              proyecto: {
                nombre: 'Transformación Banca',
                alcance: 'Alcance completo del área',
                cliente: { razon_social: 'Banco Andes', industria: 'Banca', tamano: 'grande', objetivos_estrategicos: 'Crecer 20%' },
              },
              documento_origen: {
                nombre_archivo: 'manual.pdf',
                resumen_ejecutivo: 'resumen plano',
                analisis_ia: { analisis: resumenDocCompleto },
                clasificacion: null,
              },
            },
          })
        }
        // otros documentos del proyecto
        return fakeQuery({ data: [{ nombre_archivo: 'otro.pdf', resumen_ejecutivo: 'otro resumen', clasificacion: null }] })
      })
    )

    const ctx = await buildProcesoContext('p1')

    expect(ctx.proceso.nombre).toBe('Aprobación de crédito')
    expect(ctx.proceso.cliente_razon_social).toBe('Banco Andes')
    expect(ctx.proceso.proyecto_nombre).toBe('Transformación Banca')
    expect(ctx.documentos).toHaveLength(1)
    expect(ctx.proyecto_contexto).toContain('Banco Andes')
    expect(ctx.proyecto_contexto).toContain('Transformación Banca')
    expect(ctx.proceso_contexto).toContain('Criticidad: alta')
    // Usa el analisis_ia estructurado en vez de reenviar el resumen plano
    expect(ctx.proceso_contexto).toContain('Diagnóstico: La empresa opera con procesos manuales.')
    expect(ctx.proceso_contexto).toContain('Hallazgos críticos:')
    expect(ctx.proceso_contexto).toContain('Sin trazabilidad')
    expect(ctx.proceso_contexto).toContain('Riesgos:')
    expect(ctx.proceso_contexto).toContain('[ALTO] Fraude interno')
    expect(ctx.proceso_contexto).toContain('Quick wins:')
    expect(ctx.proceso_contexto).toContain('Recomendación ejecutiva: Priorizar digitalización')
  })

  it('usa el resumen_ejecutivo plano cuando no hay analisis_ia estructurado', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proceso') {
          return fakeQuery({
            data: {
              id: 'p1', proyecto_id: 'proy-1', nombre: 'Proceso X', descripcion: null,
              nivel: 1, origen: 'manual', roles_involucrados: null, riesgos_detectados: null,
              metadata_ia: null,
              proyecto: { nombre: 'P', alcance: null, cliente: null },
              documento_origen: { nombre_archivo: 'doc.pdf', resumen_ejecutivo: 'resumen ejecutivo plano', analisis_ia: null, clasificacion: null },
            },
          })
        }
        return fakeQuery({ data: [] })
      })
    )
    const ctx = await buildProcesoContext('p1')
    expect(ctx.proceso_contexto).toContain('resumen ejecutivo plano')
    expect(ctx.proceso.cliente_razon_social).toBe('N/A')
  })

  it('maneja proceso sin documento_origen (N/A en todos los campos derivados)', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proceso') {
          return fakeQuery({
            data: {
              id: 'p1', proyecto_id: 'proy-1', nombre: 'Proceso Y', descripcion: null,
              nivel: 1, origen: 'manual', roles_involucrados: null, riesgos_detectados: null,
              metadata_ia: null, proyecto: null, documento_origen: null,
            },
          })
        }
        return fakeQuery({ data: [] })
      })
    )
    const ctx = await buildProcesoContext('p1')
    expect(ctx.analisis_ia).toBeNull()
    expect(ctx.documentos).toEqual([])
  })
})

describe('buildProyectoContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('construye resúmenes de documentos priorizando analisis_ia sobre resumen_ejecutivo', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proyecto') {
          return fakeQuery({
            data: { nombre: 'P', alcance: 'Alcance', cliente: { razon_social: 'Cliente X', industria: 'Salud', tamano: 'mediana', objetivos_estrategicos: 'Objetivo' } },
          })
        }
        return fakeQuery({
          data: [
            { nombre_archivo: 'a.pdf', resumen_ejecutivo: 'plano', analisis_ia: { analisis: { resumen_ejecutivo: 'del analisis_ia' } }, clasificacion: { tipo_documento: 'manual' } },
            { nombre_archivo: 'b.pdf', resumen_ejecutivo: 'solo plano', analisis_ia: null, clasificacion: null },
          ],
        })
      })
    )

    const { empresa, documentos_resumenes } = await buildProyectoContext('proy-1')

    expect(empresa).toContain('Cliente X')
    expect(empresa).toContain('Salud')
    expect(documentos_resumenes).toHaveLength(2)
    expect(documentos_resumenes[0]).toContain('del analisis_ia')
    expect(documentos_resumenes[0]).toContain('manual')
    expect(documentos_resumenes[1]).toContain('solo plano')
  })

  it('filtra por documentoIds cuando se proveen', async () => {
    const inSpy = vi.fn()
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proyecto') return fakeQuery({ data: { nombre: 'P', alcance: '', cliente: null } })
        const q = fakeQuery({ data: [] })
        q.in = vi.fn((...args: unknown[]) => { inSpy(...args); return q })
        return q
      })
    )
    await buildProyectoContext('proy-1', ['d1', 'd2'])
    expect(inSpy).toHaveBeenCalledWith('id', ['d1', 'd2'])
  })

  it('no filtra por id cuando documentoIds está vacío o no se provee', async () => {
    const inSpy = vi.fn()
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proyecto') return fakeQuery({ data: { nombre: 'P', alcance: '', cliente: null } })
        const q = fakeQuery({ data: [] })
        q.in = vi.fn((...args: unknown[]) => { inSpy(...args); return q })
        return q
      })
    )
    await buildProyectoContext('proy-1', [])
    expect(inSpy).not.toHaveBeenCalled()
  })
})
