import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Layers, ChevronRight, FileText, CheckCircle, Globe, Clock,
  AlertTriangle, Brain
} from 'lucide-react'
import Link from 'next/link'
import type { Proceso, Artefacto } from '@/types/database'
import { LABEL_ARTEFACTO, ORDEN_GENERACION } from '@/lib/artefactos-meta'

export const dynamic = 'force-dynamic'

const NIVEL_CONFIG = [
  { label: 'Macroproceso', color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/50' },
  { label: 'Proceso',      color: 'text-blue-400',   bg: 'bg-blue-950/40 border-blue-800/50' },
  { label: 'Subproceso',   color: 'text-cyan-400',   bg: 'bg-cyan-950/40 border-cyan-800/50' },
  { label: 'Actividad',    color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/50' },
  { label: 'Tarea',        color: 'text-slate-400',   bg: 'bg-slate-800/40 border-slate-700/50' },
]

const ESTADO_ICON = {
  pendiente: <Clock className="w-3 h-3 text-amber-400" />,
  validado:  <CheckCircle className="w-3 h-3 text-emerald-400" />,
  publicado: <Globe className="w-3 h-3 text-blue-400" />,
}

export default async function ArtefactosPage() {
  const admin = createAdminClient()

  const { data: proyectos } = await admin
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')

  // Cargar todos los procesos del proyecto — el macroproceso puede estar en 'propuesto'
  // pero sus hijos en 'aceptado'; necesitamos todo el árbol para renderizarlo correctamente
  const { data: procesosRaw } = await admin
    .from('proceso')
    .select('*')
    .order('nivel')
    .order('orden')

  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('proceso_id, tipo, estado_validacion')

  const procesos = (procesosRaw ?? []) as Proceso[]
  const artefactos = (artefactosRaw ?? []) as Pick<Artefacto, 'proceso_id' | 'tipo' | 'estado_validacion'>[]

  // Agrupar artefactos por proceso
  const artefactosPorProceso = artefactos.reduce((acc, a) => {
    if (!acc[a.proceso_id]) acc[a.proceso_id] = []
    acc[a.proceso_id].push(a)
    return acc
  }, {} as Record<string, typeof artefactos>)

  // Árbol de procesos por proyecto
  const procesosPorProyecto = (proyectos ?? []).map(p => ({
    ...p,
    procesos: procesos.filter(pr => pr.proyecto_id === p.id),
  }))

  function renderArbol(lista: Proceso[], padreId: string | null, nivel: number): React.ReactNode {
    const hijos = lista.filter(p => p.padre_id === padreId)
    if (!hijos.length) return null
    return hijos.map(p => {
      const cfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG[4]
      const arts = artefactosPorProceso[p.id] ?? []
      const total = ORDEN_GENERACION.length
      const generados = arts.length
      const publicados = arts.filter(a => a.estado_validacion === 'publicado').length
      const hayIncompletos = generados < total

      return (
        <div key={p.id} style={{ marginLeft: `${Math.min(nivel * 12, 48)}px` }}>
          <Link href={`/artefactos/${p.id}`} className="block">
            <div className={`flex items-center justify-between rounded-lg border px-3 py-2 mb-1.5 hover:opacity-80 transition-opacity cursor-pointer ${cfg.bg}`}>
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                <span className="text-slate-200 text-sm font-medium truncate">{p.nombre}</span>
                <span className={`text-xs ${cfg.color} shrink-0`}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {hayIncompletos && generados === 0 && (
                  <span className="text-xs text-slate-500">Sin artefactos</span>
                )}
                {generados > 0 && (
                  <span className="text-xs text-slate-400">{generados}/{total} generados</span>
                )}
                {publicados > 0 && (
                  <span className="flex items-center gap-1 text-xs text-blue-400">
                    <Globe className="w-3 h-3" />{publicados} publicados
                  </span>
                )}
                {hayIncompletos && generados > 0 && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
            </div>
          </Link>
          {renderArbol(lista, p.id, nivel + 1)}
        </div>
      )
    })
  }

  const totalProcesosAceptados = procesos.filter(p => p.estado_oferta === 'aceptado').length
  const totalArtefactos = artefactos.length
  const totalPublicados = artefactos.filter(a => a.estado_validacion === 'publicado').length
  const cobertura = totalProcesosAceptados
    ? Math.round((Object.keys(artefactosPorProceso).length / totalProcesosAceptados) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-purple-400" />
          Process Architect
        </h1>
        <p className="text-slate-400 text-sm mt-1">Arquitectura de procesos y artefactos metodológicos generados por IA</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Procesos aceptados', value: totalProcesosAceptados, color: 'text-white' },
          { label: 'Artefactos generados', value: totalArtefactos, color: 'text-purple-400' },
          { label: 'Publicados', value: totalPublicados, color: 'text-blue-400' },
          { label: 'Cobertura', value: `${cobertura}%`, color: 'text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leyenda de tipos de artefacto */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
            <FileText className="w-4 h-4" /> 12 artefactos metodológicos por proceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ORDEN_GENERACION.map(tipo => (
              <span key={tipo} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {LABEL_ARTEFACTO[tipo]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Árbol por proyecto */}
      {procesosPorProyecto.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center space-y-3">
            <Brain className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-slate-300 font-medium">No hay procesos aceptados aún</p>
            <p className="text-slate-500 text-sm">
              Acepta procesos en la vista Discovery AI para poder generar artefactos.
            </p>
          </CardContent>
        </Card>
      )}

      {procesosPorProyecto.map(proyecto => {
        const prosProyecto = proyecto.procesos
        if (!prosProyecto.length) return null
        const cliente = proyecto.cliente as unknown as { razon_social: string } | null
        return (
          <div key={proyecto.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">{proyecto.nombre}</h2>
              <span className="text-slate-500 text-sm">· {cliente?.razon_social}</span>
            </div>
            <div className="space-y-0">
              {renderArbol(prosProyecto, null, 0)}
            </div>
          </div>
        )
      })}

      {/* Estado icon legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {Object.entries(ESTADO_ICON).map(([estado, icon]) => (
          <span key={estado} className="flex items-center gap-1">{icon} {estado}</span>
        ))}
      </div>
    </div>
  )
}
