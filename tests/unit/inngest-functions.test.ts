import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import * as inngestFunctions from '../../src/lib/inngest/functions'

// El tipo real de InngestFunction no expone `.handler` (es interno al SDK) —
// vi.mock('@/lib/inngest/client') abajo hace que en runtime SÍ exista, así
// que se castea a `any` solo para el type-checker, sin perder cobertura real.
type TestFn = { handler: (args: { event: { data: unknown }; step: unknown }) => Promise<unknown> }
const procesarDocumento = inngestFunctions.procesarDocumento as unknown as TestFn
const discoveryAI = inngestFunctions.discoveryAI as unknown as TestFn
const enriquecerDocumentoCliente = inngestFunctions.enriquecerDocumentoCliente as unknown as TestFn
const analizarGlosarioRolesJob = inngestFunctions.analizarGlosarioRolesJob as unknown as TestFn

// inngest.createFunction normalmente registra la función contra el runtime real de
// Inngest — para testear la lógica de negocio basta con capturar el handler que se
// le pasa y devolverlo tal cual, invocándolo directamente con {event, step} fake.
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: (config: unknown, handler: unknown) => ({ config, handler }),
  },
}))

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockCreateAdminClient() }))

const mockAnalizarDocumento = vi.fn()
const mockDiscoveryProcesos = vi.fn()
const mockEnriquecerProcesoCliente = vi.fn()
const mockAnalizarGlosarioRoles = vi.fn()
vi.mock('@/lib/ai/claude', () => ({
  analizarDocumento: (...a: unknown[]) => mockAnalizarDocumento(...a),
  discoveryProcesos: (...a: unknown[]) => mockDiscoveryProcesos(...a),
  enriquecerProcesoCliente: (...a: unknown[]) => mockEnriquecerProcesoCliente(...a),
  analizarGlosarioRoles: (...a: unknown[]) => mockAnalizarGlosarioRoles(...a),
}))

const mockBuildProyectoContext = vi.fn()
vi.mock('@/lib/ai/context', () => ({
  buildProyectoContext: (...a: unknown[]) => mockBuildProyectoContext(...a),
}))

const mockGenerarEmbedding = vi.fn()
const mockGenerarEmbeddingsBatch = vi.fn()
vi.mock('@/lib/ai/embeddings', () => ({
  generarEmbedding: (...a: unknown[]) => mockGenerarEmbedding(...a),
  generarEmbeddingsBatch: (...a: unknown[]) => mockGenerarEmbeddingsBatch(...a),
}))

const mockRegistrarAudit = vi.fn()
vi.mock('@/lib/audit', () => ({ registrarAudit: (...a: unknown[]) => mockRegistrarAudit(...a) }))

const mockVerificarLimiteIA = vi.fn()
const mockRegistrarUsoIA = vi.fn()
vi.mock('@/lib/ai/rate-limit', () => ({
  verificarLimiteIA: (...a: unknown[]) => mockVerificarLimiteIA(...a),
  registrarUsoIA: (...a: unknown[]) => mockRegistrarUsoIA(...a),
}))

const mockExtraerTextoPDF = vi.fn()
const mockExtraerTextoDOCX = vi.fn()
vi.mock('@/lib/extract-text', () => ({
  extraerTextoPDF: (...a: unknown[]) => mockExtraerTextoPDF(...a),
  extraerTextoDOCX: (...a: unknown[]) => mockExtraerTextoDOCX(...a),
}))

const step = { run: (_name: string, fn: () => unknown) => Promise.resolve(fn()) }

function conStorage(admin: ReturnType<typeof fakeAdmin>, download: () => unknown) {
  return { ...admin, storage: { from: () => ({ download }) } }
}

