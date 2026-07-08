import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Layers, ChevronLeft, Printer, FileCheck2, Lock } from 'lucide-react'
import Link from 'next/link'
import type { Artefacto } from '@/types/database'
import ArtefactoCardEditor from '@/components/artefactos/ArtefactoCardEditor'
import ImportadorArtefactos from '@/components/artefactos/ImportadorArtefactos'
import BotonReextraer from '@/components/artefactos/BotonReextraer'
import { ORDEN_GENERACION, LABEL_ARTEFACTO } from '@/lib/artefactos-meta'

export const dynamic = 'force-dynamic'

interface Props { params: { procesoId: string } }

export default async function ProcesoArtefactosPage({ params }: Props) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto(nombre, cliente(razon_social)), documento_origen:documento_origen_id(nombre_archivo)')
    .eq('id', params.procesoId)
    .single()

  if (!proceso) notFound()

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
  const docNombre = (proceso.documento_origen as any)?.nombre_archivo as string | undefined
  const codigoMatch = docNombre?.match(/^([A-Za-z]{1,6}[0-9]{1,3})/i)
  const codigo = codigoMatch ? codigoMatch[1].toUpperCase() : null
  const totalGenerados = artefactos.length
  const totalPublicados = artefactos.filter(a => a.estado_validacion === 'publicado').length
  const totalValidados = artefactos.filter(a => a.estado_validacion === 'validado').length
  const totalPendientes = artefactos.filter(a => a.estado_validacion === 'pendiente').length

  const sinArtefactos = totalGenerados === 0

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <Link
            href="/artefactos"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors"
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
            <span className="text-slate-600"> · {String(cliente?.razon_social ?? '')}</span>
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
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
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

      {/* ── Artefactos en orden metodológico (18 slots — solo cuando ya hay artefactos) ── */}
      {!sinArtefactos && ORDEN_GENERACION.map((tipo, idx) => {
        const art = artefactosPorTipo[tipo]
        const numero = idx + 1
        if (art) {
          return (
            <ArtefactoCardEditor key={tipo} artefacto={art} procesoId={params.procesoId} numero={numero} />
          )
        }
        // Placeholder para artefactos no extraídos
        return (
          <div key={tipo} className="bg-slate-900/50 border border-slate-800/60 border-dashed rounded-2xl px-4 py-3 flex items-center gap-3 opacity-60">
            <Lock className="w-4 h-4 text-slate-600 shrink-0" />
            <span className="text-xs font-mono font-bold text-slate-600 shrink-0 w-5 text-right">{numero}.</span>
            <span className="text-slate-500 text-sm">{LABEL_ARTEFACTO[tipo]}</span>
            <span className="ml-auto text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">Requiere co-construcción</span>
          </div>
        )
      })}
    </div>
  )
}
