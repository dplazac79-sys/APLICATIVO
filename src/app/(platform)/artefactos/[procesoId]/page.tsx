import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Layers, FileText, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Artefacto } from '@/types/database'
import ArtefactoGenerador from '@/components/artefactos/ArtefactoGenerador'
import ArtefactoValidador from '@/components/artefactos/ArtefactoValidador'
import VistaArtefacto from '@/components/artefactos/VistaArtefacto'
import { LABEL_ARTEFACTO, ORDEN_GENERACION } from '@/lib/artefactos-meta'

export const dynamic = 'force-dynamic'

interface Props { params: { procesoId: string } }

export default async function ProcesoArtefactosPage({ params }: Props) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto(nombre, cliente(razon_social))')
    .eq('id', params.procesoId)
    .single()

  if (!proceso) notFound()

  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('*')
    .eq('proceso_id', params.procesoId)

  const artefactos = (artefactosRaw ?? []) as Artefacto[]
  const artefactosPorTipo = artefactos.reduce((acc, a) => {
    acc[a.tipo] = a
    return acc
  }, {} as Record<string, Artefacto>)

  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown>
  const totalGenerados = artefactos.length
  const totalPublicados = artefactos.filter(a => a.estado_validacion === 'publicado').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/artefactos"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Process Architect
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            {proceso.nombre}
          </h1>
          <p className="text-slate-400 text-sm">
            {String(proyecto?.nombre ?? '')} · {String(cliente?.razon_social ?? '')}
            <span className="ml-2 text-slate-600">Nivel {proceso.nivel} · {proceso.origen}</span>
          </p>
        </div>
        <ArtefactoGenerador
          procesoId={params.procesoId}
          tieneArtefactos={totalGenerados > 0}
        />
      </div>

      {/* Stats */}
      {totalGenerados > 0 && (
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-400">{totalGenerados}/12 artefactos generados</span>
          <span className="text-blue-400">{totalPublicados} publicados</span>
          <span className="text-amber-400">{artefactos.filter(a => a.estado_validacion === 'pendiente').length} pendientes revisión</span>
        </div>
      )}

      {/* Sin artefactos */}
      {totalGenerados === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-slate-300 font-medium">Sin artefactos generados</p>
            <p className="text-slate-500 text-sm">
              Haz clic en &quot;Generar todos los artefactos&quot; para iniciar la generación con IA.
              El proceso toma aproximadamente 5 minutos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Artefactos en orden metodológico */}
      {ORDEN_GENERACION.map(tipo => {
        const art = artefactosPorTipo[tipo]
        return (
          <Card key={tipo} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  {LABEL_ARTEFACTO[tipo]}
                  {art && (
                    <span className="text-slate-600 text-xs font-normal">v{art.version}</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {art ? (
                    <>
                      <ArtefactoValidador artefactoId={art.id} estadoActual={art.estado_validacion} />
                      <ArtefactoGenerador
                        procesoId={params.procesoId}
                        tipo={tipo}
                        tieneArtefactos={true}
                      />
                    </>
                  ) : (
                    <ArtefactoGenerador
                      procesoId={params.procesoId}
                      tipo={tipo}
                      tieneArtefactos={false}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            {art && (
              <CardContent className="pt-0">
                <VistaArtefacto artefacto={art} />
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