describe('procesarDocumento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('procesa un documento .txt de punta a punta y lo marca listo', async () => {
    const updates: unknown[] = []
    const admin = fakeAdmin(table => {
      const q = fakeQuery(
        table === 'documento'
          ? { data: { id: 'd1', proyecto_id: 'proy-1', url_storage: 'd1.txt', nombre_archivo: 'd1.txt' } }
          : { data: null }
      )
      const originalUpdate = q.update as (p: unknown) => unknown
      q.update = vi.fn((p: unknown) => { updates.push(p); return originalUpdate(p) })
      return q
    })
    mockCreateAdminClient.mockReturnValue(
      conStorage(admin, () => ({ data: { arrayBuffer: () => Promise.resolve(Buffer.from('texto plano')), text: () => Promise.resolve('texto plano') } }))
    )
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockAnalizarDocumento.mockResolvedValue({
      clasificacion: { bloque: 'operaciones' },
      analisis: { resumen_ejecutivo: 'resumen', diagnostico_operacional: 'diag', hallazgos_criticos: [] },
    })
    mockGenerarEmbedding.mockResolvedValue([0.1, 0.2])
    mockGenerarEmbeddingsBatch.mockResolvedValue([])

    const res = await procesarDocumento.handler({ event: { data: { documento_id: 'd1', usuario_id: 'u1' } }, step })

    expect(res).toMatchObject({ ok: true })
    expect(updates.some((u: any) => u.estado_procesamiento === 'procesando')).toBe(true)
    expect(updates.some((u: any) => u.estado_procesamiento === 'listo')).toBe(true)
    expect(mockRegistrarAudit).toHaveBeenCalled()
  })

  it('marca el documento como error si el límite de IA fue excedido', async () => {
    const updates: unknown[] = []
    const admin = fakeAdmin(() => {
      const q = fakeQuery({ data: { id: 'd1', proyecto_id: 'proy-1', url_storage: 'd1.txt', nombre_archivo: 'd1.txt' } })
      const originalUpdate = q.update as (p: unknown) => unknown
      q.update = vi.fn((p: unknown) => { updates.push(p); return originalUpdate(p) })
      return q
    })
    mockCreateAdminClient.mockReturnValue(conStorage(admin, () => ({ data: null })))
    mockVerificarLimiteIA.mockResolvedValue({ permitido: false, mensaje: 'Límite mensual excedido' })

    await expect(
      procesarDocumento.handler({ event: { data: { documento_id: 'd1', usuario_id: 'u1' } }, step })
    ).rejects.toThrow('Límite mensual excedido')

    expect(updates.some((u: any) => u.estado_procesamiento === 'error')).toBe(true)
  })

  it('marca error si no se puede extraer texto del documento (vacío)', async () => {
    const updates: unknown[] = []
    const admin = fakeAdmin(() => {
      const q = fakeQuery({ data: { id: 'd1', proyecto_id: 'proy-1', url_storage: 'd1.txt', nombre_archivo: 'd1.txt' } })
      const originalUpdate = q.update as (p: unknown) => unknown
      q.update = vi.fn((p: unknown) => { updates.push(p); return originalUpdate(p) })
      return q
    })
    mockCreateAdminClient.mockReturnValue(
      conStorage(admin, () => ({ data: { arrayBuffer: () => Promise.resolve(Buffer.from('')), text: () => Promise.resolve('   ') } }))
    )
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })

    await expect(
      procesarDocumento.handler({ event: { data: { documento_id: 'd1', usuario_id: 'u1' } }, step })
    ).rejects.toThrow('No se pudo extraer texto')

    expect(updates.some((u: any) => u.estado_procesamiento === 'error')).toBe(true)
  })

  it('usa extraerTextoPDF para archivos .pdf y extraerTextoDOCX para .docx', async () => {
    const admin = fakeAdmin(() => fakeQuery({ data: { id: 'd1', proyecto_id: 'proy-1', url_storage: 'd1.pdf', nombre_archivo: 'd1.pdf' } }))
    mockCreateAdminClient.mockReturnValue(
      conStorage(admin, () => ({ data: { arrayBuffer: () => Promise.resolve(Buffer.from('%PDF')) } }))
    )
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockExtraerTextoPDF.mockResolvedValue('texto del pdf')
    mockAnalizarDocumento.mockResolvedValue({ clasificacion: { bloque: 'x' }, analisis: { resumen_ejecutivo: 'r' } })
    mockGenerarEmbedding.mockResolvedValue(null)
    mockGenerarEmbeddingsBatch.mockResolvedValue(null)

    await procesarDocumento.handler({ event: { data: { documento_id: 'd1', usuario_id: 'u1' } }, step })

    expect(mockExtraerTextoPDF).toHaveBeenCalled()
    expect(mockExtraerTextoDOCX).not.toHaveBeenCalled()
    expect(mockAnalizarDocumento).toHaveBeenCalledWith('texto del pdf')
  })

  it('no bloquea el procesamiento si generarEmbedding falla (degradación silenciosa controlada)', async () => {
    const admin = fakeAdmin(() => fakeQuery({ data: { id: 'd1', proyecto_id: 'proy-1', url_storage: 'd1.txt', nombre_archivo: 'd1.txt' } }))
    mockCreateAdminClient.mockReturnValue(
      conStorage(admin, () => ({ data: { arrayBuffer: () => Promise.resolve(Buffer.from('texto')), text: () => Promise.resolve('texto suficiente') } }))
    )
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockAnalizarDocumento.mockResolvedValue({ clasificacion: { bloque: 'x' }, analisis: { resumen_ejecutivo: 'r' } })
    mockGenerarEmbedding.mockRejectedValue(new Error('Voyage caído'))
    mockGenerarEmbeddingsBatch.mockResolvedValue(null)

    const res = await procesarDocumento.handler({ event: { data: { documento_id: 'd1', usuario_id: 'u1' } }, step })
    expect(res).toMatchObject({ ok: true })
  })
})

