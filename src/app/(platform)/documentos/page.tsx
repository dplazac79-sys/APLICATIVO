import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DocumentUploader from '@/components/documentos/DocumentUploader'
import DocumentosFiltroWrapper from '@/components/documentos/DocumentosFiltroWrapper'
import OrganigramaUploader from '@/components/documentos/OrganigramaUploader'

export const dynamic = 'force-dynamic'

const ROL_INTERNO = ['super_admin', 'director_proyecto', 'consultor']

export default async function DocumentosPage({ searchParams }: { searchParams: { proyecto_id?: string } }) {
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
  const proyectoFiltro = searchParams.proyecto_id ?? null

  const { data: proyectosRaw } = await admin
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')

  const proyectos = (proyectosRaw ?? []).map(p => ({
    id: p.id as string,
    nombre: p.nombre as string,
    cliente: Array.isArray(p.cliente) ? (p.cliente[0] ?? null) : p.cliente,
  }))

  const proyectoActivo = proyectoFiltro ? proyectos.find(p => p.id === proyectoFiltro) : null

  // Columnas explícitas — antes era select('*'), que traía embedding_ref
  // (vector de 1024 dimensiones) y analisis_ia (jsonb potencialmente
  // grande) en cada carga de esta lista, sin que ninguno se use acá.
  let query = admin
    .from('documento')
    .select('id, nombre_archivo, tipo, url_storage, estado_procesamiento, clasificacion, resumen_ejecutivo, created_at, proyecto_id, proyecto(nombre), subido_por:subido_por(rol)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (proyectoFiltro) query = query.eq('proyecto_id', proyectoFiltro)

  const { data: documentosRaw } = await query

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro Documental</h1>
          {proyectoActivo ? (
            <p className="text-slate-400 text-sm mt-1">
              Proyecto: <span className="text-indigo-300 font-medium">{proyectoActivo.nombre}</span>
              {(proyectoActivo.cliente as any)?.razon_social && (
                <> · <span className="text-slate-300">{(proyectoActivo.cliente as any).razon_social}</span></>
              )}
            </p>
          ) : (
            <p className="text-slate-400 text-sm mt-1">Repositorio de documentos del proyecto</p>
          )}
        </div>
        {proyectoFiltro && (
          <a href="/documentos" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1">
            Ver todos los proyectos →
          </a>
        )}
      </div>

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
        documentos={documentos as any}
        esInterno={esInterno}
        rolActual={rolActual}
      />
    </div>
  )
}
