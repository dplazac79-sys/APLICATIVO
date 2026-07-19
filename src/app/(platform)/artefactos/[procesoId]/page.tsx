import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Layers, ChevronLeft, Printer, FileCheck2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Artefacto } from '@/types/database'
import ArtefactoCardEditor from '@/components/artefactos/ArtefactoCardEditor'
import ComparacionAsIsToBe from '@/components/artefactos/ComparacionAsIsToBe'
import ImportadorArtefactos from '@/components/artefactos/ImportadorArtefactos'
import BotonReextraer from '@/components/artefactos/BotonReextraer'
import ValidarTodosButton from '@/components/artefactos/ValidarTodosButton'
import { ORDEN_GENERACION, LABEL_ARTEFACTO } from '@/lib/artefactos-meta'
import { ROLES_EDITAN_ARTEFACTO } from '@/lib/artefactos-estado'
import { getFasesProyecto } from '@/lib/fases'

export const dynamic = 'force-dynamic'

const ROL_INTERNO = ['super_admin', 'director_proyecto', 'consultor']

interface Props { params: { procesoId: string } }

export default async function ProcesoArtefactosPage({ params }: Props) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto(nombre, cliente(razon_social)), documento_origen:documento_origen_id(nombre_archivo)')
    .eq('id', params.procesoId)
    .single()

  if (!proceso) notFound()

  // Obtener rol del usuario actual (necesario para restricciones y para pasar al componente)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuarioData } = await admin.from('usuario').select('rol').eq('id', user?.id ?? '').single()
  const rolUsuario = usuarioData?.rol ?? 'usuario_cliente'

  // Bloquear acceso a macroprocesos para roles que no sean super_admin
  const esMacroproceso = proceso.tipo === 'macroproceso' || proceso.nivel === 0
  if (esMacroproceso && rolUsuario !== 'super_admin') redirect('/artefactos')

  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('*')
    .eq('proceso_id', params.procesoId)
    .order('tipo')

  const artefactos = (artefactosRaw ?? []) as Artefacto[]
  const artefactosPorTipo = artefactos.reduce((acc, a) => {
    acc[a.tipo] = a
    return acc
  }, {} as Record<string, Artefacto>)

  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown>
  const docNombre = (proceso.documento_origen as { nombre_archivo?: string } | null)?.nombre_archivo
  const codigoMatch = docNombre?.match(/^([A-Za-z]{1,6}[0-9]{1,3})/i)
  const codigo = codigoMatch ? codigoMatch[1].toUpperCase() : null
  const totalGenerados = artefactos.length
  const totalPublicados = artefactos.filter(a => a.estado_validacion === 'publicado').length
  const totalValidados = artefactos.filter(a => a.estado_validacion === 'validado').length
  const totalPendientes = artefactos.filter(a => a.estado_validacion === 'pendiente').length

  const sinArtefactos = totalGenerados === 0

  // Próximo paso — solo para roles cliente, y solo cuando este proceso ya
  // no tiene nada pendiente de revisar (los 8 artefactos generados y
  // ninguno en estado "pendiente"). Mismo patrón que en el resto de la
  // plataforma: sin esto, el cliente terminaba de revisar y no sabía que
  // ya había terminado ni hacia dónde seguir.
  let faseActual: Awaited<ReturnType<typeof getFasesProyecto>>['fases'][number] | null = null
  if (!ROL_INTERNO.includes(rolUsuario) && totalGenerados >= ORDEN_GENERACION.length && totalPendientes === 0) {
    const { fases } = await getFasesProyecto(proceso.proyecto_id as string, rolUsuario)
    faseActual = fases.find(f => f.status === 'activa' && f.href !== '/artefactos') ?? null
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <Link
            href="/artefactos"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-300 text-xs transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Process Architect
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 truncate">
            <Layers className="w-5 h-5 text-purple-400 shrink-0" />
            {codigo && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-blue-950/50 border-blue-800/50 text-blue-400 shrink-0">
                {codigo}
              </span>
            )}
            {proceso.nombre}
          </h1>
          <p className="text-slate-400 text-sm">
            {String(proyecto?.nombre ?? '')}
            <span className="text-slate-400"> · {String(cliente?.razon_social ?? '')}</span>
          </p>
        </div>
        {totalPublicados > 0 && (
          <Link
            href={`/artefactos/${params.procesoId}/print`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Exportar PDF
          </Link>
        )}
      </div>

      {/* ── Resumen de los 8 en un vistazo — evita tener que scrollear toda
          la página para saber qué falta; cada pill salta directo a su card. ── */}
      {!sinArtefactos && (
        <div className="flex flex-wrap gap-1.5">
          {ORDEN_GENERACION.map(tipo => {
            const art = artefactosPorTipo[tipo]
            const estado = art?.estado_validacion as 'pendiente' | 'validado' | 'publicado' | undefined
            const style = !art
              ? 'bg-slate-900 border-slate-800 text-slate-400'
              : estado === 'publicado'
                ? 'bg-blue-950/40 border-blue-800/40 text-blue-400'
                : estado === 'validado'
                  ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-800/40 text-amber-400'
            return (
              <a
                key={tipo}
                href={art ? `#artefacto-${tipo}` : undefined}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${style} ${art ? 'hover:opacity-80' : 'cursor-default opacity-60'}`}
              >
                {LABEL_ARTEFACTO[tipo]}
              </a>
            )
          })}
        </div>
      )}

      {/* ── Progress bar ── */}
      {!sinArtefactos && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 text-sm font-medium">Progreso de revisión</span>
            </div>
            <span className="text-slate-400 text-xs">
              {totalGenerados}/{ORDEN_GENERACION.length} artefactos
            </span>
          </div>
          {totalPendientes > 1 && ROLES_EDITAN_ARTEFACTO.includes(rolUsuario) && (
            <div className="flex justify-end mb-2">
              <ValidarTodosButton procesoId={params.procesoId} totalPendientes={totalPendientes} />
            </div>
          )}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex gap-px">
            <div
              className="bg-blue-500 h-full rounded-l-full transition-all"
              style={{ width: `${(totalPublicados / ORDEN_GENERACION.length) * 100}%` }}
            />
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${(totalValidados / ORDEN_GENERACION.length) * 100}%` }}
            />
            <div
              className="bg-amber-600 h-full transition-all"
              style={{ width: `${(totalPendientes / ORDEN_GENERACION.length) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            {totalPublicados > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" />{totalPublicados} publicados</span>}
            {totalValidados > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" />{totalValidados} validados</span>}
            {totalPendientes > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-600 rounded-full" />{totalPendientes} pendientes revisión</span>}
          </div>
        </div>
      )}

      {/* ── Auto-importar si no hay artefactos ── */}
      {sinArtefactos && (
        <ImportadorArtefactos
          procesoId={params.procesoId}
          procesoNombre={proceso.nombre}
        />
      )}

      {/* ── Botón re-extraer (siempre visible cuando hay artefactos) ── */}
      {!sinArtefactos && (
        <BotonReextraer
          procesoId={params.procesoId}
          procesoNombre={proceso.nombre}
          totalActual={totalGenerados}
          totalEsperado={ORDEN_GENERACION.length}
        />
      )}

      {/* ── Artefactos en orden metodológico (numerados 1-18) ── */}
      {!sinArtefactos && ORDEN_GENERACION.map((tipo, idx) => {
        const art = artefactosPorTipo[tipo]
        if (!art) return null
        return (
          <div key={tipo} id={`artefacto-${tipo}`} className="scroll-mt-4 space-y-3">
            <ArtefactoCardEditor artefacto={art} procesoId={params.procesoId} numero={idx + 1} rol={rolUsuario} />
            {/* AS-IS y TO-BE son los dos artefactos pensados para
                contrastarse, pero quedan en extremos opuestos del listado
                (posiciones 2 y 8) — la comparación va justo después del
                AS-IS, cuando ambos ya existen, para no obligar a scrollear
                entre uno y otro para verlos juntos. */}
            {tipo === 'as_is' && artefactosPorTipo.to_be && (
              <ComparacionAsIsToBe
                contenidoAsIs={art.contenido as Record<string, unknown>}
                contenidoToBe={artefactosPorTipo.to_be.contenido as Record<string, unknown>}
              />
            )}
          </div>
        )
      })}

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
    </div>
  )
}