describe('discoveryAI', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ejecuta discovery, guarda macroprocesos/procesos y marca el job listo', async () => {
    const admin = fakeAdmin(table => {
      if (table === 'documento') return fakeQuery({ data: [{ id: 'doc1', nombre_archivo: 'SC01.pdf' }] })
      return fakeQuery({ data: null })
    })
    mockCreateAdminClient.mockReturnValue(admin)
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockBuildProyectoContext.mockResolvedValue({ empresa: 'Empresa X', documentos_resumenes: ['resumen'] })
    mockDiscoveryProcesos.mockResolvedValue({
      macroprocesos: [{
        nombre: 'Cadena de Suministro', descripcion: 'd', origen: 'detectado', criticidad: 'alta', estado_actual: 'manual',
        documento_referencia: 'SC01.pdf',
        procesos: [{ nombre: 'Compras', descripcion: 'd', origen: 'detectado', documento_referencia: 'SC01.pdf', roles_involucrados: [], criticidad: 'media' }],
      }],
    })

    const res = await discoveryAI.handler({
      event: { data: { proyecto_id: 'proy-1', usuario_id: 'u1', job_id: 'job-1' } }, step,
    })

    expect(res).toMatchObject({ ok: true, macroprocesos: 1 })
    expect(mockRegistrarAudit).toHaveBeenCalled()
  })

  it('lanza si no hay documentos procesados para discovery', async () => {
    const admin = fakeAdmin(() => fakeQuery({ data: [] }))
    mockCreateAdminClient.mockReturnValue(admin)
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockBuildProyectoContext.mockResolvedValue({ empresa: 'X', documentos_resumenes: [] })

    await expect(
      discoveryAI.handler({ event: { data: { proyecto_id: 'proy-1', usuario_id: 'u1' } }, step })
    ).rejects.toThrow('No hay documentos procesados')
  })

  it('marca el job como error si la llamada IA falla, y relanza', async () => {
    const jobUpdates: unknown[] = []
    const admin = fakeAdmin(table => {
      if (table === 'documento') return fakeQuery({ data: [{ id: 'doc1', nombre_archivo: 'SC01.pdf' }] })
      const q = fakeQuery({ data: null })
      if (table === 'jobs') {
        const originalUpdate = q.update as (p: unknown) => unknown
        q.update = vi.fn((p: unknown) => { jobUpdates.push(p); return originalUpdate(p) })
      }
      return q
    })
    mockCreateAdminClient.mockReturnValue(admin)
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockBuildProyectoContext.mockResolvedValue({ empresa: 'X', documentos_resumenes: ['r'] })
    mockDiscoveryProcesos.mockRejectedValue(new Error('modelo caído'))

    await expect(
      discoveryAI.handler({ event: { data: { proyecto_id: 'proy-1', usuario_id: 'u1', job_id: 'job-1' } }, step })
    ).rejects.toThrow('modelo caído')

    expect(jobUpdates.some((u: any) => u.estado === 'error')).toBe(true)
  })

  it('no falla si no se provee job_id (marcarError es un no-op)', async () => {
    const admin = fakeAdmin(() => fakeQuery({ data: [] }))
    mockCreateAdminClient.mockReturnValue(admin)
    mockVerificarLimiteIA.mockResolvedValue({ permitido: true })
    mockBuildProyectoContext.mockResolvedValue({ empresa: 'X', documentos_resumenes: [] })

    await expect(
      discoveryAI.handler({ event: { data: { proyecto_id: 'proy-1', usuario_id: 'u1' } }, step })
    ).rejects.toThrow()
  })
})

