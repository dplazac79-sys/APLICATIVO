import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DocumentUploader from '@/components/documentos/DocumentUploader'
import DocumentosFiltroWrapper, { type DocRow } from '@/components/documentos/DocumentosFiltroWrapper'
import OrganigramaUploader from '@/components/documentos/OrganigramaUploader'
import { getFasesProyecto } from '@/lib/fases'

export const dynamic = 'force-dynamic'

const ROL_INTERNO = ['super_admin', 'director_proyecto', 'consultor']
const PAGE_SIZE = 25

export default async function DocumentosPage({ searchParams }: { searchParams: { proyecto_id?: string; page?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuario } = await supabase
    .from('usuario')
    .select('rol')
    .eq('id', user!.id)
    .single()

  const rolActual = usuario?.rol ?? 'usuario_cliente'
  const esInterno = ROL_INTERNO.includes(rolActual)

  const admin = createAdminClient()

  // Antes esta consulta traía TODOS los proyectos activos de TODOS los
  // clientes sin filtrar por membresía, y cuando no había ?proyecto_id= en
  // la URL (el caso normal al entrar por el menú lateral) la lista de
  // documentos tampoco se acotaba a ningún proyecto — un sponsor_cliente/
  // usuario_cliente entrando directo a /documentos veía y podía elegir
  // proyectos de otros clientes en los selectores de subida, y la lista de
  // documentos mostrada quedaba sin ningún filtro de tenant.
  let idsProyectosPermitidos: string[] | null = null
  if (!esInterno) {
    const { data: membresias } = await admin
      .from('usuario_proyecto')
      .select('proyecto_id')
      .eq('usuario_id', user!.id)
    idsProyectosPermitidos = (membresias ?? []).map(m => m.proyecto_id)
  }

  let queryProyectos = admin
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')
  if (idsProyectosPermitidos) queryProyectos = queryProyectos.in('id', idsProyectosPermitidos)
  const { data: proyectosRaw } = await queryProyectos

  const proyectos = (proyectosRaw ?? []).map(p => ({
    id: p.id as string,
    nombre: p.nombre as string,
    cliente: Array.isArray(p.cliente) ? (p.cliente[0] ?? null) : p.cliente,
  }))

  // Si no viene proyecto_id en la URL, se usa el único proyecto del usuario
  // (caso normal de sponsor_cliente/usuario_cliente) en vez de dejar la
  // pantalla sin ningún proyecto seleccionado — antes eso dejaba el
  // buscador de IA permanentemente deshabilitado para cualquiera que
  // entrara por el menú lateral en vez de un link con el query param.
  // El ?proyecto_id= de la URL se usaba directo sin validar membresía —
  // un sponsor_cliente/usuario_cliente podía pegar el id de OTRO proyecto
  // en la URL y ver la lista de documentos de ese proyecto ajeno (la
  // consulta usa el cliente admin, que bypasea RLS). Hallazgo de auditoría
  // profunda de frontend: se intersecta contra idsProyectosPermitidos antes
  // de usarlo, igual que ya se hacía para el resto de esta misma función.
  const proyectoFiltroParam = searchParams.proyecto_id ?? null
  const proyectoFiltroValido = proyectoFiltroParam && idsProyectosPermitidos
    ? (idsProyectosPermitidos.includes(proyectoFiltroParam) ? proyectoFiltroParam : null)
    : proyectoFiltroParam
  const proyectoFiltro = proyectoFiltroValido
    ?? (idsProyectosPermitidos?.length === 1 ? idsProyectosPermitidos[0] : null)

  const proyectoActivo = proyectoFiltro ? proyectos.find(p => p.id === proyectoFiltro) : null

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Columnas explícitas — antes era select('*'), que traía embedding_ref
  // (vector de 1024 dimensiones) y analisis_ia (jsonb potencialmente
  // grande) en cada carga de esta lista, sin que ninguno se use acá.
  let query = admin
    .from('documento')
    .select('id, nombre_archivo, tipo, url_storage, estado_procesamiento, clasificacion, resumen_ejecutivo, created_at, proyecto_id, proyecto(nombre), subido_por:subido_por(rol)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (proyectoFiltro) {
    query = query.eq('proyecto_id', proyectoFiltro)
  } else if (idsProyectosPermitidos) {
    // No interno y sin proyecto único ni seleccionado explícitamente (caso
    // con más de un proyecto asignado) — acotar igual a sus proyectos en
    // vez de dejar la consulta sin filtro de tenant.
    query = query.in('proyecto_id', idsProyectosPermitidos.length > 0 ? idsProyectosPermitidos : ['00000000-0000-0000-0000-000000000000'])
  }

  const { data: documentosRaw, count: totalDocumentos } = await query
  const totalPaginas = Math.max(1, Math.ceil((totalDocumentos ?? 0) / PAGE_SIZE))

  function scOrden(nombre: string): number {
    const m = nombre.match(/sc(\d+)/i)
    return m ? parseInt(m[1], 10) : 9999
  }

  const documentosOrdenados = (documentosRaw ?? []).sort((a, b) => {
    const sa = scOrden(a.nombre_archivo)
    const sb = scOrden(b.nombre_archivo)
    if (sa !== sb) return sa - sb
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  // Generar URLs firmadas (1 hora) en un solo round-trip — antes era un
  // Promise.all de hasta 100 llamadas individuales a createSignedUrl (una
  // por documento listado), cada una un request HTTP separado a Storage.
  const { data: signedUrls } = documentosOrdenados.length
    ? await admin.storage.from('documentos').createSignedUrls(
        documentosOrdenados.map(d => d.url_storage), 3600
      )
    : { data: [] }

  // Mapa por path en vez de índice posicional — no depende de que la API
  // preserve el orden del array de entrada.
  const signedUrlPorPath = new Map((signedUrls ?? []).map(s => [s.path, s.signedUrl]))
  const documentos = documentosOrdenados.map(doc => ({
    ...doc,
    signedUrl: signedUrlPorPath.get(doc.url_storage) ?? null,
  }))

  // Próximo paso — solo para roles cliente: esta pantalla es una herramienta
  // (subir/gestionar), no un flujo guiado, así que antes no había ninguna
  // pista de qué hacer después de terminar acá. Se reutiliza el mismo
  // cálculo de fases que ya usa Bienvenida, para no duplicar la lógica de
  // "qué fase sigue" en un segundo lugar con su propio criterio.
  let faseActual: Awaited<ReturnType<typeof getFasesProyecto>>['fases'][number] | null = null
  if (!esInterno && proyectoActivo) {
    const { fases } = await getFasesProyecto(proyectoActivo.id, rolActual)
    // Comparar por href (no por id): getFasesProyecto devuelve una
    // numeración de fases distinta para roles cliente (Centro Documental es
    // id 1 ahí, no 2 como en el modelo interno de 7 fases) — filtrar por un
    // id fijo excluía la fase equivocada y dejaba faseActual siempre null.
    faseActual = fases.find(f => f.status === 'activa' && f.href !== '/documentos') ?? null
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro Documental</h1>
          {proyectoActivo ? (
            <p className="text-slate-400 text-sm mt-1">
              Proyecto: <span className="text-indigo-300 font-medium">{proyectoActivo.nombre}</span>
              {proyectoActivo.cliente?.razon_social && (
                <> · <span className="text-slate-300">{proyectoActivo.cliente.razon_social}</span></>
              )}
            </p>
          ) : (
            <p className="text-slate-400 text-sm mt-1">Repositorio de documentos del proyecto</p>
          )}
        </div>
        {proyectoFiltro && (
          <a href="/documentos" className="text-xs text-slate-400 hover:text-slate-300 transition-colors mt-1">
            Ver todos los proyectos →
          </a>
        )}
      </div>

      {faseActual && (
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/40 via-indigo-800/20 to-slate-900 border border-indigo-500/30 rounded-2xl p-6">
          <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-6 flex-wrap">
            <div className="space-y-1">
              <p className="text-xs text-indigo-300 uppercase tracking-widest font-medium">Qué te toca hacer ahora</p>
              <h3 className="text-white text-lg font-semibold">{faseActual.nombre}</h3>
              <p className="text-slate-400 text-sm max-w-md">{faseActual.descripcion}</p>
            </div>
            <Link
              href={faseActual.href}
              className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold px-6 py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/40 shrink-0"
            >
              Ir a {faseActual.nombre}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      )}

      {(esInterno || rolActual === 'sponsor_cliente') && (
        <DocumentUploader
          proyectos={proyectos}
          proyectoPreseleccionado={proyectoFiltro}
          documentosExistentes={documentos.map(d => ({ id: d.id, nombre_archivo: d.nombre_archivo }))}
        />
      )}

      <OrganigramaUploader
        proyectos={proyectos}
        proyectoPreseleccionado={proyectoFiltro}
      />

      <DocumentosFiltroWrapper
        documentos={documentos as unknown as DocRow[]}
        esInterno={esInterno}
        rolActual={rolActual}
        proyectoId={proyectoFiltro}
      />

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            Página {page} de {totalPaginas} · {totalDocumentos} documento{totalDocumentos !== 1 ? 's' : ''} en total
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <a
                href={`/documentos?${new URLSearchParams({ ...(proyectoFiltro ? { proyecto_id: proyectoFiltro } : {}), page: String(page - 1) }).toString()}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
              >
                ← Anterior
              </a>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">← Anterior</span>
            )}
            {page < totalPaginas ? (
              <a
                href={`/documentos?${new URLSearchParams({ ...(proyectoFiltro ? { proyecto_id: proyectoFiltro } : {}), page: String(page + 1) }).toString()}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
              >
                Siguiente →
              </a>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">Siguiente →</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