describe('enriquecerDocumentoCliente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enriquece un documento de cliente y calcula numero_en_macroproceso desde BD', async () => {
    const inserts: unknown[] = []
    const admin = fakeAdmin(table => {
      if (table === 'documento_cliente') return fakeQuery({ data: { url_storage: 'x.txt', nombre_archivo: 'x.txt' } })
      if (table === 'proyecto') return fakeQuery({ data: { nombre: 'P', alcance: 'A', cliente: { razon_social: 'Cliente', industria: 'Salud' } } })
      if (table === 'proceso_enriquecido') {
        const q = fakeQuery({ count: 2 })
        const originalInsert = q.insert as (p: unknown) => unknown
        q.insert = vi.fn((p: unknown) => { inserts.push(p); return originalInsert(p) })
        return q
      }
      return fakeQuery({ data: [] })
    })
    mockCreateAdminClient.mockReturnValue(
      conStorage(admin, () => ({ data: { arrayBuffer: () => Promise.resolve(Buffer.from('texto')), text: () => Promise.resolve('texto suficiente') } }))
    )
    mockEnriquecerProcesoCliente.mockResolvedValue({
      nombre_proceso: 'Recepción de mercadería', macroproceso: 'Logística',
      descripcion: 'd', sin_proceso_riesgos: [], con_proceso_beneficios: [], valor_negocio: '',
      actores: [], sistemas: [], kpis: [], riesgos: [],
    })

    const res = await enriquecerDocumentoCliente.handler({
      event: { data: { documento_cliente_id: 'dc1', proyecto_id: 'proy-1', usuario_id: 'u1' } }, step,
    })

    expect(res).toMatchObject({ ok: true, proceso: 'Recepción de mercadería' })
    expect((inserts[0] as any).numero_en_macroproceso).toBe(3) // count 2 + 1
  })

  it('marca error si no hay texto extraíble del documento del cliente', async () => {
    const updates: unknown[] = []
    const admin = fakeAdmin(table => {
      const q = fakeQuery(table === 'documento_cliente' ? { data: { url_storage: 'x.txt', nombre_archivo: 'x.txt' } } : { data: null })
      if (table === 'documento_cliente') {
        const originalUpdate = q.update as (p: unknown) => unknown
        q.update = vi.fn((p: unknown) => { updates.push(p); return originalUpdate(p) })
      }
      return q
    })
    mockCreateAdminClient.mockReturnValue(conStorage(admin, () => ({ data: { arrayBuffer: () => Promise.resolve(Buffer.from('')), text: () => Promise.resolve('') } })))

    await expect(
      enriquecerDocumentoCliente.handler({ event: { data: { documento_cliente_id: 'dc1', proyecto_id: 'proy-1', usuario_id: 'u1' } }, step })
    ).rejects.toThrow('Sin texto extraíble')

    expect(updates.some((u: any) => u.estado === 'error')).toBe(true)
  })
})

describe('analizarGlosarioRolesJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('analiza el glosario de roles y guarda los totales por tipo de mapeo', async () => {
    const updates: unknown[] = []
    const admin = fakeAdmin(table => {
      const responses: Record<string, unknown> = {
        glosario_roles_analisis: { data: { organigrama_id: 'org1', roles_en_procesos: [] } },
        organigrama_cliente: { data: { texto_extraido: 'organigrama' } },
        cv_persona_org: { data: [] },
        proyecto: { data: { nombre: 'P', cliente: { razon_social: 'C', industria: 'Salud' } } },
      }
      const q = fakeQuery(responses[table] ?? { data: null })
      if (table === 'glosario_roles_analisis') {
        const originalUpdate = q.update as (p: unknown) => unknown
        q.update = vi.fn((p: unknown) => { updates.push(p); return originalUpdate(p) })
      }
      return q
    })
    mockCreateAdminClient.mockReturnValue(admin)
    mockAnalizarGlosarioRoles.mockResolvedValue({
      mapeos: [
        { tipo: 'mapeo_directo' }, { tipo: 'mapeo_directo' },
        { tipo: 'equivalencia' },
        { tipo: 'crear_cargo' },
      ],
      resumen_ejecutivo: 'resumen', score_cobertura_organizacional: 80,
      alertas_criticas: [], plan_accion_30_dias: [],
    })

    const res = await analizarGlosarioRolesJob.handler({
      event: { data: { analisis_id: 'an1', proyecto_id: 'proy-1' } }, step,
    })

    expect(res).toMatchObject({ analisis_id: 'an1', total: 4 })
    const finalUpdate = updates[updates.length - 1] as any
    expect(finalUpdate.estado).toBe('completado')
    expect(finalUpdate.total_mapeados).toBe(2)
    expect(finalUpdate.total_equivalencias).toBe(1)
    expect(finalUpdate.total_crear_cargo).toBe(1)
  })

  it('marca error y relanza si el análisis IA falla', async () => {
    const updates: unknown[] = []
    const admin = fakeAdmin(table => {
      const q = fakeQuery({ data: null })
      if (table === 'glosario_roles_analisis') {
        const originalUpdate = q.update as (p: unknown) => unknown
        q.update = vi.fn((p: unknown) => { updates.push(p); return originalUpdate(p) })
      }
      return q
    })
    mockCreateAdminClient.mockReturnValue(admin)
    mockAnalizarGlosarioRoles.mockRejectedValue(new Error('IA no disponible'))

    await expect(
      analizarGlosarioRolesJob.handler({ event: { data: { analisis_id: 'an1', proyecto_id: 'proy-1' } }, step })
    ).rejects.toThrow('IA no disponible')

    expect(updates.some((u: any) => u.estado === 'error')).toBe(true)
  })

  it('cliente como array (join de Supabase) se normaliza a objeto único', async () => {
    const admin = fakeAdmin(table => {
      const responses: Record<string, unknown> = {
        glosario_roles_analisis: { data: { organigrama_id: 'org1', roles_en_procesos: [] } },
        organigrama_cliente: { data: { texto_extraido: '' } },
        cv_persona_org: { data: [] },
        proyecto: { data: { nombre: 'P', cliente: [{ razon_social: 'ClienteArray', industria: 'Retail' }] } },
      }
      return fakeQuery(responses[table] ?? { data: null })
    })
    mockCreateAdminClient.mockReturnValue(admin)
    mockAnalizarGlosarioRoles.mockResolvedValue({ mapeos: [] })

    await analizarGlosarioRolesJob.handler({ event: { data: { analisis_id: 'an1', proyecto_id: 'proy-1' } }, step })

    expect(mockAnalizarGlosarioRoles).toHaveBeenCalledWith(
      expect.objectContaining({ nombreEmpresa: 'ClienteArray', industria: 'Retail' })
    )
  })
})
